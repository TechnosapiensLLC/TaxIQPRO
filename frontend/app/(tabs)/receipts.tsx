import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { api } from '../../src/services/api';
import { format, isValid, parseISO } from 'date-fns';

import { useColors } from '../../src/context/ThemeContext';
import type { Palette } from '../../src/theme';
interface Receipt {
  id: string;
  vendor: string;
  amount: number;
  date: string;
  category: string;
  is_deductible: boolean;
  notes: string;
}

const formatDate = (dateStr: string): string => {
  if (!dateStr) return 'No date';
  try {
    const date = parseISO(dateStr);
    if (isValid(date)) {
      return format(date, 'MMM d, yyyy');
    }
    return 'Invalid date';
  } catch {
    return 'Invalid date';
  }
};

export default function ReceiptsScreen() {
  const c = useColors();
  const styles = makeStyles(c);
  const router = useRouter();
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchReceipts = useCallback(async () => {
    try {
      const data = await api.getReceipts();
      setReceipts(data);
    } catch (error) {
      console.error('Error fetching receipts:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchReceipts();
    }, [fetchReceipts])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchReceipts();
  }, [fetchReceipts]);

  const handleDelete = (id: string, vendor: string) => {
    Alert.alert(
      'Delete Receipt',
      `Are you sure you want to delete the receipt from ${vendor}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.deleteReceipt(id);
              fetchReceipts();
            } catch (error) {
              Alert.alert('Error', 'Failed to delete receipt');
            }
          },
        },
      ]
    );
  };

  const getCategoryIcon = (category: string) => {
    const icons: Record<string, string> = {
      'Vehicle & Gas': 'car',
      'Equipment & Supplies': 'construct',
      'Phone & Internet': 'phone-portrait',
      'Insurance': 'shield-checkmark',
      'Food & Meals': 'restaurant',
      'Office Supplies': 'document-text',
      'Software & Subscriptions': 'laptop',
      'Professional Services': 'briefcase',
      'Education & Training': 'school',
      'Marketing & Advertising': 'megaphone',
      'Health & Medical': 'medical',
      'Entertainment': 'game-controller',
      'Parking & Tolls': 'car-sport',
      'Maintenance & Repairs': 'hammer',
    };
    return (icons[category] || 'receipt') as any;
  };

  const renderReceipt = ({ item }: { item: Receipt }) => (
    <TouchableOpacity
      style={styles.receiptCard}
      onLongPress={() => handleDelete(item.id, item.vendor)}
    >
      <View style={styles.receiptIcon}>
        <Ionicons
          name={getCategoryIcon(item.category)}
          size={24}
          color={item.is_deductible ? c.accent : c.danger}
        />
      </View>
      <View style={styles.receiptInfo}>
        <Text style={styles.receiptVendor} numberOfLines={1}>
          {item.vendor}
        </Text>
        <Text style={styles.receiptCategory}>{item.category}</Text>
        <Text style={styles.receiptDate}>
          {formatDate(item.date)}
        </Text>
      </View>
      <View style={styles.receiptAmountContainer}>
        <Text style={styles.receiptAmount}>${item.amount.toFixed(2)}</Text>
        {item.is_deductible && (
          <View style={styles.deductibleBadge}>
            <Ionicons name="checkmark" size={12} color={c.accent} />
            <Text style={styles.deductibleText}>Deductible</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );

  const totalDeductible = receipts
    .filter((r) => r.is_deductible)
    .reduce((sum, r) => sum + r.amount, 0);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Receipts</Text>
        <View style={styles.headerButtons}>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => router.push('/add-receipt')}
          >
            <Ionicons name="add" size={24} color="#FFF" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.scanButton}
            onPress={() => router.push('/scan')}
          >
            <Ionicons name="camera" size={22} color="#FFF" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Summary */}
      <View style={styles.summary}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>{receipts.length}</Text>
          <Text style={styles.summaryLabel}>Total Receipts</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryValue, { color: c.accent }]}>
            ${totalDeductible.toFixed(2)}
          </Text>
          <Text style={styles.summaryLabel}>Deductible</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={c.accent} />
        </View>
      ) : receipts.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="receipt-outline" size={64} color={c.border} />
          <Text style={styles.emptyTitle}>No receipts yet</Text>
          <Text style={styles.emptySubtitle}>
            Scan your first receipt to start tracking expenses
          </Text>
          <TouchableOpacity
            style={styles.emptyButton}
            onPress={() => router.push('/scan')}
          >
            <Ionicons name="camera" size={20} color="#FFF" />
            <Text style={styles.emptyButtonText}>Scan Receipt</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={receipts}
          renderItem={renderReceipt}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={c.accent}
            />
          }
          showsVerticalScrollIndicator={false}
        />
      )}
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
  title: {
    color: c.text,
    fontSize: 28,
    fontWeight: '700',
  },
  headerButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  addButton: {
    backgroundColor: c.border,
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanButton: {
    backgroundColor: c.accent,
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  summary: {
    flexDirection: 'row',
    backgroundColor: c.surface,
    marginHorizontal: 20,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryDivider: {
    width: 1,
    backgroundColor: c.border,
  },
  summaryValue: {
    color: c.text,
    fontSize: 24,
    fontWeight: '700',
  },
  summaryLabel: {
    color: c.textMuted,
    fontSize: 13,
    marginTop: 4,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    color: c.text,
    fontSize: 20,
    fontWeight: '600',
    marginTop: 16,
  },
  emptySubtitle: {
    color: c.textMuted,
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: c.accent,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 24,
    gap: 8,
  },
  emptyButtonText: {
    color: c.onPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  receiptCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: c.surface,
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
  },
  receiptIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: c.surfaceAlt,
    justifyContent: 'center',
    alignItems: 'center',
  },
  receiptInfo: {
    flex: 1,
    marginLeft: 14,
  },
  receiptVendor: {
    color: c.text,
    fontSize: 16,
    fontWeight: '600',
  },
  receiptCategory: {
    color: c.textMuted,
    fontSize: 13,
    marginTop: 2,
  },
  receiptDate: {
    color: c.borderStrong,
    fontSize: 12,
    marginTop: 2,
  },
  receiptAmountContainer: {
    alignItems: 'flex-end',
  },
  receiptAmount: {
    color: c.text,
    fontSize: 18,
    fontWeight: '700',
  },
  deductibleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: c.accent + '15',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginTop: 4,
    gap: 4,
  },
  deductibleText: {
    color: c.accent,
    fontSize: 11,
    fontWeight: '500',
  },
});
