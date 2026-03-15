import { useState, useEffect, useRef } from 'react';
import { Alert, Vibration, Platform } from 'react-native';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from './api';
import { format } from 'date-fns';

const IRS_MILEAGE_RATE = 0.70;
const MOVEMENT_THRESHOLD_MPH = 3; // Lowered for easier testing
const STOP_TIMEOUT_MS = 60000; // 1 minute of no movement = trip ended (was 2 min)
const MIN_TRIP_DISTANCE = 0.05; // Lowered minimum miles for testing

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
  duration: number;
  avgSpeed: number;
  maxSpeed: number;
  route: RoutePoint[];
  purpose?: 'Business' | 'Personal';
  classified: boolean;
}

const calculateDistanceBetweenPoints = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
  const R = 3959;
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

const STORAGE_KEYS = {
  AUTO_TRACKING_ENABLED: 'auto_tracking_enabled',
  PENDING_TRIPS: 'pending_trips',
};

// Demo trip data for testing
const DEMO_TRIPS: PendingTrip[] = [
  {
    id: 'demo_trip_1',
    startTime: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
    endTime: new Date(Date.now() - 1800000).toISOString(), // 30 min ago
    startLocation: '123 Main St, San Francisco, CA',
    endLocation: '456 Market St, San Francisco, CA',
    distance: 8.5,
    duration: 1800,
    avgSpeed: 28,
    maxSpeed: 45,
    route: [
      { latitude: 37.7749, longitude: -122.4194, timestamp: Date.now() - 3600000, speed: 0 },
      { latitude: 37.7755, longitude: -122.4180, timestamp: Date.now() - 3500000, speed: 12 },
      { latitude: 37.7768, longitude: -122.4165, timestamp: Date.now() - 3400000, speed: 25 },
      { latitude: 37.7780, longitude: -122.4145, timestamp: Date.now() - 3300000, speed: 30 },
      { latitude: 37.7795, longitude: -122.4120, timestamp: Date.now() - 3200000, speed: 35 },
      { latitude: 37.7810, longitude: -122.4095, timestamp: Date.now() - 3100000, speed: 28 },
      { latitude: 37.7825, longitude: -122.4070, timestamp: Date.now() - 3000000, speed: 22 },
      { latitude: 37.7840, longitude: -122.4050, timestamp: Date.now() - 2900000, speed: 18 },
      { latitude: 37.7855, longitude: -122.4030, timestamp: Date.now() - 2800000, speed: 15 },
      { latitude: 37.7865, longitude: -122.4010, timestamp: Date.now() - 2700000, speed: 0 },
    ],
    classified: false,
  },
  {
    id: 'demo_trip_2',
    startTime: new Date(Date.now() - 86400000).toISOString(), // Yesterday
    endTime: new Date(Date.now() - 82800000).toISOString(),
    startLocation: '789 Oak Ave, Oakland, CA',
    endLocation: '321 Pine St, Berkeley, CA',
    distance: 12.3,
    duration: 2400,
    avgSpeed: 32,
    maxSpeed: 55,
    route: [
      { latitude: 37.8044, longitude: -122.2712, timestamp: Date.now() - 86400000, speed: 0 },
      { latitude: 37.8100, longitude: -122.2680, timestamp: Date.now() - 86000000, speed: 20 },
      { latitude: 37.8200, longitude: -122.2620, timestamp: Date.now() - 85600000, speed: 40 },
      { latitude: 37.8350, longitude: -122.2550, timestamp: Date.now() - 85200000, speed: 50 },
      { latitude: 37.8500, longitude: -122.2500, timestamp: Date.now() - 84800000, speed: 45 },
      { latitude: 37.8650, longitude: -122.2580, timestamp: Date.now() - 84400000, speed: 35 },
      { latitude: 37.8716, longitude: -122.2727, timestamp: Date.now() - 84000000, speed: 0 },
    ],
    purpose: 'Business',
    classified: true,
  },
  {
    id: 'demo_trip_3',
    startTime: new Date(Date.now() - 172800000).toISOString(), // 2 days ago
    endTime: new Date(Date.now() - 170400000).toISOString(),
    startLocation: '555 University Ave, Palo Alto, CA',
    endLocation: '999 El Camino, Mountain View, CA',
    distance: 5.7,
    duration: 1200,
    avgSpeed: 25,
    maxSpeed: 40,
    route: [
      { latitude: 37.4419, longitude: -122.1430, timestamp: Date.now() - 172800000, speed: 0 },
      { latitude: 37.4350, longitude: -122.1380, timestamp: Date.now() - 172400000, speed: 30 },
      { latitude: 37.4250, longitude: -122.1280, timestamp: Date.now() - 172000000, speed: 35 },
      { latitude: 37.4150, longitude: -122.1180, timestamp: Date.now() - 171600000, speed: 25 },
      { latitude: 37.4056, longitude: -122.1080, timestamp: Date.now() - 171200000, speed: 0 },
    ],
    purpose: 'Personal',
    classified: true,
  },
];

