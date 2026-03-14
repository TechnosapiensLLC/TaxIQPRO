import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { api } from '../../src/services/api';
import { useAuth } from '../../src/context/AuthContext';

const { width } = Dimensions.get('window');

const getAuditRiskLevel = (score: number) => {
  if (score < 25) return { label: 'Low', color: '#00D9A5' };
  if (score < 50) return { label: 'Medium', color: '#FFB84D' };
  if (score < 75) return { label: 'High', color: '#FF8844' };
  return { label: 'Very High', color: '#FF6B6B' };
};

export default function DashboardScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [dashboard, setDashboard] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Calculate audit risk score (simplified - in production this would be from backend)
  const calculateAuditRisk = (data: any) => {
    let risk = 10; // Base risk
    const totalIncome = data?.total_income || 0;
    const totalExpenses = data?.total_expenses || 0;
    const mileageDeduction = data?.total_mileage_deduction || 0;
    
    // Risk factors
    if (totalIncome > 0) {
      const expenseRatio = (totalExpenses + mileageDeduction) / totalIncome;
      if (expenseRatio > 0.5) risk += 20; // High expense ratio
      if (expenseRatio > 0.75) risk += 15; // Very high expense ratio
    }
    
    // Missing documentation penalty
    const receiptCount = data?.receipts_count || 0;
    if (receiptCount < 5 && totalExpenses > 500) risk += 15;
    
    return Math.min(100, Math.max(0, risk));
  };

  const fetchDashboard = useCallback(async () => {
    try {
      const data = await api.getDashboard();
      setDashboard(data);
    } catch (error) {
      console.error('Error fetching dashboard:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchDashboard();
  }, [fetchDashboard]);

  const auditRisk = calculateAuditRisk(dashboard);
  const riskLevel = getAuditRiskLevel(auditRisk);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#00D9A5" />
          <Text style={styles.loadingText}>Loading your tax data...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#00D9A5"
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Welcome back, {user?.name || 'there'}!</Text>
            <View style={styles.logoRow}>
              <View style={styles.logoIcon}>
                <Ionicons name="analytics" size={18} color="#00D9A5" />
              </View>
              <Text style={styles.title}>TaxIQ Pro</Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.coachButton}
            onPress={() => router.push('/tax-coach')}
          >
            <Ionicons name="chatbubble-ellipses" size={22} color="#FFF" />
          </TouchableOpacity>
        </View>

        {/* Tax Summary Card */}
        <View style={styles.taxCard}>
          <View style={styles.taxCardHeader}>
            <Ionicons name="calculator" size={24} color="#00D9A5" />
            <Text style={styles.taxCardTitle}>Estimated Quarterly Tax</Text>
          </View>
          <Text style={styles.taxAmount}>
            ${dashboard?.quarterly_payment?.toLocaleString() || '0'}
          </Text>
          <Text style={styles.taxSubtext}>Next payment due: September 15, 2025</Text>
          <View style={styles.taxBreakdown}>
            <View style={styles.breakdownItem}>
              <Text style={styles.breakdownLabel}>Annual Estimate</Text>
              <Text style={styles.breakdownValue}>
                ${dashboard?.estimated_tax?.toLocaleString() || '0'}
              </Text>
            </View>
            <View style={styles.breakdownDivider} />
            <View style={styles.breakdownItem}>
              <Text style={styles.breakdownLabel}>Net Income</Text>
              <Text style={styles.breakdownValue}>
                ${dashboard?.net_income?.toLocaleString() || '0'}
              </Text>
            </View>
          </View>
        </View>

        {/* Audit Risk Score - Key Differentiator */}
        <View style={styles.auditRiskCard}>
          <View style={styles.auditRiskHeader}>
            <Ionicons name="shield-checkmark" size={24} color={riskLevel.color} />
            <Text style={styles.auditRiskTitle}>Audit Risk Score</Text>
          </View>
          <View style={styles.auditRiskContent}>
            <View style={styles.auditRiskGauge}>
              <Text style={[styles.auditRiskScore, { color: riskLevel.color }]}>
                {auditRisk}
              </Text>
              <Text style={styles.auditRiskMax}>/100</Text>
            </View>
            <View style={[styles.auditRiskBadge, { backgroundColor: `${riskLevel.color}20` }]}>
              <Text style={[styles.auditRiskLabel, { color: riskLevel.color }]}>
                {riskLevel.label} Risk
              </Text>
            </View>
          </View>
          <View style={styles.auditRiskBar}>
            <View 
              style={[
                styles.auditRiskFill, 
                { width: `${auditRisk}%`, backgroundColor: riskLevel.color }
              ]} 
            />
          </View>
          <Text style={styles.auditRiskTip}>
            {auditRisk < 30 
              ? "Your deductions look solid. Keep documenting!"
              : auditRisk < 60
              ? "Add more receipt photos to reduce risk."
              : "Consider reviewing your deductions with a CPA."}
          </Text>
        </View>

        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          <View style={[styles.statCard, styles.incomeCard]}>
            <Ionicons name="trending-up" size={28} color="#00D9A5" />
            <Text style={styles.statValue}>
              ${dashboard?.total_income?.toLocaleString() || '0'}
            </Text>
            <Text style={styles.statLabel}>Total Income</Text>
            <Text style={styles.statCount}>
              {dashboard?.income_entries_count || 0} entries
            </Text>
          </View>
          <View style={[styles.statCard, styles.expenseCard]}>
            <Ionicons name="receipt-outline" size={28} color="#FF6B6B" />
            <Text style={styles.statValue}>
              ${dashboard?.total_expenses?.toLocaleString() || '0'}
            </Text>
            <Text style={styles.statLabel}>Deductible Expenses</Text>
            <Text style={styles.statCount}>
              {dashboard?.receipts_count || 0} receipts
            </Text>
          </View>
        </View>

        {/* Mileage Card */}
        <View style={styles.mileageCard}>
          <View style={styles.mileageHeader}>
            <Ionicons name="car" size={24} color="#7C6BFF" />
            <View style={styles.mileageInfo}>
              <Text style={styles.mileageTitle}>Mileage Deduction</Text>
              <Text style={styles.mileageTrips}>
                {dashboard?.trips_count || 0} trips tracked
              </Text>
            </View>
          </View>
          <Text style={styles.mileageValue}>
            ${dashboard?.total_mileage_deduction?.toLocaleString() || '0'}
          </Text>
        </View>

        {/* Quick Actions */}
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.quickActions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => router.push('/scan')}
          >
            <View style={[styles.actionIcon, { backgroundColor: '#00D9A520' }]}>
              <Ionicons name="camera" size={24} color="#00D9A5" />
            </View>
            <Text style={styles.actionText}>Scan Receipt</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => router.push('/add-mileage')}
          >
            <View style={[styles.actionIcon, { backgroundColor: '#7C6BFF20' }]}>
              <Ionicons name="navigate" size={24} color="#7C6BFF" />
            </View>
            <Text style={styles.actionText}>Log Trip</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => router.push('/add-income')}
          >
            <View style={[styles.actionIcon, { backgroundColor: '#FFB84D20' }]}>
              <Ionicons name="add-circle" size={24} color="#FFB84D" />
            </View>
            <Text style={styles.actionText}>Add Income</Text>
          </TouchableOpacity>
        </View>

        {/* AI Tax Coach CTA */}
        <TouchableOpacity
          style={styles.coachCard}
          onPress={() => router.push('/tax-coach')}
        >
          <View style={styles.coachContent}>
            <View style={styles.coachIconContainer}>
              <Ionicons name="sparkles" size={28} color="#FFB84D" />
            </View>
            <View style={styles.coachTextContainer}>
              <Text style={styles.coachTitle}>AI Tax Coach</Text>
              <Text style={styles.coachDescription}>
                Get personalized tax advice and find hidden deductions
              </Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={24} color="#6B6B7B" />
        </TouchableOpacity>

        {/* Export Report CTA */}
        <TouchableOpacity
          style={styles.exportCard}
          onPress={() => router.push('/export-report')}
        >
          <Ionicons name="document-text" size={24} color="#7C6BFF" />
          <View style={styles.exportText}>
            <Text style={styles.exportTitle}>Generate Tax Report</Text>
            <Text style={styles.exportSubtitle}>Export for TurboTax, CPA, or IRS</Text>
          </View>
          <Ionicons name="download-outline" size={24} color="#7C6BFF" />
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0F',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#6B6B7B',
    marginTop: 12,
    fontSize: 14,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  greeting: {
    color: '#6B6B7B',
    fontSize: 14,
    marginBottom: 4,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#00D9A520',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '700',
  },
  coachButton: {
    backgroundColor: '#7C6BFF',
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  taxCard: {
    backgroundColor: '#14141A',
    borderRadius: 20,
    padding: 24,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#00D9A530',
  },
  taxCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  taxCardTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 10,
  },
  taxAmount: {
    color: '#00D9A5',
    fontSize: 42,
    fontWeight: '700',
    marginBottom: 4,
  },
  taxSubtext: {
    color: '#6B6B7B',
    fontSize: 13,
    marginBottom: 20,
  },
  taxBreakdown: {
    flexDirection: 'row',
    backgroundColor: '#1A1A22',
    borderRadius: 12,
    padding: 16,
  },
  breakdownItem: {
    flex: 1,
    alignItems: 'center',
  },
  breakdownDivider: {
    width: 1,
    backgroundColor: '#2A2A35',
  },
  breakdownLabel: {
    color: '#6B6B7B',
    fontSize: 12,
    marginBottom: 4,
  },
  breakdownValue: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  auditRiskCard: {
    backgroundColor: '#14141A',
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#2A2A35',
  },
  auditRiskHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  auditRiskTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 10,
  },
  auditRiskContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  auditRiskGauge: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  auditRiskScore: {
    fontSize: 48,
    fontWeight: '800',
  },
  auditRiskMax: {
    color: '#6B6B7B',
    fontSize: 18,
    fontWeight: '500',
  },
  auditRiskBadge: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  auditRiskLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  auditRiskBar: {
    height: 6,
    backgroundColor: '#1A1A22',
    borderRadius: 3,
    marginBottom: 12,
  },
  auditRiskFill: {
    height: '100%',
    borderRadius: 3,
  },
  auditRiskTip: {
    color: '#6B6B7B',
    fontSize: 13,
    lineHeight: 18,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#14141A',
    borderRadius: 16,
    padding: 18,
  },
  incomeCard: {
    borderWidth: 1,
    borderColor: '#00D9A520',
  },
  expenseCard: {
    borderWidth: 1,
    borderColor: '#FF6B6B20',
  },
  statValue: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '700',
    marginTop: 12,
  },
  statLabel: {
    color: '#6B6B7B',
    fontSize: 13,
    marginTop: 4,
  },
  statCount: {
    color: '#4A4A5A',
    fontSize: 12,
    marginTop: 2,
  },
  mileageCard: {
    backgroundColor: '#14141A',
    borderRadius: 16,
    padding: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#7C6BFF20',
  },
  mileageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  mileageInfo: {
    marginLeft: 12,
  },
  mileageTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  mileageTrips: {
    color: '#6B6B7B',
    fontSize: 13,
  },
  mileageValue: {
    color: '#7C6BFF',
    fontSize: 22,
    fontWeight: '700',
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  actionButton: {
    alignItems: 'center',
    width: (width - 60) / 3,
  },
  actionIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  actionText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '500',
  },
  coachCard: {
    backgroundColor: '#1A1A22',
    borderRadius: 16,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#FFB84D30',
    marginBottom: 12,
  },
  coachContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  coachIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#FFB84D15',
    justifyContent: 'center',
    alignItems: 'center',
  },
  coachTextContainer: {
    marginLeft: 14,
    flex: 1,
  },
  coachTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  coachDescription: {
    color: '#6B6B7B',
    fontSize: 13,
    marginTop: 2,
  },
  exportCard: {
    backgroundColor: '#14141A',
    borderRadius: 16,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#7C6BFF20',
  },
  exportText: {
    flex: 1,
    marginLeft: 14,
  },
  exportTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  exportSubtitle: {
    color: '#6B6B7B',
    fontSize: 12,
    marginTop: 2,
  },
});
