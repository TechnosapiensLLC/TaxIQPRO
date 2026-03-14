import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Vibration,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { api } from '../src/services/api';
import { format } from 'date-fns';

const IRS_MILEAGE_RATE = 0.70;

interface LocationPoint {
  latitude: number;
  longitude: number;
  timestamp: number;
  speed: number | null;
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

export default function TripTrackerScreen() {
  const router = useRouter();
  const [isTracking, setIsTracking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [totalMiles, setTotalMiles] = useState(0);
  const [currentSpeed, setCurrentSpeed] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [startLocation, setStartLocation] = useState<string>('');
  const [currentLocation, setCurrentLocation] = useState<string>('');
  const [purpose, setPurpose] = useState<'Business' | 'Personal'>('Business');
  
  const locationSubscription = useRef<Location.LocationSubscription | null>(null);
  const lastPosition = useRef<LocationPoint | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startTime = useRef<Date | null>(null);
  const startCoords = useRef<{ lat: number; lng: number } | null>(null);
  const endCoords = useRef<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    return () => {
      // Cleanup on unmount
      stopTracking();
    };
  }, []);

  useEffect(() => {
    if (isTracking && !isPaused) {
      timerRef.current = setInterval(() => {
        setElapsedTime((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isTracking, isPaused]);

  const formatTime = (seconds: number): string => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
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

  const startTracking = async () => {
    try {
      // Request permissions
      const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
      if (foregroundStatus !== 'granted') {
        Alert.alert('Permission Required', 'Location access is needed to track your trip.');
        return;
      }

      // Try to get background permission for better tracking
      if (Platform.OS !== 'web') {
        const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
        if (backgroundStatus !== 'granted') {
          Alert.alert(
            'Background Location',
            'For best tracking accuracy, enable "Always" location access in settings.',
            [{ text: 'OK' }]
          );
        }
      }

      // Get initial position
      const initialPosition = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.BestForNavigation,
      });

      const initialLat = initialPosition.coords.latitude;
      const initialLng = initialPosition.coords.longitude;
      
      startCoords.current = { lat: initialLat, lng: initialLng };
      lastPosition.current = {
        latitude: initialLat,
        longitude: initialLng,
        timestamp: Date.now(),
        speed: initialPosition.coords.speed,
      };

      // Get starting address
      const address = await getAddressFromCoords(initialLat, initialLng);
      setStartLocation(address);
      setCurrentLocation(address);

      // Start watching position
      locationSubscription.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.BestForNavigation,
          distanceInterval: 10, // Update every 10 meters
          timeInterval: 2000, // Or every 2 seconds
        },
        (location) => {
          if (isPaused) return;

          const newLat = location.coords.latitude;
          const newLng = location.coords.longitude;
          const speed = location.coords.speed;

          // Update current speed (convert m/s to mph)
          if (speed !== null && speed >= 0) {
            setCurrentSpeed(speed * 2.237); // m/s to mph
          }

          // Calculate distance from last position
          if (lastPosition.current) {
            const distance = calculateDistanceBetweenPoints(
              lastPosition.current.latitude,
              lastPosition.current.longitude,
              newLat,
              newLng
            );

            // Only add distance if it's reasonable (filter GPS noise)
            // Ignore jumps larger than 0.5 miles in 2 seconds (would be 900 mph)
            if (distance > 0.001 && distance < 0.5) {
              setTotalMiles((prev) => prev + distance);
            }
          }

          // Update last position
          lastPosition.current = {
            latitude: newLat,
            longitude: newLng,
            timestamp: Date.now(),
            speed: speed,
          };
          
          // Store end coordinates
          endCoords.current = { lat: newLat, lng: newLng };

          // Update current location address periodically
          getAddressFromCoords(newLat, newLng).then(setCurrentLocation);
        }
      );

      setIsTracking(true);
      setIsPaused(false);
      startTime.current = new Date();
      Vibration.vibrate(100); // Haptic feedback

    } catch (error) {
      console.error('Error starting tracking:', error);
      Alert.alert('Error', 'Could not start trip tracking. Please check location permissions.');
    }
  };

  const pauseTracking = () => {
    setIsPaused(true);
    Vibration.vibrate(50);
  };

  const resumeTracking = () => {
    setIsPaused(false);
    Vibration.vibrate(50);
  };

  const stopTracking = () => {
    if (locationSubscription.current) {
      locationSubscription.current.remove();
      locationSubscription.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
  };

  const endTrip = () => {
    if (totalMiles < 0.1) {
      Alert.alert(
        'Short Trip',
        'This trip is less than 0.1 miles. Do you still want to save it?',
        [
          { text: 'Discard', style: 'destructive', onPress: discardTrip },
          { text: 'Save Anyway', onPress: saveTrip },
        ]
      );
    } else {
      saveTrip();
    }
  };

  const saveTrip = async () => {
    stopTracking();
    
    try {
      await api.createMileage({
        start_location: startLocation,
        end_location: currentLocation,
        distance: parseFloat(totalMiles.toFixed(2)),
        purpose: purpose,
        date: format(startTime.current || new Date(), 'yyyy-MM-dd'),
        notes: `Tracked trip - ${formatTime(elapsedTime)} duration`,
      });

      const deduction = purpose === 'Business' ? totalMiles * IRS_MILEAGE_RATE : 0;
      
      Alert.alert(
        'Trip Saved!',
        `${totalMiles.toFixed(2)} miles tracked\n${purpose === 'Business' ? `Deduction: $${deduction.toFixed(2)}` : 'Personal trip (no deduction)'}`,
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to save trip. Please try again.');
    }
  };

  const discardTrip = () => {
    stopTracking();
    router.back();
  };

  const estimatedDeduction = purpose === 'Business' ? totalMiles * IRS_MILEAGE_RATE : 0;

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          onPress={() => {
            if (isTracking) {
              Alert.alert(
                'End Trip?',
                'You have an active trip. What would you like to do?',
                [
                  { text: 'Continue Trip', style: 'cancel' },
                  { text: 'Save & Exit', onPress: saveTrip },
                  { text: 'Discard', style: 'destructive', onPress: discardTrip },
                ]
              );
            } else {
              router.back();
            }
          }}
        >
          <Ionicons name="close" size={28} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Trip Tracker</Text>
        <View style={{ width: 28 }} />
      </View>

      {/* Purpose Toggle */}
      <View style={styles.purposeToggle}>
        <TouchableOpacity
          style={[
            styles.purposeButton,
            purpose === 'Business' && styles.purposeButtonActive,
          ]}
          onPress={() => setPurpose('Business')}
          disabled={isTracking}
        >
          <Ionicons 
            name="briefcase" 
            size={18} 
            color={purpose === 'Business' ? '#FFF' : '#6B6B7B'} 
          />
          <Text style={[
            styles.purposeButtonText,
            purpose === 'Business' && styles.purposeButtonTextActive,
          ]}>
            Business
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.purposeButton,
            purpose === 'Personal' && styles.purposeButtonActivePersonal,
          ]}
          onPress={() => setPurpose('Personal')}
          disabled={isTracking}
        >
          <Ionicons 
            name="car" 
            size={18} 
            color={purpose === 'Personal' ? '#FFF' : '#6B6B7B'} 
          />
          <Text style={[
            styles.purposeButtonText,
            purpose === 'Personal' && styles.purposeButtonTextActive,
          ]}>
            Personal
          </Text>
        </TouchableOpacity>
      </View>

      {/* Main Odometer Display */}
      <View style={styles.odometerContainer}>
        <Text style={styles.odometerLabel}>MILES DRIVEN</Text>
        <View style={styles.odometerDisplay}>
          <Text style={styles.odometerValue}>
            {totalMiles.toFixed(2)}
          </Text>
          <Text style={styles.odometerUnit}>mi</Text>
        </View>
        
        {isTracking && (
          <View style={styles.speedDisplay}>
            <Ionicons name="speedometer" size={16} color="#00D9A5" />
            <Text style={styles.speedValue}>
              {currentSpeed.toFixed(0)} mph
            </Text>
          </View>
        )}
      </View>

      {/* Stats Row */}
      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Ionicons name="time-outline" size={20} color="#6B6B7B" />
          <Text style={styles.statValue}>{formatTime(elapsedTime)}</Text>
          <Text style={styles.statLabel}>Duration</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Ionicons name="cash-outline" size={20} color="#00D9A5" />
          <Text style={[styles.statValue, { color: '#00D9A5' }]}>
            ${estimatedDeduction.toFixed(2)}
          </Text>
          <Text style={styles.statLabel}>Deduction</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Ionicons name="trending-up-outline" size={20} color="#6B6B7B" />
          <Text style={styles.statValue}>
            {elapsedTime > 0 ? ((totalMiles / elapsedTime) * 3600).toFixed(0) : '0'}
          </Text>
          <Text style={styles.statLabel}>Avg mph</Text>
        </View>
      </View>

      {/* Location Info */}
      {isTracking && (
        <View style={styles.locationInfo}>
          <View style={styles.locationRow}>
            <View style={styles.locationDot} />
            <View style={styles.locationTextContainer}>
              <Text style={styles.locationLabel}>Started from</Text>
              <Text style={styles.locationValue} numberOfLines={1}>
                {startLocation || 'Getting location...'}
              </Text>
            </View>
          </View>
          <View style={styles.locationLine} />
          <View style={styles.locationRow}>
            <View style={[styles.locationDot, { backgroundColor: '#FF6B6B' }]} />
            <View style={styles.locationTextContainer}>
              <Text style={styles.locationLabel}>Current location</Text>
              <Text style={styles.locationValue} numberOfLines={1}>
                {currentLocation || 'Tracking...'}
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* Tracking Status */}
      {isTracking && (
        <View style={[
          styles.statusBadge,
          isPaused && styles.statusBadgePaused,
        ]}>
          <View style={[
            styles.statusDot,
            isPaused && styles.statusDotPaused,
          ]} />
          <Text style={styles.statusText}>
            {isPaused ? 'PAUSED' : 'TRACKING'}
          </Text>
        </View>
      )}

      {/* Control Buttons */}
      <View style={styles.controlsContainer}>
        {!isTracking ? (
          <TouchableOpacity
            style={styles.startButton}
            onPress={startTracking}
          >
            <Ionicons name="navigate" size={28} color="#FFF" />
            <Text style={styles.startButtonText}>Start Trip</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.activeControls}>
            {!isPaused ? (
              <TouchableOpacity
                style={styles.pauseButton}
                onPress={pauseTracking}
              >
                <Ionicons name="pause" size={24} color="#FFF" />
                <Text style={styles.controlButtonText}>Pause</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.resumeButton}
                onPress={resumeTracking}
              >
                <Ionicons name="play" size={24} color="#FFF" />
                <Text style={styles.controlButtonText}>Resume</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.endButton}
              onPress={endTrip}
            >
              <Ionicons name="flag" size={24} color="#FFF" />
              <Text style={styles.controlButtonText}>End Trip</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Info Text */}
      {!isTracking && (
        <Text style={styles.infoText}>
          Tap "Start Trip" when you begin driving.{'\n'}
          Your miles will be tracked automatically.
        </Text>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0F',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  purposeToggle: {
    flexDirection: 'row',
    marginHorizontal: 20,
    backgroundColor: '#14141A',
    borderRadius: 12,
    padding: 4,
    marginBottom: 24,
  },
  purposeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    gap: 8,
  },
  purposeButtonActive: {
    backgroundColor: '#00D9A5',
  },
  purposeButtonActivePersonal: {
    backgroundColor: '#6B6B7B',
  },
  purposeButtonText: {
    color: '#6B6B7B',
    fontSize: 14,
    fontWeight: '600',
  },
  purposeButtonTextActive: {
    color: '#FFF',
  },
  odometerContainer: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  odometerLabel: {
    color: '#6B6B7B',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 2,
    marginBottom: 8,
  },
  odometerDisplay: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  odometerValue: {
    color: '#FFFFFF',
    fontSize: 72,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  odometerUnit: {
    color: '#6B6B7B',
    fontSize: 24,
    fontWeight: '500',
    marginLeft: 8,
  },
  speedDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    backgroundColor: '#00D9A520',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  speedValue: {
    color: '#00D9A5',
    fontSize: 16,
    fontWeight: '600',
  },
  statsRow: {
    flexDirection: 'row',
    marginHorizontal: 20,
    backgroundColor: '#14141A',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  statDivider: {
    width: 1,
    backgroundColor: '#2A2A35',
    marginHorizontal: 12,
  },
  statValue: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  statLabel: {
    color: '#6B6B7B',
    fontSize: 11,
  },
  locationInfo: {
    marginHorizontal: 20,
    backgroundColor: '#14141A',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  locationDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#00D9A5',
    marginRight: 12,
  },
  locationLine: {
    width: 2,
    height: 20,
    backgroundColor: '#2A2A35',
    marginLeft: 5,
    marginVertical: 4,
  },
  locationTextContainer: {
    flex: 1,
  },
  locationLabel: {
    color: '#6B6B7B',
    fontSize: 11,
  },
  locationValue: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: '#00D9A520',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 20,
    gap: 8,
  },
  statusBadgePaused: {
    backgroundColor: '#FFB84D20',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#00D9A5',
  },
  statusDotPaused: {
    backgroundColor: '#FFB84D',
  },
  statusText: {
    color: '#00D9A5',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
  },
  controlsContainer: {
    paddingHorizontal: 20,
    marginTop: 'auto',
    marginBottom: 20,
  },
  startButton: {
    backgroundColor: '#00D9A5',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    borderRadius: 16,
    gap: 12,
  },
  startButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  activeControls: {
    flexDirection: 'row',
    gap: 12,
  },
  pauseButton: {
    flex: 1,
    backgroundColor: '#FFB84D',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 14,
    gap: 8,
  },
  resumeButton: {
    flex: 1,
    backgroundColor: '#00D9A5',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 14,
    gap: 8,
  },
  endButton: {
    flex: 1,
    backgroundColor: '#FF6B6B',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 14,
    gap: 8,
  },
  controlButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  infoText: {
    color: '#6B6B7B',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 40,
    marginBottom: 20,
  },
});
