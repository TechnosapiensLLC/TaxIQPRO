import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Animated,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../src/context/AuthContext';

import { useColors, C } from '../src/context/ThemeContext';
import type { Palette } from '../src/theme';
const { width, height } = Dimensions.get('window');

const FEATURES = [
  {
    icon: 'camera',
    title: 'AI Receipt Scanning',
    description: 'Snap a photo and our AI extracts vendor, amount, date, and category in seconds',
    color: C.accent,
  },
  {
    icon: 'car',
    title: 'Smart Mileage Tracking',
    description: 'Automatic trip detection with IRS-compliant logging and deduction calculation',
    color: C.accentAlt,
  },
  {
    icon: 'calculator',
    title: 'Real-Time Tax Estimates',
    description: 'See your quarterly tax obligations update as you add expenses and income',
    color: C.warning,
  },
  {
    icon: 'shield-checkmark',
    title: 'Audit Risk Score',
    description: 'AI analyzes your deductions and warns you about potential audit triggers',
    color: C.danger,
  },
  {
    icon: 'chatbubbles',
    title: 'AI Tax Coach',
    description: 'Get personalized tax advice and deduction recommendations 24/7',
    color: C.accent,
  },
  {
    icon: 'document-text',
    title: 'IRS-Ready Exports',
    description: 'Generate Schedule C, mileage logs, and expense reports with one tap',
    color: C.accentAlt,
  },
];

const PROFESSIONS = [
  'Rideshare Driver', 'Delivery Driver', 'Freelancer', 'Consultant',
  'Real Estate Agent', 'Photographer', 'Content Creator', 'Contractor',
];

const STATS = [
  { value: '$4,200', label: 'Avg. Tax Savings' },
  { value: '73M+', label: 'Gig Workers in US' },
  { value: '15+', label: 'Gig Platforms' },
];

