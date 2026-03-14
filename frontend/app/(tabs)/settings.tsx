import React from 'react';
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

interface SettingsItem {
  icon: string;
  label: string;
  sublabel?: string;
  color?: string;
  onPress?: () => void;
}

export default function SettingsScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();

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

  const sections = [
    {
      title: 'Tax Tools',
      items: [
        {
          icon: 'sparkles',
          label: 'AI Tax Coach',
          sublabel: 'Get personalized tax advice',
          color: '#FFB84D',
          onPress: () => router.push('/tax-coach'),
        },
        {
          icon: 'document-text',
          label: 'Export Reports',
          sublabel: 'Schedule C, mileage logs, CPA package',
          color: '#7C6BFF',
          onPress: () => router.push('/export-report'),
        },
        {
          icon: 'calculator',
          label: 'Quarterly Estimates',
          sublabel: 'View payment schedule',
          color: '#00D9A5',
        },
        {
          icon: 'shield-checkmark',
          label: 'Audit Risk Analysis',
          sublabel: 'Review your deduction safety',
          color: '#FF6B6B',
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
          color: '#6B6B7B',
        },
        {
          icon: 'briefcase',
          label: 'Profession Settings',
          sublabel: user?.profession || 'Update your work type',
          color: '#6B6B7B',
          onPress: () => router.push('/onboarding'),
        },
        {
          icon: 'link',
          label: 'Connected Platforms',
          sublabel: 'Uber, Lyft, DoorDash, etc.',
          color: '#6B6B7B',
        },
        {
          icon: 'notifications',
          label: 'Notifications',
          sublabel: 'Tax reminders & alerts',
          color: '#6B6B7B',
        },
        {
          icon: 'finger-print',
          label: 'Security',
          sublabel: 'Biometric login, 2FA',
          color: '#6B6B7B',
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
          color: '#6B6B7B',
        },
        {
          icon: 'chatbubbles',
          label: 'Contact Support',
          sublabel: 'Get help from our team',
          color: '#6B6B7B',
        },
        {
          icon: 'star',
          label: 'Rate TaxIQ Pro',
          sublabel: 'Help us improve',
          color: '#6B6B7B',
        },
      ],
    },
  ];

  const renderItem = (item: SettingsItem, index: number, isLast: boolean) => (
    <TouchableOpacity
      key={index}
      style={[styles.settingsItem, !isLast && styles.settingsItemBorder]}
      onPress={item.onPress}
    >
      <View style={[styles.itemIcon, { backgroundColor: `${item.color}20` }]}>
        <Ionicons name={item.icon as any} size={22} color={item.color} />
      </View>
      <View style={styles.itemContent}>
        <Text style={styles.itemLabel}>{item.label}</Text>
        {item.sublabel && (
          <Text style={styles.itemSublabel}>{item.sublabel}</Text>
        )}
      </View>
      <Ionicons name="chevron-forward" size={20} color="#4A4A5A" />
    </TouchableOpacity>
  );

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
        {/* Premium Banner */}
        <TouchableOpacity style={styles.premiumBanner}>
          <View style={styles.premiumContent}>
            <View style={styles.premiumIconContainer}>
              <Ionicons name="diamond" size={24} color="#FFB84D" />
            </View>
            <View style={styles.premiumText}>
              <Text style={styles.premiumTitle}>Upgrade to Pro</Text>
              <Text style={styles.premiumSubtitle}>
                Unlimited scans, AI deduction finder & more
              </Text>
            </View>
          </View>
          <Text style={styles.premiumPrice}>$9.99/mo</Text>
        </TouchableOpacity>

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
          <Ionicons name="log-out-outline" size={22} color="#FF6B6B" />
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>

        {/* App Info */}
        <View style={styles.appInfo}>
          <View style={styles.appLogoRow}>
            <Ionicons name="analytics" size={20} color="#00D9A5" />
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0F',
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  title: {
    color: '#FFFFFF',
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
  premiumBanner: {
    backgroundColor: '#1A1A22',
    borderRadius: 16,
    padding: 18,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#FFB84D30',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  premiumContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  premiumIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#FFB84D20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  premiumText: {
    marginLeft: 14,
    flex: 1,
  },
  premiumTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  premiumSubtitle: {
    color: '#6B6B7B',
    fontSize: 12,
    marginTop: 2,
  },
  premiumPrice: {
    color: '#FFB84D',
    fontSize: 16,
    fontWeight: '700',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    color: '#6B6B7B',
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  sectionContent: {
    backgroundColor: '#14141A',
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
    borderBottomColor: '#1A1A22',
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
  itemLabel: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '500',
  },
  itemSublabel: {
    color: '#6B6B7B',
    fontSize: 12,
    marginTop: 2,
  },
  signOutButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#14141A',
    borderRadius: 14,
    padding: 16,
    marginBottom: 24,
    gap: 8,
    borderWidth: 1,
    borderColor: '#FF6B6B30',
  },
  signOutText: {
    color: '#FF6B6B',
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
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  appCompany: {
    color: '#6B6B7B',
    fontSize: 12,
    marginTop: 4,
  },
  appVersion: {
    color: '#6B6B7B',
    fontSize: 12,
    marginTop: 2,
  },
  appCopyright: {
    color: '#4A4A5A',
    fontSize: 11,
    marginTop: 8,
  },
});
