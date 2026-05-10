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

interface MissingDeduction {
  name: string;
  description: string;
  avg_value: number;
  category: string;
  current_tracked: number;
  potential_savings: number;
}

interface AnalysisResult {
  deduction_score: number;
  current_deductions: {
    expenses: number;
    mileage: number;
    total: number;
  };
  total_income: number;
  deduction_rate: number;
  profession_detected: string;
  missing_deductions: MissingDeduction[];
  expense_breakdown: Record<string, number>;
  tips: string[];
  potential_additional_savings: number;
  receipts_count: number;
  trips_count: number;
}

export default function DeductionMaximizerScreen() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadAnalysis = async () => {
    try {
      setError(null);
      const result = await api.getDeductionAnalysis();
      setAnalysis(result);
    } catch (err: any) {
      console.error('Failed to load deduction analysis:', err);
      setError('Failed to load analysis. Please try again.');
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadAnalysis();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadAnalysis();
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return '#00D9A5';
    if (score >= 60) return '#FFB84D';
    return '#FF6B6B';
  };

  const getProfessionLabel = (profession: string) => {
    const labels: Record<string, string> = {
      rideshare: 'Rideshare Driver',
      delivery: 'Delivery Driver',
      freelance: 'Freelancer',
      general: 'Self-Employed',
    };
    return labels[profession] || 'Self-Employed';
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#00D9A5" />
          <Text style={styles.loadingText}>Analyzing your deductions...</Text>
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
          <TouchableOpacity style={styles.retryButton} onPress={loadAnalysis}>
            <Text style={styles.retryText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Deduction Maximizer</Text>
        <View style={styles.headerBadge}>
          <Ionicons name="trending-up" size={14} color="#00D9A5" />
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#00D9A5" />
        }
      >
        {/* Deduction Health Score */}
        <View style={styles.scoreCard}>
          <View style={[styles.scoreCircle, { borderColor: getScoreColor(analysis?.deduction_score || 0) }]}>
            <Text style={[styles.scoreValue, { color: getScoreColor(analysis?.deduction_score || 0) }]}>
              {analysis?.deduction_score || 0}
            </Text>
            <Text style={styles.scoreLabel}>Score</Text>
          </View>
          <View style={styles.scoreDetails}>
            <Text style={styles.scoreTitle}>Deduction Health</Text>
            <Text style={styles.scoreSubtitle}>
              {(analysis?.deduction_score || 0) >= 80
                ? 'Excellent! You\'re maximizing deductions'
                : (analysis?.deduction_score || 0) >= 60
                ? 'Good, but room for improvement'
                : 'You may be missing significant deductions'}
            </Text>
            <View style={styles.professionBadge}>
              <Ionicons name="briefcase" size={14} color="#7C6BFF" />
              <Text style={styles.professionText}>
                {getProfessionLabel(analysis?.profession_detected || 'general')}
              </Text>
            </View>
          </View>
        </View>

        {/* Current Deductions Summary */}
        <View style={styles.summaryCard}>
          <Text style={styles.sectionTitle}>Current Deductions</Text>
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Total Income</Text>
              <Text style={styles.summaryValue}>{formatCurrency(analysis?.total_income || 0)}</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Deduction Rate</Text>
              <Text style={styles.summaryValue}>{analysis?.deduction_rate || 0}%</Text>
            </View>
          </View>
          <View style={styles.deductionBreakdown}>
            <View style={styles.breakdownItem}>
              <Ionicons name="receipt" size={18} color="#7C6BFF" />
              <Text style={styles.breakdownLabel}>Expenses</Text>
              <Text style={styles.breakdownValue}>
                {formatCurrency(analysis?.current_deductions?.expenses || 0)}
              </Text>
            </View>
            <View style={styles.breakdownItem}>
              <Ionicons name="car" size={18} color="#00D9A5" />
              <Text style={styles.breakdownLabel}>Mileage</Text>
              <Text style={styles.breakdownValue}>
                {formatCurrency(analysis?.current_deductions?.mileage || 0)}
              </Text>
            </View>
            <View style={[styles.breakdownItem, styles.breakdownTotal]}>
              <Ionicons name="calculator" size={18} color="#FFB84D" />
              <Text style={styles.breakdownLabel}>Total</Text>
              <Text style={[styles.breakdownValue, styles.totalValue]}>
                {formatCurrency(analysis?.current_deductions?.total || 0)}
              </Text>
            </View>
          </View>
        </View>

        {/* Missing Deductions */}
        {analysis?.missing_deductions && analysis.missing_deductions.length > 0 && (
          <View style={styles.missingSection}>
            <View style={styles.missingSectionHeader}>
              <Text style={styles.sectionTitle}>Deductions You May Be Missing</Text>
              <View style={styles.savingsBadge}>
                <Text style={styles.savingsText}>
                  Save up to {formatCurrency(analysis?.potential_additional_savings || 0)}
                </Text>
              </View>
            </View>
            {analysis.missing_deductions.map((deduction, index) => (
              <View key={index} style={styles.deductionCard}>
                <View style={styles.deductionHeader}>
                  <Text style={styles.deductionName}>{deduction.name}</Text>
                  <Text style={styles.deductionPotential}>
                    ~{formatCurrency(deduction.avg_value)}/yr
                  </Text>
                </View>
                <Text style={styles.deductionDesc}>{deduction.description}</Text>
                <View style={styles.deductionFooter}>
                  <View style={styles.categoryBadge}>
                    <Text style={styles.categoryText}>{deduction.category}</Text>
                  </View>
                  {deduction.current_tracked > 0 && (
                    <Text style={styles.trackedText}>
                      Currently: {formatCurrency(deduction.current_tracked)}
                    </Text>
                  )}
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Pro Tips */}
        {analysis?.tips && analysis.tips.length > 0 && (
          <View style={styles.tipsSection}>
            <Text style={styles.sectionTitle}>Pro Tips</Text>
            {analysis.tips.map((tip, index) => (
              <View key={index} style={styles.tipCard}>
                <Ionicons name="bulb" size={20} color="#FFB84D" />
                <Text style={styles.tipText}>{tip}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Quick Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Ionicons name="receipt-outline" size={24} color="#7C6BFF" />
            <Text style={styles.statValue}>{analysis?.receipts_count || 0}</Text>
            <Text style={styles.statLabel}>Receipts</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="car-outline" size={24} color="#00D9A5" />
            <Text style={styles.statValue}>{analysis?.trips_count || 0}</Text>
            <Text style={styles.statLabel}>Trips</Text>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionSection}>
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => router.push('/add-receipt')}
          >
            <Ionicons name="add-circle" size={20} color="#FFFFFF" />
            <Text style={styles.actionButtonText}>Add Receipt</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.actionButton, styles.actionButtonSecondary]}
            onPress={() => router.push('/add-mileage')}
          >
            <Ionicons name="car" size={20} color="#00D9A5" />
            <Text style={[styles.actionButtonText, styles.actionButtonTextSecondary]}>Add Mileage</Text>
          </TouchableOpacity>
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
    backgroundColor: '#00D9A520',
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
  // Score Card
  scoreCard: {
    backgroundColor: '#14141A',
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  scoreCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#1A1A22',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
  },
  scoreValue: {
    fontSize: 28,
    fontWeight: '800',
  },
  scoreLabel: {
    color: '#6B6B7B',
    fontSize: 10,
    fontWeight: '600',
  },
  scoreDetails: {
    flex: 1,
    marginLeft: 16,
  },
  scoreTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },
  scoreSubtitle: {
    color: '#8A8A9A',
    fontSize: 13,
    marginTop: 4,
    lineHeight: 18,
  },
  professionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#7C6BFF20',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginTop: 8,
    gap: 6,
  },
  professionText: {
    color: '#7C6BFF',
    fontSize: 12,
    fontWeight: '600',
  },
  // Summary Card
  summaryCard: {
    backgroundColor: '#14141A',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  summaryItem: {
    flex: 1,
  },
  summaryLabel: {
    color: '#6B6B7B',
    fontSize: 12,
    marginBottom: 4,
  },
  summaryValue: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
  },
  deductionBreakdown: {
    backgroundColor: '#1A1A22',
    borderRadius: 10,
    padding: 12,
  },
  breakdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 10,
  },
  breakdownLabel: {
    flex: 1,
    color: '#8A8A9A',
    fontSize: 14,
  },
  breakdownValue: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  breakdownTotal: {
    borderTopWidth: 1,
    borderTopColor: '#2A2A35',
    marginTop: 4,
    paddingTop: 12,
  },
  totalValue: {
    color: '#FFB84D',
    fontSize: 16,
    fontWeight: '700',
  },
  // Missing Deductions
  missingSection: {
    marginBottom: 16,
  },
  missingSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  savingsBadge: {
    backgroundColor: '#00D9A520',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  savingsText: {
    color: '#00D9A5',
    fontSize: 11,
    fontWeight: '600',
  },
  deductionCard: {
    backgroundColor: '#14141A',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderLeftWidth: 3,
    borderLeftColor: '#FF6B6B',
  },
  deductionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  deductionName: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
  },
  deductionPotential: {
    color: '#00D9A5',
    fontSize: 14,
    fontWeight: '700',
  },
  deductionDesc: {
    color: '#8A8A9A',
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 10,
  },
  deductionFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  categoryBadge: {
    backgroundColor: '#2A2A35',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  categoryText: {
    color: '#6B6B7B',
    fontSize: 11,
    fontWeight: '500',
  },
  trackedText: {
    color: '#6B6B7B',
    fontSize: 12,
  },
  // Tips
  tipsSection: {
    marginBottom: 16,
  },
  tipCard: {
    backgroundColor: '#14141A',
    borderRadius: 10,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
    gap: 12,
  },
  tipText: {
    flex: 1,
    color: '#DDDDDD',
    fontSize: 13,
    lineHeight: 19,
  },
  // Stats
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#14141A',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  statValue: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '700',
    marginTop: 8,
  },
  statLabel: {
    color: '#6B6B7B',
    fontSize: 12,
    marginTop: 4,
  },
  // Actions
  actionSection: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#7C6BFF',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  actionButtonSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: '#00D9A5',
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  actionButtonTextSecondary: {
    color: '#00D9A5',
  },
});