export default function LandingPage() {
  const c = useColors();
  const styles = makeStyles(c);
  const router = useRouter();
  const { isAuthenticated, isLoading, user } = useAuth();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      if (user?.onboarded) {
        router.replace('/(tabs)');
      } else {
        router.replace('/onboarding');
      }
    }
  }, [isLoading, isAuthenticated, user]);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <Ionicons name="pulse" size={48} color={c.accent} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <View style={styles.logoIcon}>
              <Ionicons name="analytics" size={24} color={c.accent} />
            </View>
            <Text style={styles.logoText}>TaxIQ Pro</Text>
          </View>
          <TouchableOpacity
            style={styles.loginButton}
            onPress={() => router.push('/login')}
          >
            <Text style={styles.loginButtonText}>Login</Text>
          </TouchableOpacity>
        </View>

        {/* Hero Section */}
        <Animated.View
          style={[
            styles.heroSection,
            { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
          ]}
        >
          <View style={styles.badgeContainer}>
            <View style={styles.badge}>
              <Ionicons name="sparkles" size={14} color={c.warning} />
              <Text style={styles.badgeText}>Powered by AI</Text>
            </View>
          </View>
          
          <Text style={styles.heroTitle}>
            The Intelligent Tax{"\n"}Deduction Platform
          </Text>
          <Text style={styles.heroSubtitle}>
            Maximize your deductions, minimize audit risk.{"\n"}
            Built for gig workers and self-employed professionals.
          </Text>

          <View style={styles.heroButtons}>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => router.push('/signup')}
            >
              <Text style={styles.primaryButtonText}>Start Free Trial</Text>
              <Ionicons name="arrow-forward" size={20} color="#FFF" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => router.push('/login')}
            >
              <Text style={styles.secondaryButtonText}>Sign In</Text>
            </TouchableOpacity>
          </View>

          {/* Stats */}
          <View style={styles.statsContainer}>
            {STATS.map((stat, index) => (
              <View key={index} style={styles.statItem}>
                <Text style={styles.statValue}>{stat.value}</Text>
                <Text style={styles.statLabel}>{stat.label}</Text>
              </View>
            ))}
          </View>
        </Animated.View>

        {/* Professions Scroll */}
        <View style={styles.professionsSection}>
          <Text style={styles.professionsTitle}>Built for</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.professionsScroll}
          >
            {PROFESSIONS.map((profession, index) => (
              <View key={index} style={styles.professionChip}>
                <Text style={styles.professionText}>{profession}</Text>
              </View>
            ))}
          </ScrollView>
        </View>

        {/* Features Section */}
        <View style={styles.featuresSection}>
          <Text style={styles.sectionTitle}>Powerful Features</Text>
          <Text style={styles.sectionSubtitle}>
            Everything you need to track expenses, maximize deductions, and stay IRS-compliant
          </Text>
          
          <View style={styles.featuresGrid}>
            {FEATURES.map((feature, index) => (
              <View key={index} style={styles.featureCard}>
                <View style={[styles.featureIcon, { backgroundColor: `${feature.color}20` }]}>
                  <Ionicons name={feature.icon as any} size={24} color={feature.color} />
                </View>
                <Text style={styles.featureTitle}>{feature.title}</Text>
                <Text style={styles.featureDescription}>{feature.description}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* About Section */}
        <View style={styles.aboutSection}>
          <Text style={styles.sectionTitle}>About TaxIQ Pro</Text>
          <Text style={styles.aboutText}>
            TaxIQ Pro is the flagship product of <Text style={styles.highlightText}>Technosapiens, LLC</Text>, 
            an AI-first technology company building intelligent solutions for modern workers.
          </Text>
          <Text style={styles.aboutText}>
            We leverage cutting-edge AI including Anthropic Claude Vision to deliver 
            industry-leading accuracy in receipt scanning, expense categorization, and 
            tax guidance—features that set us apart from legacy competitors.
          </Text>
          
          <View style={styles.differentiators}>
            <View style={styles.diffItem}>
              <Ionicons name="checkmark-circle" size={20} color={c.accent} />
              <Text style={styles.diffText}>MCC Code Intelligence</Text>
            </View>
            <View style={styles.diffItem}>
              <Ionicons name="checkmark-circle" size={20} color={c.accent} />
              <Text style={styles.diffText}>Bank Statement PDF Parsing</Text>
            </View>
            <View style={styles.diffItem}>
              <Ionicons name="checkmark-circle" size={20} color={c.accent} />
              <Text style={styles.diffText}>Voluntary Declaration with Audit Warnings</Text>
            </View>
            <View style={styles.diffItem}>
              <Ionicons name="checkmark-circle" size={20} color={c.accent} />
              <Text style={styles.diffText}>7-Year IRS Record Storage</Text>
            </View>
          </View>
        </View>

        {/* Pricing Preview */}
        <View style={styles.pricingSection}>
          <Text style={styles.sectionTitle}>Simple Pricing</Text>
          
          <View style={styles.pricingCards}>
            <View style={styles.pricingCard}>
              <Text style={styles.planName}>Starter</Text>
              <Text style={styles.planPrice}>Free</Text>
              <Text style={styles.planDescription}>Basic mileage & receipt tracking</Text>
              <View style={styles.planFeatures}>
                <Text style={styles.planFeature}>50 receipts/month</Text>
                <Text style={styles.planFeature}>Basic mileage log</Text>
                <Text style={styles.planFeature}>Tax estimates</Text>
              </View>
            </View>
            
            <View style={[styles.pricingCard, styles.popularCard]}>
              <View style={styles.popularBadge}>
                <Text style={styles.popularBadgeText}>Most Popular</Text>
              </View>
              <Text style={styles.planName}>Pro</Text>
              <Text style={styles.planPrice}>$9.99<Text style={styles.planPeriod}>/mo</Text></Text>
              <Text style={styles.planDescription}>Full features for gig workers</Text>
              <View style={styles.planFeatures}>
                <Text style={styles.planFeature}>Unlimited receipts</Text>
                <Text style={styles.planFeature}>Auto trip detection</Text>
                <Text style={styles.planFeature}>AI Tax Coach</Text>
                <Text style={styles.planFeature}>Audit risk score</Text>
                <Text style={styles.planFeature}>Export to TurboTax</Text>
              </View>
            </View>
          </View>
        </View>

        {/* CTA Section */}
        <View style={styles.ctaSection}>
          <Text style={styles.ctaTitle}>Ready to maximize your deductions?</Text>
          <Text style={styles.ctaSubtitle}>
            Join thousands of gig workers saving money on taxes
          </Text>
          <TouchableOpacity
            style={styles.ctaButton}
            onPress={() => router.push('/signup')}
          >
            <Text style={styles.ctaButtonText}>Get Started Free</Text>
            <Ionicons name="arrow-forward" size={20} color={c.bg} />
          </TouchableOpacity>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <View style={styles.footerLogo}>
            <Ionicons name="analytics" size={20} color={c.accent} />
            <Text style={styles.footerLogoText}>TaxIQ Pro</Text>
          </View>
          <Text style={styles.footerCompany}>A Technosapiens, LLC Product</Text>
          <Text style={styles.footerCopyright}>
            © 2025 Technosapiens, LLC. All rights reserved.
          </Text>
          <View style={styles.footerLinks}>
            <Text style={styles.footerLink}>Privacy Policy</Text>
            <Text style={styles.footerDivider}>•</Text>
            <Text style={styles.footerLink}>Terms of Service</Text>
            <Text style={styles.footerDivider}>•</Text>
            <Text style={styles.footerLink}>Contact</Text>
          </View>
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
  loadingContainer: {
    flex: 1,
    backgroundColor: c.bg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: c.accent + '20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoText: {
    color: c.text,
    fontSize: 20,
    fontWeight: '700',
    marginLeft: 10,
  },
  loginButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: c.border,
  },
  loginButtonText: {
    color: c.text,
    fontSize: 14,
    fontWeight: '600',
  },
  heroSection: {
    paddingHorizontal: 20,
    paddingTop: 30,
    paddingBottom: 40,
  },
  badgeContainer: {
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: c.warning + '15',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  badgeText: {
    color: c.warning,
    fontSize: 12,
    fontWeight: '600',
  },
  heroTitle: {
    color: c.text,
    fontSize: 36,
    fontWeight: '800',
    lineHeight: 44,
    marginBottom: 16,
  },
  heroSubtitle: {
    color: c.textTertiary,
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 30,
  },
  heroButtons: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 40,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: c.accent,
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 14,
    gap: 8,
  },
  primaryButtonText: {
    color: c.onPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryButton: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: c.border,
  },
  secondaryButtonText: {
    color: c.text,
    fontSize: 16,
    fontWeight: '600',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    color: c.accent,
    fontSize: 28,
    fontWeight: '800',
  },
  statLabel: {
    color: c.textMuted,
    fontSize: 12,
    marginTop: 4,
  },
  professionsSection: {
    paddingVertical: 20,
  },
  professionsTitle: {
    color: c.textMuted,
    fontSize: 14,
    fontWeight: '600',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  professionsScroll: {
    paddingHorizontal: 20,
    gap: 10,
  },
  professionChip: {
    backgroundColor: c.surface,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: c.border,
    marginRight: 10,
  },
  professionText: {
    color: c.text,
    fontSize: 13,
    fontWeight: '500',
  },
  featuresSection: {
    paddingHorizontal: 20,
    paddingVertical: 40,
  },
  sectionTitle: {
    color: c.text,
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 12,
  },
  sectionSubtitle: {
    color: c.textMuted,
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 30,
  },
  featuresGrid: {
    gap: 16,
  },
  featureCard: {
    backgroundColor: c.surface,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: c.surfaceAlt,
  },
  featureIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  featureTitle: {
    color: c.text,
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  featureDescription: {
    color: c.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  aboutSection: {
    paddingHorizontal: 20,
    paddingVertical: 40,
    backgroundColor: c.bgSunken,
  },
  aboutText: {
    color: c.textTertiary,
    fontSize: 15,
    lineHeight: 24,
    marginBottom: 16,
  },
  highlightText: {
    color: c.accent,
    fontWeight: '600',
  },
  differentiators: {
    marginTop: 20,
    gap: 12,
  },
  diffItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  diffText: {
    color: c.text,
    fontSize: 14,
    fontWeight: '500',
  },
  pricingSection: {
    paddingHorizontal: 20,
    paddingVertical: 40,
  },
  pricingCards: {
    gap: 16,
  },
  pricingCard: {
    backgroundColor: c.surface,
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: c.surfaceAlt,
  },
  popularCard: {
    borderColor: c.accent + '50',
    backgroundColor: c.brandTint,
  },
  popularBadge: {
    position: 'absolute',
    top: -12,
    right: 20,
    backgroundColor: c.accent,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 10,
  },
  popularBadgeText: {
    color: c.bg,
    fontSize: 11,
    fontWeight: '700',
  },
  planName: {
    color: c.textMuted,
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  planPrice: {
    color: c.text,
    fontSize: 36,
    fontWeight: '800',
    marginBottom: 8,
  },
  planPeriod: {
    color: c.textMuted,
    fontSize: 16,
    fontWeight: '500',
  },
  planDescription: {
    color: c.textMuted,
    fontSize: 14,
    marginBottom: 20,
  },
  planFeatures: {
    gap: 8,
  },
  planFeature: {
    color: c.text,
    fontSize: 14,
  },
  ctaSection: {
    paddingHorizontal: 20,
    paddingVertical: 50,
    alignItems: 'center',
    backgroundColor: c.bgSunken,
  },
  ctaTitle: {
    color: c.text,
    fontSize: 26,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 12,
  },
  ctaSubtitle: {
    color: c.textMuted,
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 24,
  },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: c.accent,
    paddingHorizontal: 32,
    paddingVertical: 18,
    borderRadius: 14,
    gap: 8,
  },
  ctaButtonText: {
    color: c.bg,
    fontSize: 18,
    fontWeight: '700',
  },
  footer: {
    paddingHorizontal: 20,
    paddingVertical: 40,
    alignItems: 'center',
  },
  footerLogo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  footerLogoText: {
    color: c.text,
    fontSize: 16,
    fontWeight: '700',
    marginLeft: 8,
  },
  footerCompany: {
    color: c.textMuted,
    fontSize: 13,
    marginBottom: 4,
  },
  footerCopyright: {
    color: c.borderStrong,
    fontSize: 12,
    marginBottom: 16,
  },
  footerLinks: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  footerLink: {
    color: c.textMuted,
    fontSize: 12,
  },
  footerDivider: {
    color: c.borderStrong,
    marginHorizontal: 8,
  },
});
