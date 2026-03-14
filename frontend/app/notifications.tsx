import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Switch,
  Alert,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { useSubscription } from '../src/store/subscriptionStore';
import { api } from '../src/services/api';

interface NotificationSetting {
  id: string;
  title: string;
  description: string;
  icon: string;
  color: string;
  enabled: boolean;
  proFeature: boolean;
}

interface TaxDate {
  id: string;
  title: string;
  date: string;
  description: string;
  days_left: number;
}

export default function NotificationSettingsScreen() {
  const router = useRouter();
  const { checkFeatureAccess, currentTier } = useSubscription();
  const [permissionStatus, setPermissionStatus] = useState<string | null>(null);
  const [taxDates, setTaxDates] = useState<TaxDate[]>([]);
  const [loadingDates, setLoadingDates] = useState(true);
  const [settings, setSettings] = useState<NotificationSetting[]>([
    {
      id: 'quarterly_tax',
      title: 'Quarterly Tax Reminders',
      description: 'Get reminded 1 week before quarterly payments are due',
      icon: 'calendar',
      color: '#FF6B6B',
      enabled: true,
      proFeature: true,
    },
    {
      id: 'receipt_reminder',
      title: 'Daily Receipt Reminder',
      description: 'Reminder to scan any receipts from today',
      icon: 'receipt',
      color: '#00D9A5',
      enabled: false,
      proFeature: true,
    },
    {
      id: 'mileage_reminder',
      title: 'Mileage Logging',
      description: 'End of day reminder to log any trips',
      icon: 'car',
      color: '#7C6BFF',
      enabled: false,
      proFeature: true,
    },
    {
      id: 'trip_complete',
      title: 'Trip Detection',
      description: 'Notification when a trip is detected (Max only)',
      icon: 'navigate',
      color: '#FFB84D',
      enabled: true,
      proFeature: true,
    },
    {
      id: 'tax_deadline',
      title: 'Tax Filing Deadlines',
      description: 'Important IRS deadlines and extensions',
      icon: 'alert-circle',
      color: '#FF6B6B',
      enabled: true,
      proFeature: false,
    },
    {
      id: 'weekly_summary',
      title: 'Weekly Summary',
      description: 'Your earnings and deductions summary each week',
      icon: 'stats-chart',
      color: '#00D9A5',
      enabled: false,
      proFeature: true,
    },
    {
      id: 'audit_risk',
      title: 'Audit Risk Alerts',
      description: 'Get alerted if your audit risk score increases',
      icon: 'shield',
      color: '#FF6B6B',
      enabled: true,
      proFeature: true,
    },
    {
      id: 'tips',
      title: 'Tax Saving Tips',
      description: 'Personalized tips to maximize deductions',
      icon: 'bulb',
      color: '#FFB84D',
      enabled: false,
      proFeature: true,
    },
  ]);

  useEffect(() => {
    checkNotificationPermissions();
    loadTaxDates();
  }, []);

  const loadTaxDates = async () => {
    try {
      const dates = await api.getTaxDates();
      setTaxDates(dates);
    } catch (error) {
      console.error('Failed to load tax dates:', error);
    } finally {
      setLoadingDates(false);
    }
  };

  const checkNotificationPermissions = async () => {
    const { status } = await Notifications.getPermissionsAsync();
    setPermissionStatus(status);
  };

  const requestPermissions = async () => {
    const { status } = await Notifications.requestPermissionsAsync();
    setPermissionStatus(status);
    if (status !== 'granted') {
      Alert.alert(
        'Permission Denied',
        'Please enable notifications in your device settings to receive tax reminders.'
      );
    }
  };

  const toggleSetting = (id: string) => {
    const setting = settings.find(s => s.id === id);
    if (setting?.proFeature && !checkFeatureAccess('pushNotifications')) {
      Alert.alert(
        'Pro Feature',
        'Push notifications are available on TaxIQ Pro and above.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Upgrade', onPress: () => router.push('/pricing') },
        ]
      );
      return;
    }

    setSettings(prev =>
      prev.map(s => (s.id === id ? { ...s, enabled: !s.enabled } : s))
    );
  };

  // Group notifications by category
  const taxReminders = settings.filter(s => ['quarterly_tax', 'tax_deadline', 'audit_risk'].includes(s.id));
  const trackingReminders = settings.filter(s => ['receipt_reminder', 'mileage_reminder', 'trip_complete'].includes(s.id));
  const insights = settings.filter(s => ['weekly_summary', 'tips'].includes(s.id));

  const renderSettingItem = (setting: NotificationSetting) => (
    <View key={setting.id} style={styles.settingItem}>
      <View style={[styles.settingIcon, { backgroundColor: `${setting.color}20` }]}>
        <Ionicons name={setting.icon as any} size={22} color={setting.color} />
      </View>
      <View style={styles.settingInfo}>
        <View style={styles.settingTitleRow}>
          <Text style={styles.settingTitle}>{setting.title}</Text>
          {setting.proFeature && currentTier === 'free' && (
            <View style={styles.proBadge}>
              <Text style={styles.proBadgeText}>PRO</Text>
            </View>
          )}
        </View>
        <Text style={styles.settingDescription}>{setting.description}</Text>
      </View>
      <Switch
        value={setting.enabled && (checkFeatureAccess('pushNotifications') || !setting.proFeature)}
        onValueChange={() => toggleSetting(setting.id)}
        trackColor={{ false: '#2A2A35', true: setting.color }}
        thumbColor="#FFFFFF"
      />
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Permission Status */}
        {permissionStatus !== 'granted' && (
          <TouchableOpacity style={styles.permissionBanner} onPress={requestPermissions}>
            <Ionicons name="notifications-off" size={24} color="#FFB84D" />
            <View style={styles.permissionInfo}>
              <Text style={styles.permissionTitle}>Notifications Disabled</Text>
              <Text style={styles.permissionText}>
                Enable notifications to get tax reminders
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#6B6B7B" />
          </TouchableOpacity>
        )}

        {/* Tax Reminders */}
        <Text style={styles.sectionTitle}>Tax Reminders</Text>
        <View style={styles.section}>
          {taxReminders.map(renderSettingItem)}
        </View>

        {/* Tracking Reminders */}
        <Text style={styles.sectionTitle}>Tracking Reminders</Text>
        <View style={styles.section}>
          {trackingReminders.map(renderSettingItem)}
        </View>

        {/* Insights */}
        <Text style={styles.sectionTitle}>Insights & Tips</Text>
        <View style={styles.section}>
          {insights.map(renderSettingItem)}
        </View>

        {/* Upcoming Tax Dates */}
        <Text style={styles.sectionTitle}>Upcoming Tax Dates</Text>
        <View style={styles.datesCard}>
          {loadingDates ? (
            <ActivityIndicator color="#00D9A5" style={{ padding: 20 }} />
          ) : taxDates.length > 0 ? (
            taxDates.map((taxDate, index) => (
              <View key={taxDate.id} style={styles.dateItem}>
                <View style={[styles.dateDot, { backgroundColor: index === 0 ? '#FF6B6B' : index === 1 ? '#FFB84D' : '#7C6BFF' }]} />
                <View style={styles.dateInfo}>
                  <Text style={styles.dateTitle}>{taxDate.title}</Text>
                  <Text style={styles.dateValue}>{taxDate.date}</Text>
                </View>
                <Text style={styles.daysLeft}>{taxDate.days_left} days</Text>
              </View>
            ))
          ) : (
            <>
              <View style={styles.dateItem}>
                <View style={styles.dateDot} />
                <View style={styles.dateInfo}>
                  <Text style={styles.dateTitle}>Q3 Estimated Tax Due</Text>
                  <Text style={styles.dateValue}>September 15, 2025</Text>
                </View>
                <Text style={styles.daysLeft}>63 days</Text>
              </View>
              <View style={styles.dateItem}>
                <View style={[styles.dateDot, { backgroundColor: '#FFB84D' }]} />
                <View style={styles.dateInfo}>
                  <Text style={styles.dateTitle}>Q4 Estimated Tax Due</Text>
                  <Text style={styles.dateValue}>January 15, 2026</Text>
                </View>
                <Text style={styles.daysLeft}>185 days</Text>
              </View>
              <View style={styles.dateItem}>
                <View style={[styles.dateDot, { backgroundColor: '#7C6BFF' }]} />
                <View style={styles.dateInfo}>
                  <Text style={styles.dateTitle}>Tax Filing Deadline</Text>
                  <Text style={styles.dateValue}>April 15, 2026</Text>
                </View>
                <Text style={styles.daysLeft}>275 days</Text>
              </View>
            </>
          )}
        </View>
      </ScrollView>
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  permissionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFB84D15',
    borderRadius: 14,
    padding: 16,
    marginBottom: 24,
    gap: 12,
    borderWidth: 1,
    borderColor: '#FFB84D30',
  },
  permissionInfo: {
    flex: 1,
  },
  permissionTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  permissionText: {
    color: '#FFB84D',
    fontSize: 13,
    marginTop: 2,
  },
  sectionTitle: {
    color: '#6B6B7B',
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  section: {
    backgroundColor: '#14141A',
    borderRadius: 14,
    marginBottom: 24,
    overflow: 'hidden',
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1A1A22',
  },
  settingIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  settingInfo: {
    flex: 1,
    marginLeft: 14,
  },
  settingTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  settingTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '500',
  },
  proBadge: {
    backgroundColor: '#FFB84D',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  proBadgeText: {
    color: '#0A0A0F',
    fontSize: 9,
    fontWeight: '700',
  },
  settingDescription: {
    color: '#6B6B7B',
    fontSize: 12,
    marginTop: 2,
  },
  datesCard: {
    backgroundColor: '#14141A',
    borderRadius: 14,
    padding: 4,
  },
  dateItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
  },
  dateDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FF6B6B',
  },
  dateInfo: {
    flex: 1,
  },
  dateTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
  dateValue: {
    color: '#6B6B7B',
    fontSize: 12,
    marginTop: 2,
  },
  daysLeft: {
    color: '#6B6B7B',
    fontSize: 12,
  },
});
