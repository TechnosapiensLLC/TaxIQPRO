import axios from 'axios';
import Constants from 'expo-constants';
import { tokenStorage } from './tokenStorage';

const BASE_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'https://quick-revenue-apps.preview.emergentagent.com';

const apiClient = axios.create({
  baseURL: `${BASE_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 120000, // 120 second timeout for AI operations (PDF parsing takes time)
});

apiClient.interceptors.request.use(async (config) => {
  const token = await tokenStorage.get();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
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
    is_business?: boolean;
    store_id?: string;
    barcode?: string;
    line_items?: any[];
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
    store_id?: string;
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

  // Distance Calculation
  calculateDistance: async (startLat: number, startLng: number, endLat: number, endLng: number) => {
    try {
      console.log('Calculating distance:', { startLat, startLng, endLat, endLng });
      const response = await apiClient.post('/calculate-distance', {
        start_lat: startLat,
        start_lng: startLng,
        end_lat: endLat,
        end_lng: endLng,
      });
      console.log('Distance result:', response.data);
      return response.data;
    } catch (error: any) {
      console.error('Distance calculation error:', error?.message || error);
      // Fallback: Calculate using Haversine formula locally
      const R = 3959; // Earth's radius in miles
      const dLat = ((endLat - startLat) * Math.PI) / 180;
      const dLon = ((endLng - startLng) * Math.PI) / 180;
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((startLat * Math.PI) / 180) *
          Math.cos((endLat * Math.PI) / 180) *
          Math.sin(dLon / 2) *
          Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const distance = R * c * 1.3; // Apply road factor
      return {
        distance_miles: parseFloat(distance.toFixed(2)),
        estimated_deduction: parseFloat((distance * 0.70).toFixed(2)),
      };
    }
  },

  // ========================================
  // PREMIUM FEATURE 1: Bank Statement Upload
  // ========================================
  uploadBankStatement: async (fileUri: string, fileName: string) => {
    const formData = new FormData();
    
    // Determine if we're on web platform
    const isWeb = typeof window !== 'undefined' && typeof document !== 'undefined';
    
    if (isWeb) {
      // Web platform - handle blob: and data: URIs
      if (fileUri.startsWith('blob:') || fileUri.startsWith('data:')) {
        const fetchResponse = await fetch(fileUri);
        const blob = await fetchResponse.blob();
        formData.append('file', blob, fileName);
      } else {
        try {
          const fetchResponse = await fetch(fileUri);
          const blob = await fetchResponse.blob();
          formData.append('file', blob, fileName);
        } catch (e) {
          formData.append('file', {
            uri: fileUri,
            type: 'application/pdf',
            name: fileName,
          } as any);
        }
      }
    } else {
      // React Native platform
      formData.append('file', {
        uri: fileUri,
        type: 'application/pdf',
        name: fileName,
      } as any);
    }
    
    const response = await apiClient.post('/upload/statement', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      timeout: 180000, // 3 minute timeout for AI analysis
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
    
    // Determine if we're on web platform
    const isWeb = typeof window !== 'undefined' && typeof document !== 'undefined';
    
    if (isWeb) {
      // Web platform - handle blob: and data: URIs
      if (fileUri.startsWith('blob:') || fileUri.startsWith('data:')) {
        const fetchResponse = await fetch(fileUri);
        const blob = await fetchResponse.blob();
        formData.append('file', blob, fileName);
      } else {
        try {
          const fetchResponse = await fetch(fileUri);
          const blob = await fetchResponse.blob();
          formData.append('file', blob, fileName);
        } catch (e) {
          formData.append('file', {
            uri: fileUri,
            type: 'text/csv',
            name: fileName,
          } as any);
        }
      }
    } else {
      // React Native platform
      formData.append('file', {
        uri: fileUri,
        type: 'text/csv',
        name: fileName,
      } as any);
    }
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

  // ========================================
  // GAS FINDER
  // ========================================
  getGasStations: async (lat: number, lng: number, radius: number = 5, sortBy: string = 'premium') => {
    const response = await apiClient.get(`/gas-stations?lat=${lat}&lng=${lng}&radius=${radius}&sort_by=${sortBy}`);
    return response.data;
  },

  // ========================================
  // DEDUCTION MAXIMIZER
  // ========================================
  getDeductionAnalysis: async () => {
    const response = await apiClient.get('/deduction-maximizer');
    return response.data;
  },

  // ========================================
  // QUARTERLY TAX ESTIMATOR
  // ========================================
  getQuarterlyEstimate: async () => {
    const response = await apiClient.get('/quarterly-estimator');
    return response.data;
  },

  // ========================================
  // TAX FILING ANALYZER
  // ========================================
  analyzeTaxFiling: async (fileUri: string, fileName: string, fileType: string = 'pdf') => {
    const formData = new FormData();
    const mimeType = fileType === 'pdf' ? 'application/pdf' : `image/${fileType}`;
    
    // Determine if we're on web platform
    const isWeb = typeof window !== 'undefined' && typeof document !== 'undefined';
    
    if (isWeb) {
      // Web platform - handle blob: and data: URIs, or File objects
      if (fileUri.startsWith('blob:') || fileUri.startsWith('data:')) {
        const fetchResponse = await fetch(fileUri);
        const blob = await fetchResponse.blob();
        formData.append('file', blob, fileName);
      } else if (fileUri.startsWith('file:') || fileUri.startsWith('/')) {
        // This shouldn't happen on web, but handle it anyway
        formData.append('file', {
          uri: fileUri,
          type: mimeType,
          name: fileName,
        } as any);
      } else {
        // Assume it's a URL or data URL
        try {
          const fetchResponse = await fetch(fileUri);
          const blob = await fetchResponse.blob();
          formData.append('file', blob, fileName);
        } catch (e) {
          // Fallback to direct append
          formData.append('file', {
            uri: fileUri,
            type: mimeType,
            name: fileName,
          } as any);
        }
      }
    } else {
      // React Native platform
      formData.append('file', {
        uri: fileUri,
        type: mimeType,
        name: fileName,
      } as any);
    }
    
    const apiResponse = await apiClient.post('/analyze-filing', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      timeout: 180000, // 3 minute timeout for AI analysis
    });
    return apiResponse.data;
  },

  importIncomeFromAnalysis: async (incomeSources: any[]) => {
    // Use existing import endpoint
    const entries = incomeSources.map((source: any) => ({
      source: source.source,
      amount: source.amount,
      date: new Date().toISOString().split('T')[0],
      description: 'Imported from tax filing analysis',
      is_1099: source.is_1099 ?? true,
    }));
    const response = await apiClient.post('/income/import-csv', entries);
    return response.data;
  },

  importExpensesFromAnalysis: async (expenses: any[]) => {
    // Import as receipts
    const receipts = expenses.map((exp: any) => ({
      vendor: exp.category,
      amount: exp.amount,
      date: new Date().toISOString().split('T')[0],
      category: exp.category,
      notes: 'Imported from tax filing analysis',
      is_deductible: true,
    }));
    
    let imported = 0;
    for (const receipt of receipts) {
      await apiClient.post('/receipts', receipt);
      imported++;
    }
    return { imported, message: `Imported ${imported} expense records` };
  },

  // ========================================
  // AUTH
  // ========================================
  register: async (body: {
    email: string;
    password: string;
    name: string;
    gig_types?: string[];
    profession?: string;
    invite_code?: string;
  }) => {
    const response = await apiClient.post('/auth/register', body);
    return response.data;
  },

  login: async (email: string, password: string) => {
    const response = await apiClient.post('/auth/login', { email, password });
    return response.data;
  },

  getMe: async () => {
    const response = await apiClient.get('/auth/me');
    return response.data;
  },

  updateMe: async (updates: {
    name?: string;
    profession?: string;
    gig_types?: string[];
    onboarded?: boolean;
  }) => {
    const response = await apiClient.patch('/auth/me', updates);
    return response.data;
  },

  // ========================================
  // EXPORTS
  // ========================================
  getTurboTaxPreview: async (params: { year?: number; scope?: string } = {}) => {
    const response = await apiClient.get('/export/turbotax', { params });
    return response.data;
  },

  getCpaPackagePreview: async (params: { year?: number; scope?: string } = {}) => {
    const response = await apiClient.get('/export/cpa-package', { params });
    return response.data;
  },

  getAccountingFormats: async () => {
    const response = await apiClient.get('/export/accounting/formats');
    return response.data;
  },

  getCoaMapping: async () => {
    const response = await apiClient.get('/export/coa-mapping');
    return response.data;
  },

  saveCoaMapping: async (mapping: Record<string, string>) => {
    const response = await apiClient.put('/export/coa-mapping', { mapping });
    return response.data;
  },

  // ========================================
  // ORGANIZATION (STORE CHAIN)
  // ========================================
  getMyOrg: async () => {
    const response = await apiClient.get('/org/me');
    return response.data;
  },

  createOrg: async (name: string) => {
    const response = await apiClient.post('/org', { name });
    return response.data;
  },

  getStores: async () => {
    const response = await apiClient.get('/org/stores');
    return response.data;
  },

  createStore: async (body: { name: string; address?: string; store_number?: string }) => {
    const response = await apiClient.post('/org/stores', body);
    return response.data;
  },

  getMembers: async () => {
    const response = await apiClient.get('/org/members');
    return response.data;
  },

  updateMember: async (
    memberId: string,
    updates: { role?: string; store_id?: string; disabled?: boolean }
  ) => {
    const response = await apiClient.patch(`/org/members/${memberId}`, updates);
    return response.data;
  },

  getInvites: async () => {
    const response = await apiClient.get('/org/invites');
    return response.data;
  },

  createInvite: async (body: { role: string; store_id?: string; email?: string }) => {
    const response = await apiClient.post('/org/invites', body);
    return response.data;
  },

  getOrgSummary: async (params: { store_id?: string; year?: number } = {}) => {
    const response = await apiClient.get('/org/reports/summary', { params });
    return response.data;
  },

  createServiceToken: async (serviceName: string) => {
    const response = await apiClient.post('/org/service-token', {
      service_name: serviceName,
    });
    return response.data;
  },

  // ========================================
  // QUICKBOOKS ONLINE
  // ========================================
  getQboStatus: async () => {
    const response = await apiClient.get('/qbo/status');
    return response.data;
  },

  getQboAuthUrl: async (platform: 'web' | 'native') => {
    const response = await apiClient.get('/qbo/authorize', { params: { platform } });
    return response.data;
  },

  disconnectQbo: async () => {
    const response = await apiClient.delete('/qbo/disconnect');
    return response.data;
  },

  getQboAccounts: async (accountType?: string) => {
    const response = await apiClient.get('/qbo/accounts', {
      params: accountType ? { account_type: accountType } : {},
    });
    return response.data;
  },

  syncToQbo: async (body: {
    clearing_account_id: string;
    expense_account_id?: string;
    income_account_id?: string;
    year?: number;
    scope?: string;
    dry_run?: boolean;
  }) => {
    const response = await apiClient.post('/qbo/sync', body);
    return response.data;
  },

  getQboSyncLog: async () => {
    const response = await apiClient.get('/qbo/sync-log');
    return response.data;
  },

  // ========================================
  // ROUTE PLANNING
  // ========================================
  getRoutePlans: async () => {
    const response = await apiClient.get('/routes');
    return response.data;
  },

  createRoutePlan: async (body: {
    name: string;
    stops: { name: string; address?: string; lat?: number; lng?: number }[];
    round_trip?: boolean;
    store_id?: string;
  }) => {
    const response = await apiClient.post('/routes', body);
    return response.data;
  },

  deleteRoutePlan: async (planId: string) => {
    const response = await apiClient.delete(`/routes/${planId}`);
    return response.data;
  },

  scheduleRoute: async (planId: string, dates: string[]) => {
    const response = await apiClient.post(`/routes/${planId}/schedule`, { dates });
    return response.data;
  },

  getRouteWeek: async (weekStart?: string) => {
    const response = await apiClient.get('/routes/runs', {
      params: weekStart ? { week_start: weekStart } : {},
    });
    return response.data;
  },

  startRouteRun: async (runId: string) => {
    const response = await apiClient.post(`/routes/runs/${runId}/start`);
    return response.data;
  },

  arriveAtStop: async (runId: string, stopIndex: number, coords?: { lat: number; lng: number }) => {
    const response = await apiClient.post(`/routes/runs/${runId}/arrive`, {
      stop_index: stopIndex,
      lat: coords?.lat,
      lng: coords?.lng,
    });
    return response.data;
  },

  completeRouteRun: async (runId: string) => {
    const response = await apiClient.post(`/routes/runs/${runId}/complete`);
    return response.data;
  },

  deleteRouteRun: async (runId: string) => {
    const response = await apiClient.delete(`/routes/runs/${runId}`);
    return response.data;
  },

  // ========================================
  // SHOPPING RUNS
  // ========================================
  getActiveShoppingRun: async () => {
    const response = await apiClient.get('/shopping-runs/active');
    return response.data;
  },

  getShoppingRuns: async (status?: string) => {
    const response = await apiClient.get('/shopping-runs', {
      params: status ? { status } : {},
    });
    return response.data;
  },

  startShoppingRun: async (body: { vendor: string; category?: string; store_id?: string }) => {
    const response = await apiClient.post('/shopping-runs', body);
    return response.data;
  },

  lookupBarcode: async (barcode: string) => {
    const response = await apiClient.get(`/shopping-runs/lookup/${barcode}`);
    return response.data;
  },

  addShoppingItem: async (
    runId: string,
    item: { barcode?: string; name: string; qty: number; unit_price: number }
  ) => {
    const response = await apiClient.post(`/shopping-runs/${runId}/items`, item);
    return response.data;
  },

  updateShoppingItem: async (
    runId: string,
    index: number,
    updates: { name?: string; qty?: number; unit_price?: number }
  ) => {
    const response = await apiClient.patch(`/shopping-runs/${runId}/items/${index}`, updates);
    return response.data;
  },

  removeShoppingItem: async (runId: string, index: number) => {
    const response = await apiClient.delete(`/shopping-runs/${runId}/items/${index}`);
    return response.data;
  },

  checkoutShoppingRun: async (
    runId: string,
    body: {
      receipt_total?: number;
      receipt_image_base64?: string;
      category?: string;
      notes?: string;
      is_business?: boolean;
    }
  ) => {
    const response = await apiClient.post(`/shopping-runs/${runId}/checkout`, body);
    return response.data;
  },

  deleteShoppingRun: async (runId: string) => {
    const response = await apiClient.delete(`/shopping-runs/${runId}`);
    return response.data;
  },

  // ========================================
  // CHAIN SPEND ANALYTICS
  // ========================================
  getChainSpend: async (params: { period?: 'week' | 'month'; store_id?: string } = {}) => {
    const response = await apiClient.get('/org/reports/spend', { params });
    return response.data;
  },
};

export default api;