export const useAutoTripDetection = () => {
  const [isEnabled, setIsEnabled] = useState(false);
  const [isTracking, setIsTracking] = useState(false);
  const [currentTrip, setCurrentTrip] = useState<Partial<PendingTrip> | null>(null);
  
  const locationSubscription = useRef<Location.LocationSubscription | null>(null);
  const lastMovementTime = useRef(Date.now());
  const routePoints = useRef<RoutePoint[]>([]);
  const totalDistance = useRef(0);
  const maxSpeed = useRef(0);
  const stopCheckInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const tripStartTime = useRef<Date | null>(null);
  const startLocationName = useRef('');
  const trackingRef = useRef(false);

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
      }
    } catch (error) {
      console.error('Error loading auto-tracking state:', error);
    }
  };

  const cleanup = () => {
    if (locationSubscription.current) {
      locationSubscription.current.remove();
      locationSubscription.current = null;
    }
    if (stopCheckInterval.current) {
      clearInterval(stopCheckInterval.current);
      stopCheckInterval.current = null;
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
      // Save to local storage
      const existingTrips = await AsyncStorage.getItem(STORAGE_KEYS.PENDING_TRIPS);
      const trips: PendingTrip[] = existingTrips ? JSON.parse(existingTrips) : [];
      trips.unshift(trip);
      await AsyncStorage.setItem(STORAGE_KEYS.PENDING_TRIPS, JSON.stringify(trips.slice(0, 50)));
      
      // Also save to backend database (as unclassified - purpose will be set later)
      try {
        await api.createMileage({
          start_location: trip.startLocation,
          end_location: trip.endLocation,
          distance: trip.distance,
          purpose: 'Pending', // Will be updated when classified
          date: format(new Date(trip.startTime), 'yyyy-MM-dd'),
          notes: `Auto-tracked: ${Math.round(trip.duration / 60)} min, ${trip.avgSpeed.toFixed(0)} mph avg`,
        });
        console.log('Trip saved to backend successfully');
      } catch (apiError) {
        console.error('Error saving to backend:', apiError);
        // Trip is still saved locally, user can sync later
      }
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

    const speeds = routePoints.current
      .filter(p => p.speed !== null && p.speed > 0)
      .map(p => (p.speed || 0) * 2.237);
    const avgSpeed = speeds.length > 0 ? speeds.reduce((a, b) => a + b, 0) / speeds.length : 0;

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
      Vibration.vibrate([100, 100, 100]);
    }

    resetTripState();
  };

  const resetTripState = () => {
    trackingRef.current = false;
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
    trackingRef.current = true;
    
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
    
    if (stopCheckInterval.current) {
      clearInterval(stopCheckInterval.current);
    }
    stopCheckInterval.current = setInterval(() => {
      const timeSinceMovement = Date.now() - lastMovementTime.current;
      if (timeSinceMovement > STOP_TIMEOUT_MS && trackingRef.current) {
        endCurrentTrip();
      }
    }, 10000);
  };

  const handleLocationUpdate = async (location: Location.LocationObject) => {
    const speedMph = (location.coords.speed || 0) * 2.237;
    const isMoving = speedMph >= MOVEMENT_THRESHOLD_MPH;

    if (isMoving) {
      lastMovementTime.current = Date.now();

      if (!trackingRef.current) {
        await startNewTrip(location);
      } else {
        const lastPoint = routePoints.current[routePoints.current.length - 1];
        if (lastPoint) {
          const distance = calculateDistanceBetweenPoints(
            lastPoint.latitude,
            lastPoint.longitude,
            location.coords.latitude,
            location.coords.longitude
          );

          if (distance > 0.001 && distance < 0.5) {
            totalDistance.current += distance;
          }
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
        try {
          await Location.requestBackgroundPermissionsAsync();
        } catch (e) {
          console.log('Background permission not available');
        }
      }

      locationSubscription.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.BestForNavigation,
          distanceInterval: 20,
          timeInterval: 3000,
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
    if (trackingRef.current) {
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

export const getPendingTrips = async (): Promise<PendingTrip[]> => {
  try {
    const trips = await AsyncStorage.getItem(STORAGE_KEYS.PENDING_TRIPS);
    const savedTrips: PendingTrip[] = trips ? JSON.parse(trips) : [];
    
    // If no saved trips, return demo trips
    if (savedTrips.length === 0) {
      return DEMO_TRIPS;
    }
    
    return savedTrips;
  } catch (error) {
    console.error('Error getting pending trips:', error);
    return DEMO_TRIPS; // Return demo on error
  }
};

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

export const addDemoTrips = async (): Promise<void> => {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.PENDING_TRIPS, JSON.stringify(DEMO_TRIPS));
  } catch (error) {
    console.error('Error adding demo trips:', error);
  }
};
