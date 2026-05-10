import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { api } from '../src/services/api';

interface QuarterSchedule {
  quarter: string;
  period: string;
  due_date: string;
  days_until_due: number;
  is_past: boolean;
  is_current: boolean;
  payment_amount: number;
}

interface EstimateResult {
  annual_estimate: {
    total_income: number;
    total_deductions: number;
    net_income: number;
    self_employment_tax: number;
    federal_income_tax: number;
    total_tax: number;
  };
  quarterly_payment: number;
  safe_harbor_payment: number;
  current_quarter: number;
  schedule: QuarterSchedule[];
  tax_rates: {
    self_employment: string;
    effective_income: string;
    effective_total: string;
  };
  breakdown: {
    gross_income: number;
    expense_deductions: number;
    mileage_deductions: number;
    se_tax_deduction: number;
    standard_deduction: number;
    taxable_income: number;
  };
  tips: string[];
}

export default function QuarterlyEstimatorScreen() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [estimate, setEstimate] = useState<EstimateResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showBreakdown, setShowBreakdown] = useState(false);

  const loadEstimate = async () => {
    try {
      setError(null);
      const result = await api.getQuarterlyEstimate();
      setEstimate(result);
    } catch (err: any) {
      console.error('Failed to load estimate:', err);
      setError('Failed to load estimate. Please try again.');
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadEstimate();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadEstimate();
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const getQuarterStatus = (quarter: QuarterSchedule) => {
    if (quarter.is_past) return { color: '#6B6B7B', icon: 'checkmark-circle', label: 'Past' };
    if (quarter.is_current) return { color: '#FFB84D', icon: 'time', label: 'Current' };
    return { color: '#00D9A5', icon: 'calendar', label: 'Upcoming' };
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#7C6BFF" />
          <Text style={styles.loadingText}>Calculating your estimates...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={48} color="#FF6B6B" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadEstimate}>
            <Text style={styles.retryText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const currentQuarter = estimate?.schedule?.find(q => q.is_current);
  const nextQuarter = estimate?.schedule?.find(q => !q.is_past && !q.is_current);

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Quarterly Estimator</Text>
        <View style={styles.headerBadge}>
          <Ionicons name="calculator" size={14} color="#7C6BFF" />
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#7C6BFF" />
        }
      >
        {/* Main Payment Card */}
        <View style={styles.paymentCard}>
          <Text style={styles.paymentLabel}>Quarterly Payment Due</Text>
          <Text style={styles.paymentAmount}>
            {formatCurrency(estimate?.quarterly_payment || 0)}
          </Text>
          {currentQuarter && (
            <View style={styles.dueDateBadge}>
              <Ionicons name="calendar" size={14} color="#FFB84D" />
              <Text style={styles.dueDateText}>
                {currentQuarter.days_until_due > 0
                  ? `Due in ${currentQuarter.days_until_due} days`
                  : 'Due now'}
              </Text>
            </View>
          )}
          <Text style={styles.annualNote}>
            Annual Estimated Tax: {formatCurrency(estimate?.annual_estimate?.total_tax || 0)}
          </Text>
        </View>

        {/* Tax Breakdown Summary */}
        <View style={styles.summaryCard}>
          <TouchableOpacity 
            style={styles.summaryHeader}
            onPress={() => setShowBreakdown(!showBreakdown)}
          >
            <Text style={styles.sectionTitle}>Tax Calculation</Text>
            <Ionicons 
              name={showBreakdown ? 'chevron-up' : 'chevron-down'} 
              size={20} 
              color="#6B6B7B" 
            />
          </TouchableOpacity>
          
          <View style={styles.summaryGrid}>
            <View style={styles.gridItem}>
              <Text style={styles.gridLabel}>Gross Income</Text>
              <Text style={[styles.gridValue, styles.incomeValue]}>
                {formatCurrency(estimate?.annual_estimate?.total_income || 0)}
              </Text>
            </View>
            <View style={styles.gridItem}>
              <Text style={styles.gridLabel}>Deductions</Text>
              <Text style={[styles.gridValue, styles.deductionValue]}>
                -{formatCurrency(estimate?.annual_estimate?.total_deductions || 0)}
              </Text>
            </View>
            <View style={styles.gridItem}>
              <Text style={styles.gridLabel}>Net Income</Text>
              <Text style={styles.gridValue}>
                {formatCurrency(estimate?.annual_estimate?.net_income || 0)}
              </Text>
            </View>
            <View style={styles.gridItem}>
              <Text style={styles.gridLabel}>Effective Rate</Text>
              <Text style={styles.gridValue}>{estimate?.tax_rates?.effective_total || '0%'}</Text>
            </View>
          </View>

          {showBreakdown && (
            <View style={styles.fullBreakdown}>
              <View style={styles.breakdownDivider} />
              <Text style={styles.breakdownTitle}>Detailed Breakdown</Text>
              
              <View style={styles.breakdownRow}>
                <Text style={styles.breakdownLabel}>Expense Deductions</Text>
                <Text style={styles.breakdownValue}>
                  {formatCurrency(estimate?.breakdown?.expense_deductions || 0)}
                </Text>
              </View>
              <View style={styles.breakdownRow}>
                <Text style={styles.breakdownLabel}>Mileage Deductions</Text>
                <Text style={styles.breakdownValue}>
                  {formatCurrency(estimate?.breakdown?.mileage_deductions || 0)}
                </Text>
              </View>
              <View style={styles.breakdownRow}>
                <Text style={styles.breakdownLabel}>SE Tax Deduction (50%)</Text>
                <Text style={styles.breakdownValue}>
                  {formatCurrency(estimate?.breakdown?.se_tax_deduction || 0)}
                </Text>
              </View>
              <View style={styles.breakdownRow}>
                <Text style={styles.breakdownLabel}>Standard Deduction</Text>
                <Text style={styles.breakdownValue}>
                  {formatCurrency(estimate?.breakdown?.standard_deduction || 0)}
                </Text>
              </View>
              <View style={[styles.breakdownRow, styles.breakdownRowHighlight]}>
                <Text style={styles.breakdownLabel}>Taxable Income</Text>
                <Text style={[styles.breakdownValue, styles.highlightValue]}>
                  {formatCurrency(estimate?.breakdown?.taxable_income || 0)}
                </Text>
              </View>
              
              <View style={styles.taxBreakdown}>
                <View style={styles.taxRow}>
                  <Text style={styles.taxLabel}>Self-Employment Tax (15.3%)</Text>
                  <Text style={styles.taxValue}>
                    {formatCurrency(estimate?.annual_estimate?.self_employment_tax || 0)}
                  </Text>
                </View>
                <View style={styles.taxRow}>
                  <Text style={styles.taxLabel}>Federal Income Tax</Text>
                  <Text style={styles.taxValue}>
                    {formatCurrency(estimate?.annual_estimate?.federal_income_tax || 0)}
                  </Text>
                </View>
                <View style={[styles.taxRow, styles.totalRow]}>
                  <Text style={styles.totalLabel}>Total Annual Tax</Text>
                  <Text style={styles.totalValue}>
                    {formatCurrency(estimate?.annual_estimate?.total_tax || 0)}
                  </Text>
                </View>
              </View>
            </View>
          )}
        </View>

        {/* Payment Schedule */}
        <View style={styles.scheduleSection}>
          <Text style={styles.sectionTitle}>Payment Schedule</Text>
          {estimate?.schedule?.map((quarter, index) => {
            const status = getQuarterStatus(quarter);
            return (
              <View 
                key={index} 
                style={[
                  styles.quarterCard,
                  quarter.is_current && styles.currentQuarterCard
                ]}
              >
                <View style={styles.quarterLeft}>
                  <View style={[styles.quarterIcon, { backgroundColor: `${status.color}20` }]}>
                    <Ionicons name={status.icon as any} size={18} color={status.color} />
                  </View>
                  <View>
                    <Text style={styles.quarterName}>{quarter.quarter}</Text>
                    <Text style={styles.quarterPeriod}>{quarter.period}</Text>
                  </View>
                </View>
                <View style={styles.quarterRight}>
                  <Text style={styles.quarterAmount}>
                    {formatCurrency(quarter.payment_amount)}
                  </Text>
                  <Text style={[styles.quarterDue, { color: status.color }]}>
                    {quarter.is_past 
                      ? 'Past' 
                      : quarter.days_until_due === 0 
                      ? 'Due Today'
                      : `${quarter.days_until_due} days`}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>

        {/* Tips */}
        <View style={styles.tipsSection}>
          <Text style={styles.sectionTitle}>Tax Tips</Text>
          {estimate?.tips?.map((tip, index) => (
            <View key={index} style={styles.tipCard}>
              <Ionicons name="information-circle" size={18} color="#7C6BFF" />
              <Text style={styles.tipText}>{tip}</Text>
            </View>
          ))}
        </View>

        {/* Safe Harbor Note */}
        <View style={styles.safeHarborCard}>
          <Ionicons name="shield-checkmark" size={24} color="#00D9A5" />
          <View style={styles.safeHarborContent}>
            <Text style={styles.safeHarborTitle}>Safe Harbor Payment</Text>
            <Text style={styles.safeHarborText}>
              Pay {formatCurrency(estimate?.safe_harbor_payment || 0)}/quarter to avoid underpayment penalties (based on 100% of estimated tax)
            </Text>
          </View>
        </View>

        {/* Actions */}
        <TouchableOpacity 
          style={styles.reminderButton}
          onPress={() => router.push('/notifications')}
        >
          <Ionicons name="notifications" size={20} color="#FFFFFF" />
          <Text style={styles.reminderButtonText}>Set Payment Reminders</Text>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#14141A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
  },
  headerBadge: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#7C6BFF20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#FFFFFF',
    fontSize: 16,
    marginTop: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    color: '#FF6B6B',
    fontSize: 16,
    marginTop: 12,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 20,
    backgroundColor: '#7C6BFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
  },
  retryText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  // Payment Card
  paymentCard: {
    backgroundColor: '#7C6BFF',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    marginBottom: 20,
  },
  paymentLabel: {
    color: '#FFFFFF',
    fontSize: 14,
    opacity: 0.9,
    marginBottom: 8,
  },
  paymentAmount: {
    color: '#FFFFFF',
    fontSize: 42,
    fontWeight: '800',
    marginBottom: 12,
  },
  dueDateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  dueDateText: {
    color: '#FFB84D',
    fontSize: 13,
    fontWeight: '600',
  },
  annualNote: {
    color: '#FFFFFF',
    fontSize: 12,
    opacity: 0.7,
    marginTop: 12,
  },
  // Summary
  summaryCard: {
    backgroundColor: '#14141A',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
  },
  summaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  gridItem: {
    width: '50%',
    paddingVertical: 10,
  },
  gridLabel: {
    color: '#6B6B7B',
    fontSize: 12,
    marginBottom: 4,
  },
  gridValue: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  incomeValue: {
    color: '#00D9A5',
  },
  deductionValue: {
    color: '#FF6B6B',
  },
  // Full Breakdown
  fullBreakdown: {
    marginTop: 8,
  },
  breakdownDivider: {
    height: 1,
    backgroundColor: '#2A2A35',
    marginVertical: 12,
  },
  breakdownTitle: {
    color: '#6B6B7B',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  breakdownRowHighlight: {
    backgroundColor: '#1A1A22',
    marginHorizontal: -8,
    paddingHorizontal: 8,
    borderRadius: 8,
    marginTop: 8,
  },
  breakdownLabel: {
    color: '#8A8A9A',
    fontSize: 13,
  },
  breakdownValue: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '500',
  },
  highlightValue: {
    color: '#FFB84D',
    fontWeight: '700',
  },
  taxBreakdown: {
    marginTop: 16,
    backgroundColor: '#1A1A22',
    borderRadius: 10,
    padding: 12,
  },
  taxRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  taxLabel: {
    color: '#8A8A9A',
    fontSize: 13,
  },
  taxValue: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '500',
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: '#2A2A35',
    marginTop: 8,
    paddingTop: 12,
  },
  totalLabel: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  totalValue: {
    color: '#FF6B6B',
    fontSize: 16,
    fontWeight: '700',
  },
  // Schedule
  scheduleSection: {
    marginBottom: 20,
  },
  quarterCard: {
    backgroundColor: '#14141A',
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
  },
  currentQuarterCard: {
    borderWidth: 1,
    borderColor: '#FFB84D',
  },
  quarterLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  quarterIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quarterName: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  quarterPeriod: {
    color: '#6B6B7B',
    fontSize: 11,
    marginTop: 2,
  },
  quarterRight: {
    alignItems: 'flex-end',
  },
  quarterAmount: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  quarterDue: {
    fontSize: 11,
    marginTop: 2,
  },
  // Tips
  tipsSection: {
    marginBottom: 20,
  },
  tipCard: {
    backgroundColor: '#14141A',
    borderRadius: 10,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 8,
    gap: 10,
  },
  tipText: {
    flex: 1,
    color: '#DDDDDD',
    fontSize: 13,
    lineHeight: 18,
  },
  // Safe Harbor
  safeHarborCard: {
    backgroundColor: '#00D9A515',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 20,
    gap: 12,
    borderWidth: 1,
    borderColor: '#00D9A530',
  },
  safeHarborContent: {
    flex: 1,
  },
  safeHarborTitle: {
    color: '#00D9A5',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  safeHarborText: {
    color: '#8A8A9A',
    fontSize: 12,
    lineHeight: 18,
  },
  // Reminder Button
  reminderButton: {
    backgroundColor: '#7C6BFF',
    borderRadius: 12,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  reminderButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
});
