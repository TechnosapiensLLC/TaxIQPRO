import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Vibration,
  Platform,
  AppState,
  AppStateStatus,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { format } from 'date-fns';

const IRS_MILEAGE_RATE = 0.70;
const MOVEMENT_THRESHOLD_MPH = 5; // Speed threshold to detect movement
const STOP_TIMEOUT_MS = 120000; // 2 minutes of no movement = trip ended
const MIN_TRIP_DISTANCE = 0.1; // Minimum miles for a valid trip

export interface RoutePoint {
  latitude: number;
  longitude: number;
  timestamp: number;
  speed: number | null;
}

export interface PendingTrip {
  id: string;
  startTime: string;
  endTime: string;
  startLocation: string;
  endLocation: string;
  distance: number;
  duration: number; // in seconds
  avgSpeed: number;
  maxSpeed: number;
  route: RoutePoint[];
  purpose?: 'Business' | 'Personal';
  classified: boolean;
}

// Haversine formula to calculate distance between two GPS points
const calculateDistanceBetweenPoints = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
  const R = 3959; // Earth's radius in miles
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

// Storage keys
const STORAGE_KEYS = {
  AUTO_TRACKING_ENABLED: 'auto_tracking_enabled',
  CURRENT_TRIP: 'current_trip_data',
  PENDING_TRIPS: 'pending_trips',
};

