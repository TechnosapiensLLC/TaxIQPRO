import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Vibration,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { api } from '../src/services/api';
import { format } from 'date-fns';

import { useColors } from '../src/context/ThemeContext';
import type { Palette } from '../src/theme';
const IRS_MILEAGE_RATE = 0.70;

interface RoutePoint {
  latitude: number;
  longitude: number;
  timestamp: number;
  speed: number | null;
}

const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
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

export default function LiveTripScreen() {
  const c = useColors();
  const styles = makeStyles(c);
  const router = useRouter();
  const [isTracking, setIsTracking] = useState(false);
  const [totalMiles, setTotalMiles] = useState(0);
  const [currentSpeed, setCurrentSpeed] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [startLocation, setStartLocation] = useState('');
  const [currentLocation, setCurrentLocation] = useState('');
  const [purpose, setPurpose] = useState<'Business' | 'Personal'>('Business');
  const [gpsStatus, setGpsStatus] = useState('Ready');
  const [pointsCollected, setPointsCollected] = useState(0);

  const locationSubscription = useRef<Location.LocationSubscription | null>(null);
  const lastPosition = useRef<RoutePoint | null>(null);
  const routePoints = useRef<RoutePoint[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTime = useRef<Date | null>(null);
  const totalDistanceRef = useRef(0);
  const maxSpeedRef = useRef(0);

  useEffect(() => {
    return () => {
      cleanup();
    };
  }, []);

  useEffect(() => {
    if (isTracking) {
      timerRef.current = setInterval(() => {
        setElapsedTime((prev) => prev + 1);
      }, 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isTracking]);

  const cleanup = () => {
    if (locationSubscription.current) {
      locationSubscription.current.remove();
      locationSubscription.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
  };

  const formatTime = (seconds: number): string => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getAddressFromCoords = async (latitude: number, longitude: number): Promise<string> => {
    try {
      const [address] = await Location.reverseGeocodeAsync({ latitude, longitude });
      if (address) {
        return `${address.street || ''} ${address.city || ''}, ${address.region || ''}`
          .trim().replace(/^,\s*/, '') || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
      }
    } catch (e) {}
    return `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
  };

  const startTrip = async () => {
    try {
      setGpsStatus('Getting permission...');
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Location access is needed to track your trip.');
        setGpsStatus('Permission denied');
        return;
      }

      setGpsStatus('Getting initial location...');
      const initialPosition = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.BestForNavigation,
      });

      const startAddr = await getAddressFromCoords(
        initialPosition.coords.latitude,
        initialPosition.coords.longitude
      );
      setStartLocation(startAddr);
      setCurrentLocation(startAddr);

      lastPosition.current = {
        latitude: initialPosition.coords.latitude,
        longitude: initialPosition.coords.longitude,
        timestamp: Date.now(),
        speed: initialPosition.coords.speed,
      };
      routePoints.current = [lastPosition.current];
      totalDistanceRef.current = 0;
      maxSpeedRef.current = 0;
      startTime.current = new Date();

      setGpsStatus('Starting GPS tracking...');
      locationSubscription.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.BestForNavigation,
          distanceInterval: 5, // Update every 5 meters
          timeInterval: 1000, // Or every 1 second
        },
        (location) => {
          const newLat = location.coords.latitude;
          const newLng = location.coords.longitude;
          const speed = location.coords.speed;

          // Update speed (m/s to mph)
          const speedMph = (speed || 0) * 2.237;
          setCurrentSpeed(speedMph);
          if (speedMph > maxSpeedRef.current) {
            maxSpeedRef.current = speedMph;
          }

          // Calculate distance from last point
          if (lastPosition.current) {
            const dist = calculateDistance(
              lastPosition.current.latitude,
              lastPosition.current.longitude,
              newLat,
              newLng
            );
            // Filter GPS noise (ignore jumps > 0.3 miles)
            if (dist > 0.0005 && dist < 0.3) {
              totalDistanceRef.current += dist;
              setTotalMiles(totalDistanceRef.current);
            }
          }

          const newPoint: RoutePoint = {
            latitude: newLat,
            longitude: newLng,
            timestamp: Date.now(),
            speed: speed,
          };
          routePoints.current.push(newPoint);
          lastPosition.current = newPoint;
          setPointsCollected(routePoints.current.length);
          setGpsStatus(`Tracking (${routePoints.current.length} points)`);

          // Update current location periodically
          if (routePoints.current.length % 10 === 0) {
            getAddressFromCoords(newLat, newLng).then(setCurrentLocation);
          }
        }
      );

      setIsTracking(true);
      setElapsedTime(0);
      setTotalMiles(0);
      Vibration.vibrate(100);
      setGpsStatus('Tracking active');

    } catch (error) {
      console.error('Start trip error:', error);
      Alert.alert('Error', 'Could not start trip tracking');
      setGpsStatus('Error starting');
    }
  };

  const endTrip = async () => {
    if (!isTracking) return;

    cleanup();
    setIsTracking(false);
    setGpsStatus('Saving trip...');

    const endTime = new Date();
    const duration = elapsedTime;
    const distance = totalDistanceRef.current;

    // Get end location
    let endAddr = currentLocation;
    if (lastPosition.current) {
      endAddr = await getAddressFromCoords(
        lastPosition.current.latitude,
        lastPosition.current.longitude
      );
      setCurrentLocation(endAddr);
    }

    // Calculate average speed
    const avgSpeed = duration > 0 ? (distance / duration) * 3600 : 0;

    if (distance < 0.01) {
      Alert.alert(
        'Very Short Trip',
        `Only ${distance.toFixed(3)} miles tracked. Save anyway?`,
        [
          { text: 'Discard', style: 'cancel', onPress: () => setGpsStatus('Trip discarded') },
          { text: 'Save', onPress: () => saveTrip(distance, duration, avgSpeed, endAddr) },
        ]
      );
    } else {
      await saveTrip(distance, duration, avgSpeed, endAddr);
    }
  };

  const saveTrip = async (distance: number, duration: number, avgSpeed: number, endAddr: string) => {
    try {
      await api.createMileage({
        start_location: startLocation,
        end_location: endAddr,
        distance: parseFloat(distance.toFixed(2)),
        purpose: purpose,
        date: format(startTime.current || new Date(), 'yyyy-MM-dd'),
        notes: `Live tracked: ${formatTime(duration)}, ${avgSpeed.toFixed(0)} mph avg, ${maxSpeedRef.current.toFixed(0)} mph max`,
      });

      const deduction = purpose === 'Business' ? distance * IRS_MILEAGE_RATE : 0;
      
      Alert.alert(
        'Trip Saved!',
        `${distance.toFixed(2)} miles\n${formatTime(duration)} duration\n${avgSpeed.toFixed(0)} mph average${purpose === 'Business' ? `\n$${deduction.toFixed(2)} deduction` : ''}`,
        [{ text: 'OK', onPress: () => router.back() }]
      );
      setGpsStatus('Trip saved!');
    } catch (error) {
      console.error('Save error:', error);
      Alert.alert('Error', 'Failed to save trip. Please try again.');
      setGpsStatus('Save failed');
    }
  };

  const deduction = purpose === 'Business' ? totalMiles * IRS_MILEAGE_RATE : 0;

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => {
            if (isTracking) {
              Alert.alert('End Trip?', 'You have an active trip.', [
                { text: 'Continue', style: 'cancel' },
                { text: 'Save & Exit', onPress: endTrip },
                { text: 'Discard', style: 'destructive', onPress: () => { cleanup(); router.back(); } },
              ]);
            } else {
              router.back();
            }
          }}
        >
          <Ionicons name="close" size={28} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Live Trip Tracker</Text>
        <View style={{ width: 28 }} />
      </View>

      {/* GPS Status */}
      <View style={styles.statusBar}>
        <View style={[styles.statusDot, { backgroundColor: isTracking ? c.accent : c.textMuted }]} />
        <Text style={styles.statusText}>{gpsStatus}</Text>
        {pointsCollected > 0 && (
          <Text style={styles.pointsText}>{pointsCollected} GPS points</Text>
        )}
      </View>

      {/* Purpose Toggle */}
      <View style={styles.purposeToggle}>
        <TouchableOpacity
          style={[styles.purposeButton, purpose === 'Business' && styles.purposeActive]}
          onPress={() => !isTracking && setPurpose('Business')}
          disabled={isTracking}
        >
          <Ionicons name="briefcase" size={18} color={purpose === 'Business' ? '#FFF' : c.textMuted} />
          <Text style={[styles.purposeText, purpose === 'Business' && styles.purposeTextActive]}>Business</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.purposeButton, purpose === 'Personal' && styles.purposeActivePersonal]}
          onPress={() => !isTracking && setPurpose('Personal')}
          disabled={isTracking}
        >
          <Ionicons name="car" size={18} color={purpose === 'Personal' ? '#FFF' : c.textMuted} />
          <Text style={[styles.purposeText, purpose === 'Personal' && styles.purposeTextActive]}>Personal</Text>
        </TouchableOpacity>
      </View>

      {/* Odometer */}
      <View style={styles.odometerContainer}>
        <Text style={styles.odometerLabel}>MILES DRIVEN</Text>
        <View style={styles.odometerRow}>
          <Text style={styles.odometerValue}>{totalMiles.toFixed(2)}</Text>
          <Text style={styles.odometerUnit}>mi</Text>
        </View>
        {isTracking && (
          <View style={styles.speedBadge}>
            <Ionicons name="speedometer" size={14} color={c.accent} />
            <Text style={styles.speedText}>{currentSpeed.toFixed(0)} mph</Text>
          </View>
        )}
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Ionicons name="time-outline" size={18} color={c.textMuted} />
          <Text style={styles.statValue}>{formatTime(elapsedTime)}</Text>
          <Text style={styles.statLabel}>Duration</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.stat}>
          <Ionicons name="cash-outline" size={18} color={c.accent} />
          <Text style={[styles.statValue, { color: c.accent }]}>${deduction.toFixed(2)}</Text>
          <Text style={styles.statLabel}>Deduction</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.stat}>
          <Ionicons name="trending-up-outline" size={18} color={c.textMuted} />
          <Text style={styles.statValue}>{elapsedTime > 0 ? ((totalMiles / elapsedTime) * 3600).toFixed(0) : '0'}</Text>
          <Text style={styles.statLabel}>Avg mph</Text>
        </View>
      </View>

      {/* Locations */}
      {(startLocation || currentLocation) && (
        <View style={styles.locationsCard}>
          <View style={styles.locationRow}>
            <Ionicons name="radio-button-on" size={12} color={c.accent} />
            <View style={styles.locationInfo}>
              <Text style={styles.locationLabel}>Start</Text>
              <Text style={styles.locationText} numberOfLines={1}>{startLocation || 'Waiting...'}</Text>
            </View>
          </View>
          {isTracking && (
            <>
              <View style={styles.locationLine} />
              <View style={styles.locationRow}>
                <Ionicons name="location" size={12} color={c.danger} />
                <View style={styles.locationInfo}>
                  <Text style={styles.locationLabel}>Current</Text>
                  <Text style={styles.locationText} numberOfLines={1}>{currentLocation || 'Tracking...'}</Text>
                </View>
              </View>
            </>
          )}
        </View>
      )}

      {/* Control Buttons */}
      <View style={styles.controls}>
        {!isTracking ? (
          <TouchableOpacity style={styles.startButton} onPress={startTrip}>
            <Ionicons name="play" size={28} color="#FFF" />
            <Text style={styles.startButtonText}>Start Trip</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.endButton} onPress={endTrip}>
            <Ionicons name="stop" size={28} color="#FFF" />
            <Text style={styles.endButtonText}>End Trip & Save</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Instructions */}
      {!isTracking && (
        <Text style={styles.instructions}>
          Tap "Start Trip" when you begin driving.{'\n'}
          Tap "End Trip & Save" when you arrive.
        </Text>
      )}
    </SafeAreaView>
  );
}

const makeStyles = (c: Palette) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.bg },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16 },
  headerTitle: { color: '#FFF', fontSize: 18, fontWeight: '600' },
  statusBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 8, gap: 8 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { color: c.textMuted, fontSize: 12 },
  pointsText: { color: c.accent, fontSize: 12, marginLeft: 8 },
  purposeToggle: { flexDirection: 'row', marginHorizontal: 20, backgroundColor: c.surface, borderRadius: 12, padding: 4, marginBottom: 20 },
  purposeButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 10, gap: 8 },
  purposeActive: { backgroundColor: c.accent },
  purposeActivePersonal: { backgroundColor: c.textMuted },
  purposeText: { color: c.textMuted, fontSize: 14, fontWeight: '600' },
  purposeTextActive: { color: '#FFF' },
  odometerContainer: { alignItems: 'center', paddingVertical: 24 },
  odometerLabel: { color: c.textMuted, fontSize: 12, fontWeight: '600', letterSpacing: 2, marginBottom: 8 },
  odometerRow: { flexDirection: 'row', alignItems: 'baseline' },
  odometerValue: { color: '#FFF', fontSize: 64, fontWeight: '700', fontVariant: ['tabular-nums'] },
  odometerUnit: { color: c.textMuted, fontSize: 24, marginLeft: 8 },
  speedBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12, backgroundColor: c.accent + '20', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  speedText: { color: c.accent, fontSize: 16, fontWeight: '600' },
  statsRow: { flexDirection: 'row', marginHorizontal: 20, backgroundColor: c.surface, borderRadius: 16, padding: 16, marginBottom: 16 },
  stat: { flex: 1, alignItems: 'center', gap: 4 },
  statDivider: { width: 1, backgroundColor: c.border },
  statValue: { color: '#FFF', fontSize: 18, fontWeight: '700' },
  statLabel: { color: c.textMuted, fontSize: 11 },
  locationsCard: { marginHorizontal: 20, backgroundColor: c.surface, borderRadius: 16, padding: 16, marginBottom: 16 },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  locationLine: { width: 1, height: 16, backgroundColor: c.border, marginLeft: 5, marginVertical: 4 },
  locationInfo: { flex: 1 },
  locationLabel: { color: c.textMuted, fontSize: 10 },
  locationText: { color: '#FFF', fontSize: 13 },
  controls: { paddingHorizontal: 20, marginTop: 'auto', marginBottom: 16 },
  startButton: { backgroundColor: c.accent, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 18, borderRadius: 16, gap: 12 },
  startButtonText: { color: '#FFF', fontSize: 18, fontWeight: '700' },
  endButton: { backgroundColor: c.danger, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 18, borderRadius: 16, gap: 12 },
  endButtonText: { color: '#FFF', fontSize: 18, fontWeight: '700' },
  instructions: { color: c.textMuted, fontSize: 13, textAlign: 'center', lineHeight: 20, paddingHorizontal: 40, marginBottom: 20 },
});
