import axios from 'axios';
import Constants from 'expo-constants';

const BASE_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'https://quick-revenue-apps.preview.emergentagent.com';

const apiClient = axios.create({
  baseURL: `${BASE_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 60000, // 60 second timeout for AI operations
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
};

export default api;
