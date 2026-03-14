import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type SubscriptionTier = 'free' | 'pro' | 'max';

export interface SubscriptionPlan {
  id: SubscriptionTier;
  name: string;
  tagline: string;
  price: number;
  priceYearly: number;
  features: string[];
  limits: {
    receiptsPerMonth: number;
    aiQuestionsPerMonth: number;
    incomeSources: number;
    mileageTracking: 'manual' | 'gps' | 'auto';
    bankStatementUpload: boolean;
    csvImport: boolean;
    swipeClassify: boolean;
    pushNotifications: boolean;
    cpaPortal: boolean;
    prioritySupport: boolean;
  };
}

export const SUBSCRIPTION_PLANS: Record<SubscriptionTier, SubscriptionPlan> = {
  free: {
    id: 'free',
    name: 'TaxIQ Free',
    tagline: 'Get started with basic tracking',
    price: 0,
    priceYearly: 0,
    features: [
      '25 receipts per month',
      'Manual mileage logging',
      '3 income sources',
      'Basic tax estimates',
      'Dashboard overview',
    ],
    limits: {
      receiptsPerMonth: 25,
      aiQuestionsPerMonth: 5,
      incomeSources: 3,
      mileageTracking: 'manual',
      bankStatementUpload: false,
      csvImport: false,
      swipeClassify: false,
      pushNotifications: false,
      cpaPortal: false,
      prioritySupport: false,
    },
  },
  pro: {
    id: 'pro',
    name: 'TaxIQ Pro',
    tagline: 'Everything you need to maximize deductions',
    price: 9.99,
    priceYearly: 99,
    features: [
      'Unlimited AI receipt scanning',
      'GPS mileage tracking',
      'Unlimited income sources',
      'AI Tax Coach (50 questions/mo)',
      'Audit Risk Score',
      'Push notifications',
      'CSV earnings import',
      'Swipe-to-classify receipts',
      'PDF/CSV exports',
    ],
    limits: {
      receiptsPerMonth: -1, // unlimited
      aiQuestionsPerMonth: 50,
      incomeSources: -1,
      mileageTracking: 'gps',
      bankStatementUpload: false,
      csvImport: true,
      swipeClassify: true,
      pushNotifications: true,
      cpaPortal: false,
      prioritySupport: false,
    },
  },
  max: {
    id: 'max',
    name: 'TaxIQ Max',
    tagline: 'Ultimate tax intelligence for power users',
    price: 19.99,
    priceYearly: 149,
    features: [
      'Everything in Pro, plus:',
      'Bank statement PDF upload',
      'Automatic trip detection',
      'Unlimited AI Tax Coach',
      'CPA share portal',
      'Priority support',
      'Schedule C auto-fill',
      'TurboTax integration (coming)',
      '7-year data retention',
      'Family plan (2 accounts)',
    ],
    limits: {
      receiptsPerMonth: -1,
      aiQuestionsPerMonth: -1,
      incomeSources: -1,
      mileageTracking: 'auto',
      bankStatementUpload: true,
      csvImport: true,
      swipeClassify: true,
      pushNotifications: true,
      cpaPortal: true,
      prioritySupport: true,
    },
  },
};

interface SubscriptionState {
  currentTier: SubscriptionTier;
  usageThisMonth: {
    receipts: number;
    aiQuestions: number;
  };
  isLoading: boolean;
  setTier: (tier: SubscriptionTier) => Promise<void>;
  incrementUsage: (type: 'receipts' | 'aiQuestions') => void;
  checkFeatureAccess: (feature: keyof SubscriptionPlan['limits']) => boolean;
  checkUsageLimit: (type: 'receipts' | 'aiQuestions') => boolean;
  loadSubscription: () => Promise<void>;
  getCurrentPlan: () => SubscriptionPlan;
}

export const useSubscription = create<SubscriptionState>((set, get) => ({
  currentTier: 'free',
  usageThisMonth: {
    receipts: 0,
    aiQuestions: 0,
  },
  isLoading: true,

  setTier: async (tier: SubscriptionTier) => {
    await AsyncStorage.setItem('taxiq_subscription', tier);
    set({ currentTier: tier });
  },

  incrementUsage: (type: 'receipts' | 'aiQuestions') => {
    set((state) => ({
      usageThisMonth: {
        ...state.usageThisMonth,
        [type]: state.usageThisMonth[type] + 1,
      },
    }));
  },

  checkFeatureAccess: (feature: keyof SubscriptionPlan['limits']) => {
    const plan = SUBSCRIPTION_PLANS[get().currentTier];
    const value = plan.limits[feature];
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value !== 0;
    return value !== 'manual';
  },

  checkUsageLimit: (type: 'receipts' | 'aiQuestions') => {
    const plan = SUBSCRIPTION_PLANS[get().currentTier];
    const limit = type === 'receipts' 
      ? plan.limits.receiptsPerMonth 
      : plan.limits.aiQuestionsPerMonth;
    if (limit === -1) return true; // unlimited
    return get().usageThisMonth[type] < limit;
  },

  loadSubscription: async () => {
    try {
      const stored = await AsyncStorage.getItem('taxiq_subscription');
      if (stored && (stored === 'free' || stored === 'pro' || stored === 'max')) {
        set({ currentTier: stored as SubscriptionTier, isLoading: false });
      } else {
        set({ isLoading: false });
      }
    } catch {
      set({ isLoading: false });
    }
  },

  getCurrentPlan: () => {
    return SUBSCRIPTION_PLANS[get().currentTier];
  },
}));
