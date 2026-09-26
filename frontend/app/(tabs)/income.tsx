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
interface IncomeEntry {
  id: string;
  source: string;
  amount: number;
  date: string;
  description: string;
  is_1099: boolean;
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

const platformIcons: Record<string, string> = {
  Uber: 'car',
  Lyft: 'car',
  DoorDash: 'fast-food',
  'Uber Eats': 'restaurant',
  Instacart: 'cart',
  Grubhub: 'fast-food',
  'Amazon Flex': 'cube',
  Upwork: 'briefcase',
  Fiverr: 'briefcase',
  TaskRabbit: 'construct',
  Rover: 'paw',
  Airbnb: 'home',
  Turo: 'car-sport',
  Etsy: 'storefront',
  Other: 'cash',
};

export default function IncomeScreen() {
  const c = useColors();
  const styles = makeStyles(c);
  const router = useRouter();
  const [entries, setEntries] = useState<IncomeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchIncome = useCallback(async () => {
    try {
      const data = await api.getIncome();
      setEntries(data);
    } catch (error) {
      console.error('Error fetching income:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchIncome();
    }, [fetchIncome])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchIncome();
  }, [fetchIncome]);

  const handleDelete = (id: string, source: string) => {
    Alert.alert(
      'Delete Income',
      `Are you sure you want to delete this ${source} income entry?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.deleteIncome(id);
              fetchIncome();
            } catch (error) {
              Alert.alert('Error', 'Failed to delete income entry');
            }
          },
        },
      ]
    );
  };

  const totalIncome = entries.reduce((sum, e) => sum + e.amount, 0);
  const incomeBy1099 = entries
    .filter((e) => e.is_1099)
    .reduce((sum, e) => sum + e.amount, 0);

  // Group by source
  const incomeBySource = entries.reduce((acc, e) => {
    acc[e.source] = (acc[e.source] || 0) + e.amount;
    return acc;
  }, {} as Record<string, number>);

  const topSources = Object.entries(incomeBySource)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  const renderEntry = ({ item }: { item: IncomeEntry }) => (
    <TouchableOpacity
      style={styles.incomeCard}
      onLongPress={() => handleDelete(item.id, item.source)}
    >
      <View style={styles.incomeIcon}>
        <Ionicons
          name={(platformIcons[item.source] || 'cash') as any}
          size={24}
          color={c.accent}
        />
      </View>
      <View style={styles.incomeInfo}>
        <Text style={styles.incomeSource}>{item.source}</Text>
        {item.description && (
          <Text style={styles.incomeDescription} numberOfLines={1}>
            {item.description}
          </Text>
        )}
        <Text style={styles.incomeDate}>
          {formatDate(item.date)}
        </Text>
      </View>
      <View style={styles.incomeAmountContainer}>
        <Text style={styles.incomeAmount}>+${item.amount.toFixed(2)}</Text>
        {item.is_1099 && (
          <View style={styles.badge1099}>
            <Text style={styles.badge1099Text}>1099</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Income</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => router.push('/add-income')}
        >
          <Ionicons name="add" size={24} color="#FFF" />
        </TouchableOpacity>
      </View>

      {/* Summary Card */}
      <View style={styles.summaryCard}>
        <View style={styles.summaryMain}>
          <Text style={styles.summaryLabel}>Total Income (YTD)</Text>
          <Text style={styles.summaryValue}>
            ${totalIncome.toLocaleString()}
          </Text>
        </View>
        <View style={styles.summaryRow}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryItemLabel}>1099 Income</Text>
            <Text style={styles.summaryItemValue}>
              ${incomeBy1099.toLocaleString()}
            </Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryItemLabel}>Entries</Text>
            <Text style={styles.summaryItemValue}>{entries.length}</Text>
          </View>
        </View>
      </View>

      {/* Top Sources */}
      {topSources.length > 0 && (
        <View style={styles.sourcesContainer}>
          <Text style={styles.sourcesTitle}>Top Sources</Text>
          <View style={styles.sourcesRow}>
            {topSources.map(([source, amount]) => (
              <View key={source} style={styles.sourceChip}>
                <Ionicons
                  name={(platformIcons[source] || 'cash') as any}
                  size={14}
                  color={c.accent}
                />
                <Text style={styles.sourceChipText}>{source}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={c.accent} />
        </View>
      ) : entries.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="wallet-outline" size={64} color={c.border} />
          <Text style={styles.emptyTitle}>No income recorded</Text>
          <Text style={styles.emptySubtitle}>
            Add your gig earnings to track your tax obligations
          </Text>
          <TouchableOpacity
            style={styles.emptyButton}
            onPress={() => router.push('/add-income')}
          >
            <Ionicons name="add-circle" size={20} color="#FFF" />
            <Text style={styles.emptyButtonText}>Add Income</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={entries}
          renderItem={renderEntry}
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
  addButton: {
    backgroundColor: c.accent,
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  summaryCard: {
    backgroundColor: c.surface,
    marginHorizontal: 20,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: c.accent + '20',
  },
  summaryMain: {
    marginBottom: 16,
  },
  summaryLabel: {
    color: c.textMuted,
    fontSize: 13,
    marginBottom: 4,
  },
  summaryValue: {
    color: c.accent,
    fontSize: 36,
    fontWeight: '700',
  },
  summaryRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: c.surfaceAlt,
    paddingTop: 16,
  },
  summaryItem: {
    flex: 1,
  },
  summaryItemLabel: {
    color: c.textMuted,
    fontSize: 12,
  },
  summaryItemValue: {
    color: c.text,
    fontSize: 18,
    fontWeight: '600',
    marginTop: 2,
  },
  sourcesContainer: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  sourcesTitle: {
    color: c.textMuted,
    fontSize: 13,
    marginBottom: 10,
  },
  sourcesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  sourceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: c.surface,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  sourceChipText: {
    color: c.text,
    fontSize: 13,
    fontWeight: '500',
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
  incomeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: c.surface,
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
  },
  incomeIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: c.accent + '15',
    justifyContent: 'center',
    alignItems: 'center',
  },
  incomeInfo: {
    flex: 1,
    marginLeft: 14,
  },
  incomeSource: {
    color: c.text,
    fontSize: 16,
    fontWeight: '600',
  },
  incomeDescription: {
    color: c.textMuted,
    fontSize: 13,
    marginTop: 2,
  },
  incomeDate: {
    color: c.borderStrong,
    fontSize: 12,
    marginTop: 2,
  },
  incomeAmountContainer: {
    alignItems: 'flex-end',
  },
  incomeAmount: {
    color: c.accent,
    fontSize: 18,
    fontWeight: '700',
  },
  badge1099: {
    backgroundColor: c.warning + '20',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginTop: 4,
  },
  badge1099Text: {
    color: c.warning,
    fontSize: 11,
    fontWeight: '600',
  },
});
