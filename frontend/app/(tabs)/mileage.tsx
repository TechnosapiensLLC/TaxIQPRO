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

interface MileageEntry {
  id: string;
  start_location: string;
  end_location: string;
  distance: number;
  purpose: string;
  date: string;
  deduction_amount: number;
  notes: string;
}

const IRS_MILEAGE_RATE = 0.70;

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

export default function MileageScreen() {
  const router = useRouter();
  const [entries, setEntries] = useState<MileageEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchMileage = useCallback(async () => {
    try {
      const data = await api.getMileage();
      setEntries(data);
    } catch (error) {
      console.error('Error fetching mileage:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchMileage();
    }, [fetchMileage])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchMileage();
  }, [fetchMileage]);

  const handleDelete = (id: string) => {
    Alert.alert('Delete Trip', 'Are you sure you want to delete this trip?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.deleteMileage(id);
            fetchMileage();
          } catch (error) {
            Alert.alert('Error', 'Failed to delete trip');
          }
        },
      },
    ]);
  };

  const getPurposeColor = (purpose: string) => {
    switch (purpose) {
      case 'Business':
        return '#00D9A5';
      case 'Personal':
        return '#6B6B7B';
      case 'Commute':
        return '#FFB84D';
      default:
        return '#6B6B7B';
    }
  };

  const totalMiles = entries.reduce((sum, e) => sum + e.distance, 0);
  const businessMiles = entries
    .filter((e) => e.purpose === 'Business')
    .reduce((sum, e) => sum + e.distance, 0);
  const totalDeduction = entries.reduce((sum, e) => sum + e.deduction_amount, 0);

  const renderEntry = ({ item }: { item: MileageEntry }) => (
    <TouchableOpacity
      style={styles.tripCard}
      onLongPress={() => handleDelete(item.id)}
    >
      <View style={styles.tripHeader}>
        <View
          style={[
            styles.purposeBadge,
            { backgroundColor: `${getPurposeColor(item.purpose)}20` },
          ]}
        >
          <View
            style={[
              styles.purposeDot,
              { backgroundColor: getPurposeColor(item.purpose) },
            ]}
          />
          <Text
            style={[
              styles.purposeText,
              { color: getPurposeColor(item.purpose) },
            ]}
          >
            {item.purpose}
          </Text>
        </View>
        <Text style={styles.tripDate}>
          {formatDate(item.date)}
        </Text>
      </View>

      <View style={styles.tripRoute}>
        <View style={styles.routePoint}>
          <Ionicons name="radio-button-on" size={14} color="#00D9A5" />
          <Text style={styles.routeText} numberOfLines={1}>
            {item.start_location}
          </Text>
        </View>
        <View style={styles.routeLine} />
        <View style={styles.routePoint}>
          <Ionicons name="location" size={14} color="#FF6B6B" />
          <Text style={styles.routeText} numberOfLines={1}>
            {item.end_location}
          </Text>
        </View>
      </View>

      <View style={styles.tripFooter}>
        <View style={styles.tripStat}>
          <Ionicons name="speedometer-outline" size={16} color="#6B6B7B" />
          <Text style={styles.tripStatText}>{item.distance.toFixed(1)} mi</Text>
        </View>
        {item.deduction_amount > 0 && (
          <Text style={styles.tripDeduction}>
            +${item.deduction_amount.toFixed(2)}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Mileage</Text>
        <View style={styles.headerButtons}>
          <TouchableOpacity
            style={styles.trackButton}
            onPress={() => router.push('/live-trip')}
          >
            <Ionicons name="play" size={20} color="#FFF" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => router.push('/add-mileage')}
          >
            <Ionicons name="add" size={24} color="#FFF" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Stats */}
      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{totalMiles.toFixed(0)}</Text>
          <Text style={styles.statLabel}>Total Miles</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statValue, { color: '#00D9A5' }]}>
            {businessMiles.toFixed(0)}
          </Text>
          <Text style={styles.statLabel}>Business Miles</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statValue, { color: '#7C6BFF' }]}>
            ${totalDeduction.toFixed(0)}
          </Text>
          <Text style={styles.statLabel}>Deduction</Text>
        </View>
      </View>

      {/* IRS Rate Info */}
      <View style={styles.rateInfo}>
        <Ionicons name="information-circle" size={16} color="#6B6B7B" />
        <Text style={styles.rateText}>
          2025 IRS Rate: ${IRS_MILEAGE_RATE}/mile for business use
        </Text>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#00D9A5" />
        </View>
      ) : entries.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="car-outline" size={64} color="#2A2A35" />
          <Text style={styles.emptyTitle}>No trips logged</Text>
          <Text style={styles.emptySubtitle}>
            Track your driving with GPS to maximize tax deductions
          </Text>
          <TouchableOpacity
            style={styles.emptyButton}
            onPress={() => router.push('/live-trip')}
          >
            <Ionicons name="play" size={20} color="#FFF" />
            <Text style={styles.emptyButtonText}>Start Live Trip</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.emptyButtonSecondary}
            onPress={() => router.push('/add-mileage')}
          >
            <Ionicons name="create-outline" size={18} color="#7C6BFF" />
            <Text style={styles.emptyButtonSecondaryText}>Add Manually</Text>
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
              tintColor="#00D9A5"
            />
          }
          showsVerticalScrollIndicator={false}
        />
      )}
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
  title: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '700',
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  trackButton: {
    backgroundColor: '#00D9A5',
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addButton: {
    backgroundColor: '#7C6BFF',
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 10,
    marginBottom: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#14141A',
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
  },
  statValue: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '700',
  },
  statLabel: {
    color: '#6B6B7B',
    fontSize: 11,
    marginTop: 4,
  },
  rateInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 16,
    gap: 6,
  },
  rateText: {
    color: '#6B6B7B',
    fontSize: 13,
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
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '600',
    marginTop: 16,
  },
  emptySubtitle: {
    color: '#6B6B7B',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#00D9A5',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 24,
    gap: 8,
  },
  emptyButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  emptyButtonSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    marginTop: 12,
    gap: 6,
  },
  emptyButtonSecondaryText: {
    color: '#7C6BFF',
    fontSize: 14,
    fontWeight: '500',
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  tripCard: {
    backgroundColor: '#14141A',
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
  },
  tripHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  purposeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    gap: 6,
  },
  purposeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  purposeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  tripDate: {
    color: '#6B6B7B',
    fontSize: 12,
  },
  tripRoute: {
    marginBottom: 14,
  },
  routePoint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  routeLine: {
    width: 2,
    height: 16,
    backgroundColor: '#2A2A35',
    marginLeft: 6,
    marginVertical: 4,
  },
  routeText: {
    color: '#FFFFFF',
    fontSize: 14,
    flex: 1,
  },
  tripFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#1A1A22',
    paddingTop: 12,
  },
  tripStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tripStatText: {
    color: '#6B6B7B',
    fontSize: 14,
  },
  tripDeduction: {
    color: '#00D9A5',
    fontSize: 16,
    fontWeight: '700',
  },
});
