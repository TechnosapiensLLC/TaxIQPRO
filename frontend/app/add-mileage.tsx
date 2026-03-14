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

const PURPOSES = [
  { id: 'Business', color: '#00D9A5', description: 'Work-related trips (deductible)' },
  { id: 'Personal', color: '#6B6B7B', description: 'Personal errands' },
  { id: 'Commute', color: '#FFB84D', description: 'To/from regular workplace' },
];

const IRS_MILEAGE_RATE = 0.70;

export default function AddMileageScreen() {
  const router = useRouter();
  const [startLocation, setStartLocation] = useState('');
  const [endLocation, setEndLocation] = useState('');
  const [distance, setDistance] = useState('');
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [purpose, setPurpose] = useState('Business');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [gettingLocation, setGettingLocation] = useState(false);

  const getCurrentLocation = async (type: 'start' | 'end') => {
    try {
      setGettingLocation(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location access is required');
        return;
      }

      const location = await Location.getCurrentPositionAsync({});
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
      } else {
        setEndLocation(locationString);
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
                placeholderTextColor="#4A4A5A"
              />
              <TouchableOpacity
                style={styles.locationButton}
                onPress={() => getCurrentLocation('start')}
                disabled={gettingLocation}
              >
                {gettingLocation ? (
                  <ActivityIndicator size="small" color="#00D9A5" />
                ) : (
                  <Ionicons name="locate" size={20} color="#00D9A5" />
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
                placeholderTextColor="#4A4A5A"
              />
              <TouchableOpacity
                style={styles.locationButton}
                onPress={() => getCurrentLocation('end')}
                disabled={gettingLocation}
              >
                {gettingLocation ? (
                  <ActivityIndicator size="small" color="#00D9A5" />
                ) : (
                  <Ionicons name="locate" size={20} color="#00D9A5" />
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* Distance */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Distance (miles)</Text>
            <TextInput
              style={styles.input}
              value={distance}
              onChangeText={setDistance}
              placeholder="0.0"
              placeholderTextColor="#4A4A5A"
              keyboardType="decimal-pad"
            />
          </View>

          {/* Date */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Date</Text>
            <TextInput
              style={styles.input}
              value={date}
              onChangeText={setDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor="#4A4A5A"
            />
          </View>

          {/* Deduction Preview */}
          {purpose === 'Business' && parseFloat(distance) > 0 && (
            <View style={styles.deductionPreview}>
              <Ionicons name="cash" size={20} color="#00D9A5" />
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
              placeholderTextColor="#4A4A5A"
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
    borderBottomWidth: 1,
    borderBottomColor: '#1A1A22',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  saveText: {
    color: '#7C6BFF',
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
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#14141A',
    borderRadius: 12,
    padding: 16,
    color: '#FFFFFF',
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#2A2A35',
  },
  purposeContainer: {
    gap: 10,
  },
  purposeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#14141A',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#2A2A35',
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
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '500',
  },
  purposeDescription: {
    color: '#6B6B7B',
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
    backgroundColor: '#14141A',
    borderRadius: 12,
    width: 52,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2A2A35',
  },
  deductionPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#00D9A515',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#00D9A530',
  },
  deductionText: {
    flex: 1,
    marginLeft: 12,
  },
  deductionLabel: {
    color: '#6B6B7B',
    fontSize: 12,
  },
  deductionValue: {
    color: '#00D9A5',
    fontSize: 20,
    fontWeight: '700',
  },
  deductionRate: {
    color: '#6B6B7B',
    fontSize: 12,
  },
  notesInput: {
    minHeight: 80,
    paddingTop: 14,
  },
});
