import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSubscription, SUBSCRIPTION_PLANS, SubscriptionTier } from '../src/store/subscriptionStore';

import { useColors } from '../src/context/ThemeContext';
import type { Palette } from '../src/theme';
const { width } = Dimensions.get('window');

export default function PricingScreen() {
  const c = useColors();
  const styles = makeStyles(c);
  const router = useRouter();
  const { currentTier, setTier } = useSubscription();
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionTier>(currentTier);

  const handleUpgrade = async (tier: SubscriptionTier) => {
    if (tier === 'free') {
      await setTier(tier);
      Alert.alert('Success', 'You are now on TaxIQ Free');
      router.back();
      return;
    }

    // In production, this would open payment sheet
    Alert.alert(
      'Upgrade to ' + SUBSCRIPTION_PLANS[tier].name,
      `This would open the payment flow for $${billingCycle === 'monthly' ? SUBSCRIPTION_PLANS[tier].price : SUBSCRIPTION_PLANS[tier].priceYearly}/${billingCycle === 'monthly' ? 'mo' : 'yr'}. For this demo, we'll activate it directly.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Activate',
          onPress: async () => {
            await setTier(tier);
            Alert.alert('Success', `You are now on ${SUBSCRIPTION_PLANS[tier].name}!`);
            router.back();
          },
        },
      ]
    );
  };

  const plans = Object.values(SUBSCRIPTION_PLANS);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="close" size={28} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Choose Your Plan</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Billing Toggle */}
        <View style={styles.billingToggle}>
          <TouchableOpacity
            style={[
              styles.billingOption,
              billingCycle === 'monthly' && styles.billingOptionActive,
            ]}
            onPress={() => setBillingCycle('monthly')}
          >
            <Text
              style={[
                styles.billingOptionText,
                billingCycle === 'monthly' && styles.billingOptionTextActive,
              ]}
            >
              Monthly
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.billingOption,
              billingCycle === 'yearly' && styles.billingOptionActive,
            ]}
            onPress={() => setBillingCycle('yearly')}
          >
            <Text
              style={[
                styles.billingOptionText,
                billingCycle === 'yearly' && styles.billingOptionTextActive,
              ]}
            >
              Yearly
            </Text>
            <View style={styles.saveBadge}>
              <Text style={styles.saveBadgeText}>Save 17%</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Plan Cards */}
        {plans.map((plan) => {
          const isCurrentPlan = currentTier === plan.id;
          const isPopular = plan.id === 'pro';
          const price = billingCycle === 'monthly' ? plan.price : plan.priceYearly;

          return (
            <TouchableOpacity
              key={plan.id}
              style={[
                styles.planCard,
                isPopular && styles.planCardPopular,
                isCurrentPlan && styles.planCardCurrent,
              ]}
              onPress={() => setSelectedPlan(plan.id)}
            >
              {isPopular && (
                <View style={styles.popularBadge}>
                  <Ionicons name="star" size={12} color={c.bg} />
                  <Text style={styles.popularBadgeText}>Most Popular</Text>
                </View>
              )}

              <View style={styles.planHeader}>
                <View>
                  <Text style={styles.planName}>{plan.name}</Text>
                  <Text style={styles.planTagline}>{plan.tagline}</Text>
                </View>
                {isCurrentPlan && (
                  <View style={styles.currentBadge}>
                    <Text style={styles.currentBadgeText}>Current</Text>
                  </View>
                )}
              </View>

              <View style={styles.priceRow}>
                <Text style={styles.priceAmount}>
                  {price === 0 ? 'Free' : `$${price}`}
                </Text>
                {price > 0 && (
                  <Text style={styles.pricePeriod}>
                    /{billingCycle === 'monthly' ? 'mo' : 'yr'}
                  </Text>
                )}
              </View>

              <View style={styles.featuresList}>
                {plan.features.map((feature, index) => (
                  <View key={index} style={styles.featureItem}>
                    <Ionicons
                      name="checkmark-circle"
                      size={18}
                      color={plan.id === 'free' ? c.textMuted : c.accent}
                    />
                    <Text style={styles.featureText}>{feature}</Text>
                  </View>
                ))}
              </View>

              <TouchableOpacity
                style={[
                  styles.selectButton,
                  isCurrentPlan && styles.selectButtonCurrent,
                  isPopular && !isCurrentPlan && styles.selectButtonPopular,
                ]}
                onPress={() => handleUpgrade(plan.id)}
                disabled={isCurrentPlan}
              >
                <Text
                  style={[
                    styles.selectButtonText,
                    isCurrentPlan && styles.selectButtonTextCurrent,
                  ]}
                >
                  {isCurrentPlan
                    ? 'Current Plan'
                    : plan.id === 'free'
                    ? 'Downgrade'
                    : 'Upgrade'}
                </Text>
              </TouchableOpacity>
            </TouchableOpacity>
          );
        })}

        {/* Money Back Guarantee */}
        <View style={styles.guarantee}>
          <Ionicons name="shield-checkmark" size={24} color={c.accent} />
          <View style={styles.guaranteeText}>
            <Text style={styles.guaranteeTitle}>30-Day Money Back Guarantee</Text>
            <Text style={styles.guaranteeDescription}>
              Not satisfied? Get a full refund within 30 days, no questions asked.
            </Text>
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
  billingToggle: {
    flexDirection: 'row',
    backgroundColor: c.surface,
    borderRadius: 12,
    padding: 4,
    marginBottom: 24,
  },
  billingOption: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    gap: 6,
  },
  billingOptionActive: {
    backgroundColor: c.accent,
  },
  billingOptionText: {
    color: c.textMuted,
    fontSize: 14,
    fontWeight: '600',
  },
  billingOptionTextActive: {
    color: c.text,
  },
  saveBadge: {
    backgroundColor: c.warning,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  saveBadgeText: {
    color: c.bg,
    fontSize: 10,
    fontWeight: '700',
  },
  planCard: {
    backgroundColor: c.surface,
    borderRadius: 20,
    padding: 24,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  planCardPopular: {
    borderColor: c.accent + '50',
    backgroundColor: c.brandTint,
  },
  planCardCurrent: {
    borderColor: c.accentAlt + '50',
  },
  popularBadge: {
    position: 'absolute',
    top: -12,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: c.accent,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    gap: 4,
  },
  popularBadgeText: {
    color: c.bg,
    fontSize: 11,
    fontWeight: '700',
  },
  planHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  planName: {
    color: c.text,
    fontSize: 22,
    fontWeight: '700',
  },
  planTagline: {
    color: c.textMuted,
    fontSize: 13,
    marginTop: 4,
  },
  currentBadge: {
    backgroundColor: c.accentAlt + '20',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  currentBadgeText: {
    color: c.accentAlt,
    fontSize: 12,
    fontWeight: '600',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 20,
  },
  priceAmount: {
    color: c.text,
    fontSize: 36,
    fontWeight: '800',
  },
  pricePeriod: {
    color: c.textMuted,
    fontSize: 16,
    marginLeft: 4,
  },
  featuresList: {
    gap: 10,
    marginBottom: 20,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  featureText: {
    color: c.text,
    fontSize: 14,
    flex: 1,
  },
  selectButton: {
    backgroundColor: c.border,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  selectButtonPopular: {
    backgroundColor: c.accent,
  },
  selectButtonCurrent: {
    backgroundColor: c.accentAlt + '20',
  },
  selectButtonText: {
    color: c.text,
    fontSize: 16,
    fontWeight: '600',
  },
  selectButtonTextCurrent: {
    color: c.accentAlt,
  },
  guarantee: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: c.accent + '10',
    borderRadius: 14,
    padding: 16,
    gap: 14,
  },
  guaranteeText: {
    flex: 1,
  },
  guaranteeTitle: {
    color: c.text,
    fontSize: 14,
    fontWeight: '600',
  },
  guaranteeDescription: {
    color: c.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
});
