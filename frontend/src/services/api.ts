import axios from 'axios';
import Constants from 'expo-constants';

const BASE_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'https://quick-revenue-apps.preview.emergentagent.com';

const apiClient = axios.create({
  baseURL: `${BASE_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 120000, // 120 second timeout for AI operations (PDF parsing takes time)
});

export const api = {
  // Health check
  healthCheck: async () => {
    const response = await apiClient.get('/health');
    return response.data;
  },

  // Dashboard
  getDashboard: async () => {
    const response = await apiClient.get('/dashboard');
    return response.data;
  },

  // Receipts
  scanReceipt: async (imageBase64: string) => {
    const formData = new URLSearchParams();
    formData.append('image_base64', imageBase64);
    const response = await apiClient.post('/receipts/scan', formData.toString(), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });
    return response.data;
  },

  createReceipt: async (receipt: {
    vendor: string;
    amount: number;
    date: string;
    category: string;
    notes?: string;
    image_base64?: string;
  }) => {
    const response = await apiClient.post('/receipts', receipt);
    return response.data;
  },

  getReceipts: async (skip = 0, limit = 50) => {
    const response = await apiClient.get(`/receipts?skip=${skip}&limit=${limit}`);
    return response.data;
  },

  deleteReceipt: async (id: string) => {
    const response = await apiClient.delete(`/receipts/${id}`);
    return response.data;
  },

  // Mileage
  createMileage: async (mileage: {
    start_location: string;
    end_location: string;
    distance: number;
    purpose: string;
    date: string;
    notes?: string;
  }) => {
    const response = await apiClient.post('/mileage', mileage);
    return response.data;
  },

  getMileage: async (skip = 0, limit = 50) => {
    const response = await apiClient.get(`/mileage?skip=${skip}&limit=${limit}`);
    return response.data;
  },

  deleteMileage: async (id: string) => {
    const response = await apiClient.delete(`/mileage/${id}`);
    return response.data;
  },

  // Income
  createIncome: async (income: {
    source: string;
    amount: number;
    date: string;
    description?: string;
    is_1099?: boolean;
  }) => {
    const response = await apiClient.post('/income', income);
    return response.data;
  },

  getIncome: async (skip = 0, limit = 50) => {
    const response = await apiClient.get(`/income?skip=${skip}&limit=${limit}`);
    return response.data;
  },

  deleteIncome: async (id: string) => {
    const response = await apiClient.delete(`/income/${id}`);
    return response.data;
  },

  // Tax Coach
  askTaxCoach: async (message: string, context?: string) => {
    const response = await apiClient.post('/tax-coach', { message, context });
    return response.data;
  },

  // Categories
  getCategories: async () => {
    const response = await apiClient.get('/categories');
    return response.data;
  },

  // Gig Platforms
  getGigPlatforms: async () => {
    const response = await apiClient.get('/gig-platforms');
    return response.data;
  },

  // ========================================
  // PREMIUM FEATURE 1: Bank Statement Upload
  // ========================================
  uploadBankStatement: async (fileUri: string, fileName: string) => {
    const formData = new FormData();
    formData.append('file', {
      uri: fileUri,
      type: 'application/pdf',
      name: fileName,
    } as any);
    
    const response = await apiClient.post('/upload/statement', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  importFromStatement: async (transactions: any[]) => {
    const response = await apiClient.post('/receipts/import-from-statement', transactions);
    return response.data;
  },

  // ========================================
  // PREMIUM FEATURE 2: CSV Import
  // ========================================
  uploadCSV: async (fileUri: string, fileName: string, platform: string) => {
    const formData = new FormData();
    formData.append('file', {
      uri: fileUri,
      type: 'text/csv',
      name: fileName,
    } as any);
    formData.append('platform', platform);
    
    const response = await apiClient.post('/upload/csv', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  importCSVIncome: async (entries: any[]) => {
    const response = await apiClient.post('/income/import-csv', entries);
    return response.data;
  },

  // ========================================
  // PREMIUM FEATURE 3: Auto Trip Detection
  // ========================================
  getTripSettings: async () => {
    const response = await apiClient.get('/trips/settings');
    return response.data;
  },

  saveTripSettings: async (settings: {
    auto_detect_enabled: boolean;
    default_trip_type: string;
    sensitivity_level: string;
  }) => {
    const response = await apiClient.post('/trips/settings', settings);
    return response.data;
  },

  createAutoTrip: async (trip: {
    start_location: string;
    end_location?: string;
    start_lat?: number;
    start_lng?: number;
    end_lat?: number;
    end_lng?: number;
    distance?: number;
    purpose: string;
    date: string;
    is_auto_detected: boolean;
  }) => {
    const response = await apiClient.post('/trips/auto', trip);
    return response.data;
  },

  getPendingTrips: async () => {
    const response = await apiClient.get('/trips/pending');
    return response.data;
  },

  classifyTrip: async (tripId: string, purpose: string) => {
    const formData = new URLSearchParams();
    formData.append('purpose', purpose);
    const response = await apiClient.patch(`/trips/${tripId}/classify`, formData.toString(), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });
    return response.data;
  },

  // ========================================
  // PREMIUM FEATURE 4: Swipe to Classify
  // ========================================
  getUnclassifiedReceipts: async () => {
    const response = await apiClient.get('/receipts/unclassified');
    return response.data;
  },

  classifyReceipt: async (receiptId: string, isDeductible: boolean, category?: string) => {
    const formData = new URLSearchParams();
    formData.append('is_deductible', String(isDeductible));
    if (category) formData.append('category', category);
    
    const response = await apiClient.patch(`/receipts/${receiptId}/classify`, formData.toString(), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });
    return response.data;
  },

  // ========================================
  // PREMIUM FEATURE 5: Tax Reminders
  // ========================================
  getReminders: async () => {
    const response = await apiClient.get('/reminders');
    return response.data;
  },

  createReminder: async (reminder: {
    type: string;
    title: string;
    description?: string;
    due_date: string;
    repeat?: string;
    enabled: boolean;
  }) => {
    const response = await apiClient.post('/reminders', reminder);
    return response.data;
  },

  updateReminder: async (reminderId: string, updates: { enabled?: boolean; due_date?: string }) => {
    const formData = new URLSearchParams();
    if (updates.enabled !== undefined) formData.append('enabled', String(updates.enabled));
    if (updates.due_date) formData.append('due_date', updates.due_date);
    
    const response = await apiClient.patch(`/reminders/${reminderId}`, formData.toString(), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });
    return response.data;
  },

  deleteReminder: async (reminderId: string) => {
    const response = await apiClient.delete(`/reminders/${reminderId}`);
    return response.data;
  },

  getTaxDates: async () => {
    const response = await apiClient.get('/tax-dates');
    return response.data;
  },

  setupDefaultReminders: async () => {
    const response = await apiClient.post('/reminders/setup-defaults');
    return response.data;
  },
};

export default api;