export const useAutoTripDetection = () => {
  const [isEnabled, setIsEnabled] = useState(false);
  const [isTracking, setIsTracking] = useState(false);
  const [currentTrip, setCurrentTrip] = useState<Partial<PendingTrip> | null>(null);
  
  const locationSubscription = useRef<Location.LocationSubscription | null>(null);
  const lastMovementTime = useRef<number>(Date.now());
  const routePoints = useRef<RoutePoint[]>([]);
  const totalDistance = useRef<number>(0);
  const maxSpeed = useRef<number>(0);
  const stopCheckInterval = useRef<NodeJS.Timeout | null>(null);
  const tripStartTime = useRef<Date | null>(null);
  const startLocationName = useRef<string>('');

  // Load saved state on mount
  useEffect(() => {
    loadSavedState();
    return () => {
      cleanup();
    };
  }, []);

  const loadSavedState = async () => {
    try {
      const enabled = await AsyncStorage.getItem(STORAGE_KEYS.AUTO_TRACKING_ENABLED);
      if (enabled === 'true') {
        setIsEnabled(true);
        startAutoDetection();
      }
    } catch (error) {
      console.error('Error loading auto-tracking state:', error);
    }
  };

  const cleanup = () => {
    if (locationSubscription.current) {
      locationSubscription.current.remove();
    }
    if (stopCheckInterval.current) {
      clearInterval(stopCheckInterval.current);
    }
  };

  const getAddressFromCoords = async (latitude: number, longitude: number): Promise<string> => {
    try {
      const [address] = await Location.reverseGeocodeAsync({ latitude, longitude });
      if (address) {
        return `${address.street || ''} ${address.city || ''}, ${address.region || ''}`
          .trim()
          .replace(/^,\s*/, '');
      }
    } catch (error) {
      console.error('Geocoding error:', error);
    }
    return `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
  };

  const savePendingTrip = async (trip: PendingTrip) => {
    try {
      const existingTrips = await AsyncStorage.getItem(STORAGE_KEYS.PENDING_TRIPS);
      const trips: PendingTrip[] = existingTrips ? JSON.parse(existingTrips) : [];
      trips.unshift(trip); // Add to beginning
      await AsyncStorage.setItem(STORAGE_KEYS.PENDING_TRIPS, JSON.stringify(trips.slice(0, 50))); // Keep last 50
    } catch (error) {
      console.error('Error saving pending trip:', error);
    }
  };

  const endCurrentTrip = async () => {
    if (!tripStartTime.current || routePoints.current.length < 2) {
      resetTripState();
      return;
    }

    const endTime = new Date();
    const duration = Math.floor((endTime.getTime() - tripStartTime.current.getTime()) / 1000);
    const lastPoint = routePoints.current[routePoints.current.length - 1];
    const endLocationName = await getAddressFromCoords(lastPoint.latitude, lastPoint.longitude);

    // Calculate average speed
    const speeds = routePoints.current
      .filter(p => p.speed !== null && p.speed > 0)
      .map(p => (p.speed || 0) * 2.237); // Convert m/s to mph
    const avgSpeed = speeds.length > 0 ? speeds.reduce((a, b) => a + b, 0) / speeds.length : 0;

    // Only save if trip is meaningful
    if (totalDistance.current >= MIN_TRIP_DISTANCE) {
      const trip: PendingTrip = {
        id: `trip_${Date.now()}`,
        startTime: tripStartTime.current.toISOString(),
        endTime: endTime.toISOString(),
        startLocation: startLocationName.current,
        endLocation: endLocationName,
        distance: parseFloat(totalDistance.current.toFixed(2)),
        duration,
        avgSpeed: parseFloat(avgSpeed.toFixed(1)),
        maxSpeed: parseFloat(maxSpeed.current.toFixed(1)),
        route: routePoints.current,
        classified: false,
      };

      await savePendingTrip(trip);
      Vibration.vibrate([100, 100, 100]); // Notify user
    }

    resetTripState();
  };

  const resetTripState = () => {
    setIsTracking(false);
    setCurrentTrip(null);
    routePoints.current = [];
    totalDistance.current = 0;
    maxSpeed.current = 0;
    tripStartTime.current = null;
    startLocationName.current = '';
  };

  const startNewTrip = async (location: Location.LocationObject) => {
    tripStartTime.current = new Date();
    const startPoint: RoutePoint = {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      timestamp: Date.now(),
      speed: location.coords.speed,
    };
    routePoints.current = [startPoint];
    totalDistance.current = 0;
    maxSpeed.current = 0;
    
    startLocationName.current = await getAddressFromCoords(
      location.coords.latitude,
      location.coords.longitude
    );
    
    setIsTracking(true);
    setCurrentTrip({
      startTime: tripStartTime.current.toISOString(),
      startLocation: startLocationName.current,
      distance: 0,
    });
    
    // Start checking for stops
    if (stopCheckInterval.current) {
      clearInterval(stopCheckInterval.current);
    }
    stopCheckInterval.current = setInterval(() => {
      const timeSinceMovement = Date.now() - lastMovementTime.current;
      if (timeSinceMovement > STOP_TIMEOUT_MS && isTracking) {
        endCurrentTrip();
      }
    }, 10000); // Check every 10 seconds
  };

  const handleLocationUpdate = async (location: Location.LocationObject) => {
    const speedMph = (location.coords.speed || 0) * 2.237;
    const isMoving = speedMph >= MOVEMENT_THRESHOLD_MPH;

    if (isMoving) {
      lastMovementTime.current = Date.now();

      if (!isTracking) {
        // Start a new trip
        await startNewTrip(location);
      } else {
        // Continue tracking
        const lastPoint = routePoints.current[routePoints.current.length - 1];
        const distance = calculateDistanceBetweenPoints(
          lastPoint.latitude,
          lastPoint.longitude,
          location.coords.latitude,
          location.coords.longitude
        );

        // Filter GPS noise
        if (distance > 0.001 && distance < 0.5) {
          totalDistance.current += distance;
        }

        if (speedMph > maxSpeed.current) {
          maxSpeed.current = speedMph;
        }

        const newPoint: RoutePoint = {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          timestamp: Date.now(),
          speed: location.coords.speed,
        };
        routePoints.current.push(newPoint);

        setCurrentTrip(prev => ({
          ...prev,
          distance: parseFloat(totalDistance.current.toFixed(2)),
        }));
      }
    }
  };

  const startAutoDetection = async () => {
    try {
      const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
      if (foregroundStatus !== 'granted') {
        Alert.alert('Permission Required', 'Location access is needed for auto trip detection.');
        return false;
      }

      if (Platform.OS !== 'web') {
        await Location.requestBackgroundPermissionsAsync();
      }

      locationSubscription.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.BestForNavigation,
          distanceInterval: 20, // Update every 20 meters
          timeInterval: 3000, // Or every 3 seconds
        },
        handleLocationUpdate
      );

      await AsyncStorage.setItem(STORAGE_KEYS.AUTO_TRACKING_ENABLED, 'true');
      setIsEnabled(true);
      return true;
    } catch (error) {
      console.error('Error starting auto detection:', error);
      return false;
    }
  };

  const stopAutoDetection = async () => {
    cleanup();
    if (isTracking) {
      await endCurrentTrip();
    }
    await AsyncStorage.setItem(STORAGE_KEYS.AUTO_TRACKING_ENABLED, 'false');
    setIsEnabled(false);
  };

  return {
    isEnabled,
    isTracking,
    currentTrip,
    startAutoDetection,
    stopAutoDetection,
    endCurrentTrip,
  };
};

// Get pending trips from storage
export const getPendingTrips = async (): Promise<PendingTrip[]> => {
  try {
    const trips = await AsyncStorage.getItem(STORAGE_KEYS.PENDING_TRIPS);
    return trips ? JSON.parse(trips) : [];
  } catch (error) {
    console.error('Error getting pending trips:', error);
    return [];
  }
};

// Update a trip's classification
export const classifyTrip = async (tripId: string, purpose: 'Business' | 'Personal'): Promise<boolean> => {
  try {
    const trips = await getPendingTrips();
    const tripIndex = trips.findIndex(t => t.id === tripId);
    if (tripIndex >= 0) {
      trips[tripIndex].purpose = purpose;
      trips[tripIndex].classified = true;
      await AsyncStorage.setItem(STORAGE_KEYS.PENDING_TRIPS, JSON.stringify(trips));
      return true;
    }
    return false;
  } catch (error) {
    console.error('Error classifying trip:', error);
    return false;
  }
};

// Delete a trip
export const deleteTrip = async (tripId: string): Promise<boolean> => {
  try {
    const trips = await getPendingTrips();
    const filtered = trips.filter(t => t.id !== tripId);
    await AsyncStorage.setItem(STORAGE_KEYS.PENDING_TRIPS, JSON.stringify(filtered));
    return true;
  } catch (error) {
    console.error('Error deleting trip:', error);
    return false;
  }
};
