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
import { useSubscription } from '../src/store/subscriptionStore';
import { api } from '../src/services/api';

import { useColors } from '../src/context/ThemeContext';
import type { Palette } from '../src/theme';
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
  const c = useColors();
  const styles = makeStyles(c);
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
      color: c.danger,
      enabled: true,
      proFeature: true,
    },
    {
      id: 'receipt_reminder',
      title: 'Daily Receipt Reminder',
      description: 'Reminder to scan any receipts from today',
      icon: 'receipt',
      color: c.accent,
      enabled: false,
      proFeature: true,
    },
    {
      id: 'mileage_reminder',
      title: 'Mileage Logging',
      description: 'End of day reminder to log any trips',
      icon: 'car',
      color: c.accentAlt,
      enabled: false,
      proFeature: true,
    },
    {
      id: 'trip_complete',
      title: 'Trip Detection',
      description: 'Notification when a trip is detected (Max only)',
      icon: 'navigate',
      color: c.warning,
      enabled: true,
      proFeature: true,
    },
    {
      id: 'tax_deadline',
      title: 'Tax Filing Deadlines',
      description: 'Important IRS deadlines and extensions',
      icon: 'alert-circle',
      color: c.danger,
      enabled: true,
      proFeature: false,
    },
    {
      id: 'weekly_summary',
      title: 'Weekly Summary',
      description: 'Your earnings and deductions summary each week',
      icon: 'stats-chart',
      color: c.accent,
      enabled: false,
      proFeature: true,
    },
    {
      id: 'audit_risk',
      title: 'Audit Risk Alerts',
      description: 'Get alerted if your audit risk score increases',
      icon: 'shield',
      color: c.danger,
      enabled: true,
      proFeature: true,
    },
    {
      id: 'tips',
      title: 'Tax Saving Tips',
      description: 'Personalized tips to maximize deductions',
      icon: 'bulb',
      color: c.warning,
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
    // In-app reminder system - no OS permissions needed
    setPermissionStatus('granted');
  };

  const requestPermissions = async () => {
    // In-app reminder system - automatically granted
    setPermissionStatus('granted');
    Alert.alert('Reminders Enabled', 'You will receive in-app reminders for tax deadlines.');
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
        trackColor={{ false: c.border, true: setting.color }}
        thumbColor={c.text}
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
            <Ionicons name="notifications-off" size={24} color={c.warning} />
            <View style={styles.permissionInfo}>
              <Text style={styles.permissionTitle}>Notifications Disabled</Text>
              <Text style={styles.permissionText}>
                Enable notifications to get tax reminders
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={c.textMuted} />
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
            <ActivityIndicator color={c.accent} style={{ padding: 20 }} />
          ) : taxDates.length > 0 ? (
            taxDates.map((taxDate, index) => (
              <View key={taxDate.id} style={styles.dateItem}>
                <View style={[styles.dateDot, { backgroundColor: index === 0 ? c.danger : index === 1 ? c.warning : c.accentAlt }]} />
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
                <View style={[styles.dateDot, { backgroundColor: c.warning }]} />
                <View style={styles.dateInfo}>
                  <Text style={styles.dateTitle}>Q4 Estimated Tax Due</Text>
                  <Text style={styles.dateValue}>January 15, 2026</Text>
                </View>
                <Text style={styles.daysLeft}>185 days</Text>
              </View>
              <View style={styles.dateItem}>
                <View style={[styles.dateDot, { backgroundColor: c.accentAlt }]} />
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
  permissionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: c.warning + '15',
    borderRadius: 14,
    padding: 16,
    marginBottom: 24,
    gap: 12,
    borderWidth: 1,
    borderColor: c.warning + '30',
  },
  permissionInfo: {
    flex: 1,
  },
  permissionTitle: {
    color: c.text,
    fontSize: 15,
    fontWeight: '600',
  },
  permissionText: {
    color: c.warning,
    fontSize: 13,
    marginTop: 2,
  },
  sectionTitle: {
    color: c.textMuted,
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  section: {
    backgroundColor: c.surface,
    borderRadius: 14,
    marginBottom: 24,
    overflow: 'hidden',
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: c.surfaceAlt,
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
    color: c.text,
    fontSize: 15,
    fontWeight: '500',
  },
  proBadge: {
    backgroundColor: c.warning,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  proBadgeText: {
    color: c.bg,
    fontSize: 9,
    fontWeight: '700',
  },
  settingDescription: {
    color: c.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  datesCard: {
    backgroundColor: c.surface,
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
    backgroundColor: c.danger,
  },
  dateInfo: {
    flex: 1,
  },
  dateTitle: {
    color: c.text,
    fontSize: 14,
    fontWeight: '500',
  },
  dateValue: {
    color: c.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  daysLeft: {
    color: c.textMuted,
    fontSize: 12,
  },
});
