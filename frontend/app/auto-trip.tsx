import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Switch,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { useSubscription } from '../src/store/subscriptionStore';
import { api } from '../src/services/api';

import { useColors } from '../src/context/ThemeContext';
import type { Palette } from '../src/theme';
export default function AutoTripScreen() {
  const c = useColors();
  const styles = makeStyles(c);
  const router = useRouter();
  const { checkFeatureAccess } = useSubscription();
  const [autoDetectEnabled, setAutoDetectEnabled] = useState(false);
  const [locationPermission, setLocationPermission] = useState<string | null>(null);
  const [defaultTripType, setDefaultTripType] = useState<'business' | 'personal' | 'ask'>('ask');
  const [sensitivityLevel, setSensitivityLevel] = useState<'low' | 'medium' | 'high'>('medium');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!checkFeatureAccess('mileageTracking') || !checkFeatureAccess('bankStatementUpload')) {
      Alert.alert(
        'Max Feature',
        'Automatic trip detection is available on TaxIQ Max.',
        [
          { text: 'Cancel', onPress: () => router.back() },
          { text: 'Upgrade', onPress: () => router.push('/pricing') },
        ]
      );
      return;
    }
    checkPermissions();
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const settings = await api.getTripSettings();
      if (settings) {
        setAutoDetectEnabled(settings.auto_detect_enabled || false);
        setDefaultTripType(settings.default_trip_type || 'ask');
        setSensitivityLevel(settings.sensitivity_level || 'medium');
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      await api.saveTripSettings({
        auto_detect_enabled: autoDetectEnabled,
        default_trip_type: defaultTripType,
        sensitivity_level: sensitivityLevel,
      });
    } catch (error) {
      console.error('Failed to save settings:', error);
    }
    setSaving(false);
  };

  const checkPermissions = async () => {
    const { status } = await Location.getForegroundPermissionsAsync();
    setLocationPermission(status);
  };

  const requestPermissions = async () => {
    const { status: foreground } = await Location.requestForegroundPermissionsAsync();
    if (foreground === 'granted') {
      const { status: background } = await Location.requestBackgroundPermissionsAsync();
      setLocationPermission(background === 'granted' ? 'background' : foreground);
    } else {
      setLocationPermission(foreground);
    }
  };

  const handleToggleAutoDetect = async (value: boolean) => {
    if (value && locationPermission !== 'granted' && locationPermission !== 'background') {
      Alert.alert(
        'Location Permission Required',
        'Auto trip detection requires location access to work in the background.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Grant Access', onPress: requestPermissions },
        ]
      );
      return;
    }
    setAutoDetectEnabled(value);
    // Save immediately when toggled
    setTimeout(() => saveSettings(), 100);
  };

  const handleDefaultTripTypeChange = (type: 'business' | 'personal' | 'ask') => {
    setDefaultTripType(type);
    setTimeout(() => saveSettings(), 100);
  };

  const handleSensitivityChange = (level: 'low' | 'medium' | 'high') => {
    setSensitivityLevel(level);
    setTimeout(() => saveSettings(), 100);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Auto Trip Detection</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Hero Section */}
        <View style={styles.heroSection}>
          <View style={styles.heroIcon}>
            <Ionicons name="navigate" size={40} color={c.accentAlt} />
          </View>
          <Text style={styles.heroTitle}>Never Miss a Mile</Text>
          <Text style={styles.heroDescription}>
            TaxIQ automatically detects when you start driving and logs your trips—no manual entry required.
          </Text>
        </View>

        {/* Main Toggle */}
        <View style={styles.mainToggle}>
          <View style={styles.toggleInfo}>
            <Text style={styles.toggleTitle}>Enable Auto Detection</Text>
            <Text style={styles.toggleDescription}>
              Uses motion sensors and GPS to detect trips
            </Text>
          </View>
          <Switch
            value={autoDetectEnabled}
            onValueChange={handleToggleAutoDetect}
            trackColor={{ false: c.border, true: c.accentAlt }}
            thumbColor={c.text}
          />
        </View>

        {/* Permission Status */}
        <View style={styles.permissionCard}>
          <Ionicons
            name={locationPermission === 'granted' || locationPermission === 'background' ? 'shield-checkmark' : 'warning'}
            size={24}
            color={locationPermission === 'granted' || locationPermission === 'background' ? c.accent : c.warning}
          />
          <View style={styles.permissionInfo}>
            <Text style={styles.permissionTitle}>Location Permission</Text>
            <Text style={styles.permissionStatus}>
              {locationPermission === 'background'
                ? 'Background access granted'
                : locationPermission === 'granted'
                ? 'Foreground only - enable background for best results'
                : 'Not granted - required for auto detection'}
            </Text>
          </View>
          {locationPermission !== 'background' && (
            <TouchableOpacity style={styles.permissionButton} onPress={requestPermissions}>
              <Text style={styles.permissionButtonText}>Enable</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Settings */}
        <Text style={styles.sectionTitle}>Detection Settings</Text>

        {/* Default Trip Type */}
        <View style={styles.settingCard}>
          <Text style={styles.settingTitle}>Default Trip Classification</Text>
          <Text style={styles.settingDescription}>
            How should new trips be classified?
          </Text>
          <View style={styles.optionsRow}>
            {(['business', 'personal', 'ask'] as const).map((type) => (
              <TouchableOpacity
                key={type}
                style={[
                  styles.optionButton,
                  defaultTripType === type && styles.optionButtonActive,
                ]}
                onPress={() => handleDefaultTripTypeChange(type)}
              >
                <Text
                  style={[
                    styles.optionText,
                    defaultTripType === type && styles.optionTextActive,
                  ]}
                >
                  {type === 'ask' ? 'Ask Me' : type.charAt(0).toUpperCase() + type.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Sensitivity */}
        <View style={styles.settingCard}>
          <Text style={styles.settingTitle}>Detection Sensitivity</Text>
          <Text style={styles.settingDescription}>
            Higher sensitivity detects more trips but may include false positives
          </Text>
          <View style={styles.optionsRow}>
            {(['low', 'medium', 'high'] as const).map((level) => (
              <TouchableOpacity
                key={level}
                style={[
                  styles.optionButton,
                  sensitivityLevel === level && styles.optionButtonActive,
                ]}
                onPress={() => handleSensitivityChange(level)}
              >
                <Text
                  style={[
                    styles.optionText,
                    sensitivityLevel === level && styles.optionTextActive,
                  ]}
                >
                  {level.charAt(0).toUpperCase() + level.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* How It Works */}
        <Text style={styles.sectionTitle}>How It Works</Text>
        <View style={styles.howItWorks}>
          <View style={styles.howItWorksItem}>
            <View style={styles.howItWorksNumber}>
              <Text style={styles.howItWorksNumberText}>1</Text>
            </View>
            <View style={styles.howItWorksContent}>
              <Text style={styles.howItWorksTitle}>Detects Motion</Text>
              <Text style={styles.howItWorksDescription}>
                Uses accelerometer to detect vehicle movement
              </Text>
            </View>
          </View>
          <View style={styles.howItWorksItem}>
            <View style={styles.howItWorksNumber}>
              <Text style={styles.howItWorksNumberText}>2</Text>
            </View>
            <View style={styles.howItWorksContent}>
              <Text style={styles.howItWorksTitle}>Starts Tracking</Text>
              <Text style={styles.howItWorksDescription}>
                GPS logs your route and calculates distance
              </Text>
            </View>
          </View>
          <View style={styles.howItWorksItem}>
            <View style={styles.howItWorksNumber}>
              <Text style={styles.howItWorksNumberText}>3</Text>
            </View>
            <View style={styles.howItWorksContent}>
              <Text style={styles.howItWorksTitle}>Trip Complete</Text>
              <Text style={styles.howItWorksDescription}>
                Sends notification to classify as business or personal
              </Text>
            </View>
          </View>
        </View>

        {/* Battery Info */}
        <View style={styles.batteryInfo}>
          <Ionicons name="battery-half" size={20} color={c.textMuted} />
          <Text style={styles.batteryText}>
            Uses ~2-3% battery per day with optimized tracking
          </Text>
        </View>
      </ScrollView>
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
  },
  headerTitle: {
    color: c.text,
    fontSize: 18,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  heroSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  heroIcon: {
    width: 80,
    height: 80,
    borderRadius: 20,
    backgroundColor: c.accentAlt + '20',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  heroTitle: {
    color: c.text,
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 12,
  },
  heroDescription: {
    color: c.textMuted,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
  },
  mainToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: c.surface,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: c.accentAlt + '30',
  },
  toggleInfo: {
    flex: 1,
  },
  toggleTitle: {
    color: c.text,
    fontSize: 16,
    fontWeight: '600',
  },
  toggleDescription: {
    color: c.textMuted,
    fontSize: 13,
    marginTop: 4,
  },
  permissionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: c.surface,
    borderRadius: 14,
    padding: 16,
    marginBottom: 24,
    gap: 12,
  },
  permissionInfo: {
    flex: 1,
  },
  permissionTitle: {
    color: c.text,
    fontSize: 14,
    fontWeight: '500',
  },
  permissionStatus: {
    color: c.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  permissionButton: {
    backgroundColor: c.accentAlt,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  permissionButtonText: {
    color: c.onPrimary,
    fontSize: 13,
    fontWeight: '600',
  },
  sectionTitle: {
    color: c.text,
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  settingCard: {
    backgroundColor: c.surface,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  settingTitle: {
    color: c.text,
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  settingDescription: {
    color: c.textMuted,
    fontSize: 13,
    marginBottom: 16,
  },
  optionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  optionButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: c.surfaceAlt,
    alignItems: 'center',
  },
  optionButtonActive: {
    backgroundColor: c.accentAlt,
  },
  optionText: {
    color: c.textMuted,
    fontSize: 13,
    fontWeight: '500',
  },
  optionTextActive: {
    color: c.text,
  },
  howItWorks: {
    gap: 16,
    marginBottom: 24,
  },
  howItWorksItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
  },
  howItWorksNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: c.accentAlt,
    justifyContent: 'center',
    alignItems: 'center',
  },
  howItWorksNumberText: {
    color: c.onPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  howItWorksContent: {
    flex: 1,
  },
  howItWorksTitle: {
    color: c.text,
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  howItWorksDescription: {
    color: c.textMuted,
    fontSize: 13,
  },
  batteryInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  batteryText: {
    color: c.textMuted,
    fontSize: 12,
  },
});
