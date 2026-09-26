import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';
import { useSubscription, SUBSCRIPTION_PLANS } from '../../src/store/subscriptionStore';

import { useColors, useTheme } from '../../src/context/ThemeContext';
import type { Palette } from '../../src/theme';
interface SettingsItem {
  icon: string;
  label: string;
  sublabel?: string;
  color?: string;
  tier?: 'free' | 'pro' | 'max';
  onPress?: () => void;
}

export default function SettingsScreen() {
  const c = useColors();
  const { mode, setMode } = useTheme();
  const styles = makeStyles(c);
  const router = useRouter();
  const { user, logout } = useAuth();
  const { currentTier, loadSubscription, getCurrentPlan } = useSubscription();

  useEffect(() => {
    loadSubscription();
  }, []);

  const handleLogout = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign Out', style: 'destructive', onPress: logout },
      ]
    );
  };

  const checkAccess = (requiredTier: 'pro' | 'max') => {
    const tierOrder = { free: 0, pro: 1, max: 2 };
    return tierOrder[currentTier] >= tierOrder[requiredTier];
  };

  const handleFeaturePress = (item: SettingsItem) => {
    if (item.tier && !checkAccess(item.tier)) {
      Alert.alert(
        `${item.tier === 'max' ? 'TaxIQ Max' : 'TaxIQ Pro'} Feature`,
        `${item.label} is available on ${item.tier === 'max' ? 'TaxIQ Max' : 'TaxIQ Pro and above'}.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Upgrade', onPress: () => router.push('/pricing') },
        ]
      );
      return;
    }
    item.onPress?.();
  };

  const plan = getCurrentPlan();

  const sections = [
    {
      title: 'Power Features',
      items: [
        {
          icon: 'analytics',
          label: 'Tax Filing Analyzer',
          sublabel: 'AI reviews filings for missed deductions & S-Corp',
          color: c.accentAlt,
          onPress: () => router.push('/tax-analyzer'),
        },
        {
          icon: 'sparkles',
          label: 'AI Tax Coach',
          sublabel: 'Get personalized tax advice',
          color: c.warning,
          onPress: () => router.push('/tax-coach'),
        },
        {
          icon: 'flame',
          label: 'Gas Finder',
          sublabel: 'Find cheapest gas near you',
          color: c.danger,
          onPress: () => router.push('/gas-finder'),
        },
        {
          icon: 'swap-horizontal',
          label: 'Swipe to Classify',
          sublabel: 'Quickly categorize expenses',
          color: c.accent,
          tier: 'pro' as const,
          onPress: () => router.push('/swipe-classify'),
        },
        {
          icon: 'cloud-upload',
          label: 'Import CSV Earnings',
          sublabel: 'Import from Uber, Lyft, DoorDash',
          color: c.accentAlt,
          tier: 'pro' as const,
          onPress: () => router.push('/import-csv'),
        },
        {
          icon: 'document-text',
          label: 'Bank Statement Upload',
          sublabel: 'AI extracts deductions from PDFs',
          color: c.accentAlt,
          tier: 'max' as const,
          onPress: () => router.push('/bank-statement'),
        },
        {
          icon: 'navigate',
          label: 'Auto Trip Detection',
          sublabel: 'Never miss a deductible mile',
          color: c.accentAlt,
          tier: 'max' as const,
          onPress: () => router.push('/auto-trip'),
        },
      ],
    },
    {
      title: 'Tax Tools',
      items: [
        {
          icon: 'trending-up',
          label: 'Deduction Maximizer',
          sublabel: 'Find deductions you may be missing',
          color: c.accent,
          onPress: () => router.push('/deduction-maximizer'),
        },
        {
          icon: 'calculator',
          label: 'Quarterly Estimates',
          sublabel: 'Calculate your estimated tax payments',
          color: c.accentAlt,
          onPress: () => router.push('/quarterly-estimator'),
        },
        {
          icon: 'document-text',
          label: 'Export Reports',
          sublabel: 'Schedule C, mileage logs, CPA package',
          color: c.warning,
          onPress: () => router.push('/export-report'),
        },
        {
          icon: 'shield-checkmark',
          label: 'Audit Risk Analysis',
          sublabel: 'Review your deduction safety',
          color: c.danger,
        },
      ],
    },
    {
      title: 'Store Chain',
      items: [
        {
          icon: 'storefront',
          label: 'Stores & Team',
          sublabel: 'Manage stores, managers and drivers',
          color: c.accent,
          onPress: () => router.push('/store-chain'),
        },
        {
          icon: 'calculator',
          label: 'Accounting Export',
          sublabel: 'QuickBooks, Xero and Sage import files',
          color: c.accentAlt,
          onPress: () => router.push('/export-report'),
        },
        {
          icon: 'options',
          label: 'Chart of Accounts',
          sublabel: 'Map categories to your accounting file',
          color: c.warning,
          onPress: () => router.push('/coa-mapping'),
        },
      ],
    },
    {
      title: 'Account',
      items: [
        {
          icon: 'person',
          label: 'Profile',
          sublabel: user?.email || 'Manage your account',
          color: c.textMuted,
        },
        {
          icon: 'briefcase',
          label: 'Profession Settings',
          sublabel: 'Update your work type',
          color: c.textMuted,
          onPress: () => router.push('/onboarding'),
        },
        {
          icon: 'notifications',
          label: 'Notifications',
          sublabel: 'Tax reminders & alerts',
          color: c.textMuted,
          onPress: () => router.push('/notifications'),
        },
        {
          icon: 'finger-print',
          label: 'Security',
          sublabel: 'Biometric login, 2FA',
          color: c.textMuted,
        },
      ],
    },
    {
      title: 'Support',
      items: [
        {
          icon: 'help-circle',
          label: 'Help Center',
          sublabel: 'FAQs and guides',
          color: c.textMuted,
        },
        {
          icon: 'chatbubbles',
          label: 'Contact Support',
          sublabel: 'Get help from our team',
          color: c.textMuted,
        },
        {
          icon: 'star',
          label: 'Rate TaxIQ Pro',
          sublabel: 'Help us improve',
          color: c.textMuted,
        },
      ],
    },
  ];

  const renderItem = (item: SettingsItem, index: number, isLast: boolean) => {
    const isLocked = item.tier && !checkAccess(item.tier);
    
    return (
      <TouchableOpacity
        key={index}
        style={[styles.settingsItem, !isLast && styles.settingsItemBorder]}
        onPress={() => handleFeaturePress(item)}
      >
        <View style={[styles.itemIcon, { backgroundColor: `${item.color}20` }]}>
          <Ionicons name={item.icon as any} size={22} color={item.color} />
        </View>
        <View style={styles.itemContent}>
          <View style={styles.itemTitleRow}>
            <Text style={[styles.itemLabel, isLocked && styles.itemLabelLocked]}>
              {item.label}
            </Text>
            {item.tier && (
              <View style={[
                styles.tierBadge,
                item.tier === 'max' ? styles.tierBadgeMax : styles.tierBadgePro
              ]}>
                <Text style={styles.tierBadgeText}>
                  {item.tier === 'max' ? 'MAX' : 'PRO'}
                </Text>
              </View>
            )}
          </View>
          {item.sublabel && (
            <Text style={styles.itemSublabel}>{item.sublabel}</Text>
          )}
        </View>
        {isLocked ? (
          <Ionicons name="lock-closed" size={18} color={c.borderStrong} />
        ) : (
          <Ionicons name="chevron-forward" size={20} color={c.borderStrong} />
        )}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Settings</Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Subscription Status */}
        <TouchableOpacity 
          style={styles.subscriptionBanner}
          onPress={() => router.push('/pricing')}
        >
          <View style={styles.subscriptionContent}>
            <View style={[
              styles.subscriptionIcon,
              currentTier === 'max' ? styles.maxIcon : 
              currentTier === 'pro' ? styles.proIcon : styles.freeIcon
            ]}>
              <Ionicons 
                name={currentTier === 'free' ? 'person' : 'diamond'} 
                size={24} 
                color={currentTier === 'max' ? c.accentAlt : currentTier === 'pro' ? c.accent : c.textMuted} 
              />
            </View>
            <View style={styles.subscriptionText}>
              <Text style={styles.subscriptionTitle}>{plan.name}</Text>
              <Text style={styles.subscriptionSubtitle}>
                {currentTier === 'free' 
                  ? 'Upgrade to unlock all features' 
                  : currentTier === 'pro'
                  ? 'Upgrade to Max for auto trip detection'
                  : 'You have access to all features'}
              </Text>
            </View>
          </View>
          {currentTier !== 'max' && (
            <View style={styles.upgradeBadge}>
              <Text style={styles.upgradeBadgeText}>Upgrade</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Appearance */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Appearance</Text>
          <View style={styles.sectionContent}>
            <View style={styles.themeRow}>
              {(['light', 'dark', 'system'] as const).map((m) => (
                <TouchableOpacity
                  key={m}
                  style={[styles.themeChip, mode === m && styles.themeChipActive]}
                  onPress={() => setMode(m)}
                >
                  <Ionicons
                    name={m === 'light' ? 'sunny' : m === 'dark' ? 'moon' : 'phone-portrait'}
                    size={18}
                    color={mode === m ? c.onPrimary : c.textMuted}
                  />
                  <Text style={[styles.themeChipText, mode === m && styles.themeChipTextActive]}>
                    {m === 'system' ? 'Auto' : m === 'light' ? 'Light' : 'Dark'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {sections.map((section, sectionIndex) => (
          <View key={sectionIndex} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <View style={styles.sectionContent}>
              {section.items.map((item, index) =>
                renderItem(item, index, index === section.items.length - 1)
              )}
            </View>
          </View>
        ))}

        {/* Sign Out Button */}
        <TouchableOpacity style={styles.signOutButton} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={22} color={c.danger} />
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>

        {/* App Info */}
        <View style={styles.appInfo}>
          <View style={styles.appLogoRow}>
            <Ionicons name="analytics" size={20} color={c.accent} />
            <Text style={styles.appName}>TaxIQ Pro</Text>
          </View>
          <Text style={styles.appCompany}>A Technosapiens, LLC Product</Text>
          <Text style={styles.appVersion}>Version 1.0.0</Text>
          <Text style={styles.appCopyright}>
            © 2025 Technosapiens, LLC. All rights reserved.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (c: Palette) => StyleSheet.create({
  themeRow: {
    flexDirection: 'row',
    gap: 10,
    padding: 14,
  },
  themeChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: c.surfaceAlt,
    borderWidth: 1,
    borderColor: c.border,
    minHeight: 48,
  },
  themeChipActive: {
    backgroundColor: c.accent,
    borderColor: c.accent,
  },
  themeChipText: {
    color: c.textMuted,
    fontSize: 14,
    fontWeight: '600',
  },
  themeChipTextActive: {
    color: c.onPrimary,
  },
  container: {
    flex: 1,
    backgroundColor: c.bg,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  title: {
    color: c.text,
    fontSize: 28,
    fontWeight: '700',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  subscriptionBanner: {
    backgroundColor: c.surface,
    borderRadius: 16,
    padding: 18,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: c.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  subscriptionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  subscriptionIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  freeIcon: {
    backgroundColor: c.textMuted + '20',
  },
  proIcon: {
    backgroundColor: c.accent + '20',
  },
  maxIcon: {
    backgroundColor: c.accentAlt + '20',
  },
  subscriptionText: {
    marginLeft: 14,
    flex: 1,
  },
  subscriptionTitle: {
    color: c.text,
    fontSize: 17,
    fontWeight: '600',
  },
  subscriptionSubtitle: {
    color: c.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  upgradeBadge: {
    backgroundColor: c.accent,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  upgradeBadgeText: {
    color: c.onPrimary,
    fontSize: 12,
    fontWeight: '600',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    color: c.textMuted,
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  sectionContent: {
    backgroundColor: c.surface,
    borderRadius: 14,
    overflow: 'hidden',
  },
  settingsItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  settingsItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: c.surfaceAlt,
  },
  itemIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemContent: {
    flex: 1,
    marginLeft: 14,
  },
  itemTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  itemLabel: {
    color: c.text,
    fontSize: 15,
    fontWeight: '500',
  },
  itemLabelLocked: {
    color: c.textMuted,
  },
  tierBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  tierBadgePro: {
    backgroundColor: c.accent,
  },
  tierBadgeMax: {
    backgroundColor: c.accentAlt,
  },
  tierBadgeText: {
    color: c.text,
    fontSize: 9,
    fontWeight: '700',
  },
  itemSublabel: {
    color: c.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  signOutButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: c.surface,
    borderRadius: 14,
    padding: 16,
    marginBottom: 24,
    gap: 8,
    borderWidth: 1,
    borderColor: c.danger + '30',
  },
  signOutText: {
    color: c.danger,
    fontSize: 16,
    fontWeight: '600',
  },
  appInfo: {
    alignItems: 'center',
    paddingTop: 10,
  },
  appLogoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  appName: {
    color: c.text,
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  appCompany: {
    color: c.textMuted,
    fontSize: 12,
    marginTop: 4,
  },
  appVersion: {
    color: c.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  appCopyright: {
    color: c.borderStrong,
    fontSize: 11,
    marginTop: 8,
  },
});
