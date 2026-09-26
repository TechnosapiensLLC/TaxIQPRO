import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { api } from '../src/services/api';
import { format } from 'date-fns';

import { useColors, C } from '../src/context/ThemeContext';
import type { Palette } from '../src/theme';
const PURPOSES = [
  { id: 'Business', color: C.accent, description: 'Work-related trips (deductible)' },
  { id: 'Personal', color: C.textMuted, description: 'Personal errands' },
  { id: 'Commute', color: C.warning, description: 'To/from regular workplace' },
];

const IRS_MILEAGE_RATE = 0.70;

interface LocationCoords {
  lat: number;
  lng: number;
}

export default function AddMileageScreen() {
  const c = useColors();
  const styles = makeStyles(c);
  const router = useRouter();
  const [startLocation, setStartLocation] = useState('');
  const [endLocation, setEndLocation] = useState('');
  const [startCoords, setStartCoords] = useState<LocationCoords | null>(null);
  const [endCoords, setEndCoords] = useState<LocationCoords | null>(null);
  const [distance, setDistance] = useState('');
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [purpose, setPurpose] = useState('Business');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [gettingLocation, setGettingLocation] = useState(false);
  const [calculatingDistance, setCalculatingDistance] = useState(false);

  // Auto-calculate distance when both coordinates are available
  useEffect(() => {
    if (startCoords && endCoords) {
      calculateDistanceFromCoords();
    }
  }, [startCoords, endCoords]);

  const calculateDistanceFromCoords = async () => {
    if (!startCoords || !endCoords) return;
    
    setCalculatingDistance(true);
    try {
      const result = await api.calculateDistance(
        startCoords.lat,
        startCoords.lng,
        endCoords.lat,
        endCoords.lng
      );
      
      if (result && result.distance_miles) {
        setDistance(result.distance_miles.toFixed(1));
      }
    } catch (error) {
      console.error('Error calculating distance:', error);
    } finally {
      setCalculatingDistance(false);
    }
  };

  const getCurrentLocation = async (type: 'start' | 'end') => {
    try {
      setGettingLocation(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location access is required');
        return;
      }

      const location = await Location.getCurrentPositionAsync({});
      const coords = {
        lat: location.coords.latitude,
        lng: location.coords.longitude,
      };

      const [address] = await Location.reverseGeocodeAsync({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });

      const locationString = address
        ? `${address.street || ''} ${address.city || ''}, ${address.region || ''}`
            .trim()
            .replace(/^,\s*/, '')
        : `${location.coords.latitude.toFixed(4)}, ${location.coords.longitude.toFixed(4)}`;

      if (type === 'start') {
        setStartLocation(locationString);
        setStartCoords(coords);
      } else {
        setEndLocation(locationString);
        setEndCoords(coords);
      }
    } catch (error) {
      Alert.alert('Error', 'Could not get current location');
    } finally {
      setGettingLocation(false);
    }
  };

  const handleSave = async () => {
    if (!startLocation.trim()) {
      Alert.alert('Error', 'Please enter a start location');
      return;
    }
    if (!endLocation.trim()) {
      Alert.alert('Error', 'Please enter an end location');
      return;
    }
    if (!distance || parseFloat(distance) <= 0) {
      Alert.alert('Error', 'Please enter a valid distance');
      return;
    }

    try {
      setSaving(true);
      await api.createMileage({
        start_location: startLocation.trim(),
        end_location: endLocation.trim(),
        distance: parseFloat(distance),
        purpose,
        date,
        notes: notes.trim(),
      });
      router.back();
    } catch (error) {
      Alert.alert('Error', 'Failed to save trip');
    } finally {
      setSaving(false);
    }
  };

  const estimatedDeduction =
    purpose === 'Business' ? (parseFloat(distance) || 0) * IRS_MILEAGE_RATE : 0;

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="close" size={28} color="#FFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Log Trip</Text>
          <TouchableOpacity onPress={handleSave} disabled={saving}>
            <Text style={[styles.saveText, saving && { opacity: 0.5 }]}>
              {saving ? 'Saving...' : 'Save'}
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Purpose Selection */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Trip Purpose</Text>
            <View style={styles.purposeContainer}>
              {PURPOSES.map((p) => (
                <TouchableOpacity
                  key={p.id}
                  style={[
                    styles.purposeOption,
                    purpose === p.id && {
                      borderColor: p.color,
                      backgroundColor: `${p.color}15`,
                    },
                  ]}
                  onPress={() => setPurpose(p.id)}
                >
                  <View
                    style={[
                      styles.purposeDot,
                      { backgroundColor: p.color },
                    ]}
                  />
                  <View style={styles.purposeText}>
                    <Text
                      style={[
                        styles.purposeTitle,
                        purpose === p.id && { color: p.color },
                      ]}
                    >
                      {p.id}
                    </Text>
                    <Text style={styles.purposeDescription}>
                      {p.description}
                    </Text>
                  </View>
                  {purpose === p.id && (
                    <Ionicons name="checkmark-circle" size={20} color={p.color} />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Locations */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Start Location</Text>
            <View style={styles.locationContainer}>
              <TextInput
                style={[styles.input, styles.locationInput]}
                value={startLocation}
                onChangeText={setStartLocation}
                placeholder="Enter start address"
                placeholderTextColor={c.borderStrong}
              />
              <TouchableOpacity
                style={styles.locationButton}
                onPress={() => getCurrentLocation('start')}
                disabled={gettingLocation}
              >
                {gettingLocation ? (
                  <ActivityIndicator size="small" color={c.accent} />
                ) : (
                  <Ionicons name="locate" size={20} color={c.accent} />
                )}
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>End Location</Text>
            <View style={styles.locationContainer}>
              <TextInput
                style={[styles.input, styles.locationInput]}
                value={endLocation}
                onChangeText={setEndLocation}
                placeholder="Enter destination"
                placeholderTextColor={c.borderStrong}
              />
              <TouchableOpacity
                style={styles.locationButton}
                onPress={() => getCurrentLocation('end')}
                disabled={gettingLocation}
              >
                {gettingLocation ? (
                  <ActivityIndicator size="small" color={c.accent} />
                ) : (
                  <Ionicons name="locate" size={20} color={c.accent} />
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* Distance */}
          <View style={styles.inputGroup}>
            <View style={styles.distanceHeader}>
              <Text style={styles.label}>Distance (miles)</Text>
              {startCoords && endCoords && (
                <TouchableOpacity
                  style={styles.recalculateButton}
                  onPress={calculateDistanceFromCoords}
                  disabled={calculatingDistance}
                >
                  {calculatingDistance ? (
                    <ActivityIndicator size="small" color={c.accentAlt} />
                  ) : (
                    <>
                      <Ionicons name="refresh" size={14} color={c.accentAlt} />
                      <Text style={styles.recalculateText}>Recalculate</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
            </View>
            <View style={styles.distanceContainer}>
              <TextInput
                style={[styles.input, styles.distanceInput]}
                value={distance}
                onChangeText={setDistance}
                placeholder="0.0"
                placeholderTextColor={c.borderStrong}
                keyboardType="decimal-pad"
              />
              {calculatingDistance && (
                <View style={styles.calculatingOverlay}>
                  <ActivityIndicator size="small" color={c.accent} />
                  <Text style={styles.calculatingText}>Calculating...</Text>
                </View>
              )}
            </View>
            {startCoords && endCoords && distance && (
              <Text style={styles.distanceHint}>
                <Ionicons name="checkmark-circle" size={12} color={c.accent} /> Auto-calculated from GPS coordinates
              </Text>
            )}
          </View>

          {/* Date */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Date</Text>
            <TextInput
              style={styles.input}
              value={date}
              onChangeText={setDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={c.borderStrong}
            />
          </View>

          {/* Deduction Preview */}
          {purpose === 'Business' && parseFloat(distance) > 0 && (
            <View style={styles.deductionPreview}>
              <Ionicons name="cash" size={20} color={c.accent} />
              <View style={styles.deductionText}>
                <Text style={styles.deductionLabel}>Estimated Deduction</Text>
                <Text style={styles.deductionValue}>
                  ${estimatedDeduction.toFixed(2)}
                </Text>
              </View>
              <Text style={styles.deductionRate}>
                @ ${IRS_MILEAGE_RATE}/mi
              </Text>
            </View>
          )}

          {/* Notes */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Notes (optional)</Text>
            <TextInput
              style={[styles.input, styles.notesInput]}
              value={notes}
              onChangeText={setNotes}
              placeholder="e.g., Client meeting at downtown office"
              placeholderTextColor={c.borderStrong}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const makeStyles = (c: Palette) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: c.bg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: c.surfaceAlt,
  },
  headerTitle: {
    color: c.text,
    fontSize: 18,
    fontWeight: '600',
  },
  saveText: {
    color: c.accentAlt,
    fontSize: 16,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    color: c.text,
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  input: {
    backgroundColor: c.surface,
    borderRadius: 12,
    padding: 16,
    color: c.text,
    fontSize: 16,
    borderWidth: 1,
    borderColor: c.border,
  },
  purposeContainer: {
    gap: 10,
  },
  purposeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: c.surface,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: c.border,
  },
  purposeDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  purposeText: {
    flex: 1,
    marginLeft: 12,
  },
  purposeTitle: {
    color: c.text,
    fontSize: 15,
    fontWeight: '500',
  },
  purposeDescription: {
    color: c.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  locationContainer: {
    flexDirection: 'row',
    gap: 10,
  },
  locationInput: {
    flex: 1,
  },
  locationButton: {
    backgroundColor: c.surface,
    borderRadius: 12,
    width: 52,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: c.border,
  },
  distanceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  recalculateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: c.accentAlt + '15',
    borderRadius: 8,
  },
  recalculateText: {
    color: c.accentAlt,
    fontSize: 12,
    fontWeight: '500',
  },
  distanceContainer: {
    position: 'relative',
  },
  distanceInput: {
    flex: 1,
  },
  calculatingOverlay: {
    position: 'absolute',
    right: 12,
    top: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  calculatingText: {
    color: c.accent,
    fontSize: 12,
  },
  distanceHint: {
    color: c.accent,
    fontSize: 11,
    marginTop: 6,
  },
  deductionPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: c.accent + '15',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: c.accent + '30',
  },
  deductionText: {
    flex: 1,
    marginLeft: 12,
  },
  deductionLabel: {
    color: c.textMuted,
    fontSize: 12,
  },
  deductionValue: {
    color: c.accent,
    fontSize: 20,
    fontWeight: '700',
  },
  deductionRate: {
    color: c.textMuted,
    fontSize: 12,
  },
  notesInput: {
    minHeight: 80,
    paddingTop: 14,
  },
});
