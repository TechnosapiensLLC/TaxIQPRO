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

const { width } = Dimensions.get('window');

export default function PricingScreen() {
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
                  <Ionicons name="star" size={12} color="#0A0A0F" />
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
                      color={plan.id === 'free' ? '#6B6B7B' : '#00D9A5'}
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
          <Ionicons name="shield-checkmark" size={24} color="#00D9A5" />
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
  billingToggle: {
    flexDirection: 'row',
    backgroundColor: '#14141A',
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
    backgroundColor: '#00D9A5',
  },
  billingOptionText: {
    color: '#6B6B7B',
    fontSize: 14,
    fontWeight: '600',
  },
  billingOptionTextActive: {
    color: '#FFFFFF',
  },
  saveBadge: {
    backgroundColor: '#FFB84D',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  saveBadgeText: {
    color: '#0A0A0F',
    fontSize: 10,
    fontWeight: '700',
  },
  planCard: {
    backgroundColor: '#14141A',
    borderRadius: 20,
    padding: 24,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  planCardPopular: {
    borderColor: '#00D9A550',
    backgroundColor: '#0A1510',
  },
  planCardCurrent: {
    borderColor: '#7C6BFF50',
  },
  popularBadge: {
    position: 'absolute',
    top: -12,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#00D9A5',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    gap: 4,
  },
  popularBadgeText: {
    color: '#0A0A0F',
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
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '700',
  },
  planTagline: {
    color: '#6B6B7B',
    fontSize: 13,
    marginTop: 4,
  },
  currentBadge: {
    backgroundColor: '#7C6BFF20',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  currentBadgeText: {
    color: '#7C6BFF',
    fontSize: 12,
    fontWeight: '600',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 20,
  },
  priceAmount: {
    color: '#FFFFFF',
    fontSize: 36,
    fontWeight: '800',
  },
  pricePeriod: {
    color: '#6B6B7B',
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
    color: '#FFFFFF',
    fontSize: 14,
    flex: 1,
  },
  selectButton: {
    backgroundColor: '#2A2A35',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  selectButtonPopular: {
    backgroundColor: '#00D9A5',
  },
  selectButtonCurrent: {
    backgroundColor: '#7C6BFF20',
  },
  selectButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  selectButtonTextCurrent: {
    color: '#7C6BFF',
  },
  guarantee: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#00D9A510',
    borderRadius: 14,
    padding: 16,
    gap: 14,
  },
  guaranteeText: {
    flex: 1,
  },
  guaranteeTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  guaranteeDescription: {
    color: '#6B6B7B',
    fontSize: 12,
    marginTop: 2,
  },
});
