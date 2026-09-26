import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { api } from '../src/services/api';

import { useColors } from '../src/context/ThemeContext';
import type { Palette } from '../src/theme';
interface MissedDeduction {
  name: string;
  estimated_value: number;
  description: string;
}

interface Recommendation {
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
}

interface AppFeature {
  feature: string;
  reason: string;
  priority: number;
}

interface AnalysisResult {
  filing_type: string;
  tax_year: string;
  total_income: number;
  total_deductions: number;
  business_type: string;
  missed_deductions: MissedDeduction[];
  recommendations: Recommendation[];
  imported_data: {
    income_sources: Array<{ source: string; amount: number; is_1099?: boolean }>;
    expense_categories: Array<{ category: string; amount: number }>;
    business_info: { name: string; type: string; industry: string };
  };
  insights: string[];
  app_features_to_use: AppFeature[];
  potential_savings: number;
  tax_efficiency_score: number;
}

export default function TaxAnalyzerScreen() {
  const c = useColors();
  const styles = makeStyles(c);
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [expandedSection, setExpandedSection] = useState<string | null>('overview');

  const pickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf'],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const file = result.assets[0];
        console.log('Document picked:', {
          name: file.name,
          uri: file.uri,
          mimeType: file.mimeType,
          size: file.size
        });
        
        // Get file extension to determine type
        const fileExt = file.name?.split('.').pop()?.toLowerCase() || 'pdf';
        
        // On web, the file object may have a 'file' property with the actual File object
        const fileObj = (file as any).file;
        if (fileObj && Platform.OS === 'web') {
          // Web platform with File object - create a blob URL
          const blobUrl = URL.createObjectURL(fileObj);
          await analyzeFile(blobUrl, file.name || 'document.pdf', fileExt);
        } else {
          await analyzeFile(file.uri, file.name || 'document.pdf', fileExt);
        }
      }
    } catch (error: any) {
      console.error('Document picker error:', error);
      Alert.alert('Error', `Failed to pick document: ${error?.message || 'Unknown error'}`);
    }
  };

  const pickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please allow access to your photos to upload tax documents.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const file = result.assets[0];
        const ext = file.uri.split('.').pop() || 'jpg';
        await analyzeFile(file.uri, `tax-document.${ext}`, ext);
      }
    } catch (error) {
      console.error('Image picker error:', error);
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const analyzeFile = async (uri: string, name: string, type: string) => {
    setIsLoading(true);
    setAnalysis(null);

    try {
      const result = await api.analyzeTaxFiling(uri, name, type);
      console.log('API Response:', JSON.stringify(result, null, 2));
      
      // The API returns { id, filename, analysis } - we need the analysis object
      // But the response might also be the analysis directly
      if (result && result.analysis) {
        setAnalysis(result.analysis);
      } else if (result && (result.filing_type || result.total_income !== undefined)) {
        // Direct analysis response
        setAnalysis(result);
      } else {
        console.error('Invalid response structure:', result);
        Alert.alert('Error', 'Received invalid response from server');
      }
      setExpandedSection('overview');
    } catch (error: any) {
      console.error('Analysis error:', error);
      Alert.alert(
        'Analysis Failed',
        error?.response?.data?.detail || 'Failed to analyze the tax document. Please try again.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const importIncome = async () => {
    if (!analysis?.imported_data?.income_sources) return;
    
    try {
      const result = await api.importIncomeFromAnalysis(analysis.imported_data.income_sources);
      Alert.alert('Success', result.message || `Imported ${result.imported} income records`);
    } catch (error: any) {
      Alert.alert('Error', 'Failed to import income data');
    }
  };

  const importExpenses = async () => {
    if (!analysis?.imported_data?.expense_categories) return;
    
    try {
      const result = await api.importExpensesFromAnalysis(analysis.imported_data.expense_categories);
      Alert.alert('Success', result.message || `Imported ${result.imported} expense records`);
    } catch (error: any) {
      Alert.alert('Error', 'Failed to import expense data');
    }
  };

  const formatCurrency = (amount: number | undefined | null) => {
    // Handle undefined, null, NaN
    if (amount === undefined || amount === null || isNaN(amount)) {
      return '$0';
    }
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return c.danger;
      case 'medium':
        return c.warning;
      case 'low':
        return c.accent;
      default:
        return c.textMuted;
    }
  };

  const renderUploadSection = () => (
    <View style={styles.uploadSection}>
      <View style={styles.uploadIcon}>
        <Ionicons name="document-text" size={48} color={c.accentAlt} />
      </View>
      <Text style={styles.uploadTitle}>Analyze Your Tax Filing</Text>
      <Text style={styles.uploadSubtitle}>
        Upload a previous tax return (Schedule C, 1040, 1099s) and our AI will identify missed deductions, recommend tax-saving strategies, and suggest if S-Corp could save you money.
      </Text>

      <View style={styles.uploadButtons}>
        <TouchableOpacity style={styles.uploadButton} onPress={pickDocument}>
          <Ionicons name="document" size={24} color={c.text} />
          <Text style={styles.uploadButtonText}>Upload PDF</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.uploadButton, styles.uploadButtonSecondary]} onPress={pickImage}>
          <Ionicons name="image" size={24} color={c.accentAlt} />
          <Text style={[styles.uploadButtonText, styles.uploadButtonTextSecondary]}>Upload Image</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.supportedFormats}>
        <Text style={styles.supportedFormatsTitle}>Supported Documents:</Text>
        <Text style={styles.supportedFormatsText}>
          Schedule C, Form 1040, 1099-NEC, 1099-K, Form 1120-S, K-1, W-2
        </Text>
      </View>
    </View>
  );

  const renderSection = (
    title: string,
    sectionKey: string,
    icon: string,
    content: React.ReactNode
  ) => {
    const isExpanded = expandedSection === sectionKey;
    
    return (
      <View style={styles.sectionContainer}>
        <TouchableOpacity
          style={styles.sectionHeader}
          onPress={() => setExpandedSection(isExpanded ? null : sectionKey)}
        >
          <View style={styles.sectionHeaderLeft}>
            <Ionicons name={icon as any} size={22} color={c.accentAlt} />
            <Text style={styles.sectionTitle}>{title}</Text>
          </View>
          <Ionicons
            name={isExpanded ? 'chevron-up' : 'chevron-down'}
            size={20}
            color={c.textMuted}
          />
        </TouchableOpacity>
        {isExpanded && <View style={styles.sectionContent}>{content}</View>}
      </View>
    );
  };

  const renderAnalysisResults = () => {
    if (!analysis) return null;

    const missedDeductions = analysis.missed_deductions || [];
    const totalMissedDeductions = missedDeductions.reduce(
      (sum, d) => sum + (d.estimated_value || 0),
      0
    );

    return (
      <View style={styles.resultsContainer}>
        {/* Important Disclaimer Banner */}
        <View style={styles.disclaimerBanner}>
          <Ionicons name="warning" size={20} color={c.warning} />
          <View style={styles.disclaimerContent}>
            <Text style={styles.disclaimerTitle}>For Informational Purposes Only</Text>
            <Text style={styles.disclaimerText}>
              This analysis is based on document data and should be verified by a qualified tax professional (CPA) before making any tax decisions.
            </Text>
          </View>
        </View>

        {/* Tax Efficiency Score */}
        <View style={styles.scoreCard}>
          <View style={styles.scoreCircle}>
            <Text style={styles.scoreValue}>{analysis.tax_efficiency_score || 68}</Text>
            <Text style={styles.scoreLabel}>Tax Score</Text>
          </View>
          <View style={styles.scoreDetails}>
            <Text style={styles.scoreTitle}>Tax Efficiency Score</Text>
            <Text style={styles.scoreSubtitle}>
              {analysis.tax_efficiency_score >= 80
                ? 'Excellent! You\'re maximizing deductions'
                : analysis.tax_efficiency_score >= 60
                ? 'Good, but there\'s room for improvement'
                : 'Many deductions are being missed'}
            </Text>
            <View style={styles.savingsHighlight}>
              <Ionicons name="trending-up" size={18} color={c.accent} />
              <Text style={styles.savingsText}>
                Potential Savings: {formatCurrency(analysis.potential_savings || totalMissedDeductions * 0.25)}
              </Text>
            </View>
          </View>
        </View>

        {/* Overview Section */}
        {renderSection('Filing Overview', 'overview', 'document-text', (
          <View style={styles.overviewGrid}>
            <View style={styles.overviewItem}>
              <Text style={styles.overviewLabel}>Filing Type</Text>
              <Text style={styles.overviewValue}>{analysis.filing_type || 'Not detected'}</Text>
            </View>
            <View style={styles.overviewItem}>
              <Text style={styles.overviewLabel}>Tax Year</Text>
              <Text style={styles.overviewValue}>{analysis.tax_year || 'Unknown'}</Text>
            </View>
            <View style={styles.overviewItem}>
              <Text style={styles.overviewLabel}>Business Type</Text>
              <Text style={styles.overviewValue}>{analysis.business_type || 'Self-employed'}</Text>
            </View>
            <View style={styles.overviewItem}>
              <Text style={styles.overviewLabel}>Total Income</Text>
              <Text style={[styles.overviewValue, styles.incomeValue]}>
                {formatCurrency(analysis.total_income || 0)}
              </Text>
            </View>
            <View style={styles.overviewItem}>
              <Text style={styles.overviewLabel}>Total Deductions</Text>
              <Text style={[styles.overviewValue, styles.deductionValue]}>
                {formatCurrency(analysis.total_deductions || 0)}
              </Text>
            </View>
            <View style={styles.overviewItem}>
              <Text style={styles.overviewLabel}>Missing Deductions</Text>
              <Text style={[styles.overviewValue, styles.missedValue]}>
                {formatCurrency(totalMissedDeductions)}
              </Text>
            </View>
          </View>
        ))}

        {/* Missed Deductions Section */}
        {missedDeductions.length > 0 && renderSection(
          `Missed Deductions (${missedDeductions.length})`,
          'missed',
          'alert-circle',
          <View>
            {missedDeductions.map((deduction, index) => (
              <View key={index} style={styles.deductionItem}>
                <View style={styles.deductionHeader}>
                  <Text style={styles.deductionName}>{deduction.name}</Text>
                  <Text style={styles.deductionAmount}>
                    {formatCurrency(deduction.estimated_value)}
                  </Text>
                </View>
                <Text style={styles.deductionDesc}>{deduction.description}</Text>
              </View>
            ))}
            <View style={styles.totalMissed}>
              <Text style={styles.totalMissedLabel}>Total Missed:</Text>
              <Text style={styles.totalMissedValue}>
                {formatCurrency(totalMissedDeductions)}
              </Text>
            </View>
          </View>
        )}

        {/* Recommendations Section (S-Corp, etc.) */}
        {(analysis.recommendations?.length > 0) && renderSection(
          `Recommendations (${analysis.recommendations.length})`,
          'recommendations',
          'bulb',
          <View>
            {analysis.recommendations.map((rec, index) => (
              <View key={index} style={styles.recItem}>
                <View style={styles.recHeader}>
                  <View
                    style={[
                      styles.priorityBadge,
                      { backgroundColor: getPriorityColor(rec.priority) },
                    ]}
                  >
                    <Text style={styles.priorityText}>{rec.priority?.toUpperCase() || 'MEDIUM'}</Text>
                  </View>
                  <Text style={styles.recTitle}>{rec.title}</Text>
                </View>
                <Text style={styles.recDesc}>{rec.description}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Insights Section */}
        {(analysis.insights?.length > 0) && renderSection('AI Insights', 'insights', 'sparkles', (
          <View>
            {analysis.insights.map((insight, index) => (
              <View key={index} style={styles.insightItem}>
                <Ionicons name="checkmark-circle" size={18} color={c.accent} />
                <Text style={styles.insightText}>{insight}</Text>
              </View>
            ))}
          </View>
        ))}

        {/* App Features Section */}
        {(analysis.app_features_to_use?.length > 0) && renderSection('Recommended Features', 'features', 'apps', (
          <View>
            {analysis.app_features_to_use.map((feature, index) => (
              <View key={index} style={styles.featureItem}>
                <View style={styles.featurePriority}>
                  <Text style={styles.featurePriorityText}>{feature.priority}</Text>
                </View>
                <View style={styles.featureContent}>
                  <Text style={styles.featureName}>{feature.feature}</Text>
                  <Text style={styles.featureReason}>{feature.reason}</Text>
                </View>
              </View>
            ))}
          </View>
        ))}

        {/* Import Data Section */}
        {(analysis.imported_data?.income_sources?.length > 0 ||
          analysis.imported_data?.expense_categories?.length > 0) && (
          <View style={styles.importSection}>
            <Text style={styles.importTitle}>Import Extracted Data</Text>
            <Text style={styles.importSubtitle}>
              Add the income and expenses from your tax filing to start tracking this year.
            </Text>
            <View style={styles.importButtons}>
              {analysis.imported_data?.income_sources?.length > 0 && (
                <TouchableOpacity style={styles.importButton} onPress={importIncome}>
                  <Ionicons name="wallet" size={20} color={c.text} />
                  <Text style={styles.importButtonText}>
                    Import {analysis.imported_data.income_sources.length} Income Sources
                  </Text>
                </TouchableOpacity>
              )}
              {analysis.imported_data?.expense_categories?.length > 0 && (
                <TouchableOpacity
                  style={[styles.importButton, styles.importButtonSecondary]}
                  onPress={importExpenses}
                >
                  <Ionicons name="receipt" size={20} color={c.accent} />
                  <Text style={[styles.importButtonText, styles.importButtonTextSecondary]}>
                    Import {analysis.imported_data.expense_categories.length} Expense Categories
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        {/* Analyze Another Button */}
        <TouchableOpacity
          style={styles.analyzeAnotherButton}
          onPress={() => setAnalysis(null)}
        >
          <Ionicons name="add-circle" size={20} color={c.accentAlt} />
          <Text style={styles.analyzeAnotherText}>Analyze Another Document</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={c.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Tax Filing Analyzer</Text>
        <View style={styles.headerBadge}>
          <Ionicons name="sparkles" size={14} color={c.warning} />
          <Text style={styles.headerBadgeText}>AI</Text>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={c.accentAlt} />
            <Text style={styles.loadingText}>Analyzing your tax filing...</Text>
            <Text style={styles.loadingSubtext}>
              Our AI is reviewing your document for missed deductions, tax-saving opportunities, and entity structure recommendations.
            </Text>
          </View>
        ) : analysis ? (
          renderAnalysisResults()
        ) : (
          renderUploadSection()
        )}
      </ScrollView>
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
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: c.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    flex: 1,
    color: c.text,
    fontSize: 20,
    fontWeight: '700',
  },
  headerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: c.warning + '20',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
  },
  headerBadgeText: {
    color: c.warning,
    fontSize: 12,
    fontWeight: '700',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  // Upload Section
  uploadSection: {
    alignItems: 'center',
    paddingTop: 40,
  },
  uploadIcon: {
    width: 100,
    height: 100,
    borderRadius: 25,
    backgroundColor: c.accentAlt + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  uploadTitle: {
    color: c.text,
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
  },
  uploadSubtitle: {
    color: c.textTertiary,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    paddingHorizontal: 10,
    marginBottom: 32,
  },
  uploadButtons: {
    width: '100%',
    gap: 12,
    marginBottom: 32,
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.accentAlt,
    paddingVertical: 16,
    borderRadius: 14,
    gap: 10,
  },
  uploadButtonSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: c.accentAlt,
  },
  uploadButtonText: {
    color: c.onPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
  uploadButtonTextSecondary: {
    color: c.accentAlt,
  },
  supportedFormats: {
    backgroundColor: c.surface,
    padding: 16,
    borderRadius: 12,
    width: '100%',
  },
  supportedFormatsTitle: {
    color: c.textMuted,
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
  },
  supportedFormatsText: {
    color: c.textTertiary,
    fontSize: 13,
    lineHeight: 20,
  },
  // Loading
  loadingContainer: {
    alignItems: 'center',
    paddingTop: 80,
    paddingHorizontal: 20,
  },
  loadingText: {
    color: c.text,
    fontSize: 18,
    fontWeight: '600',
    marginTop: 24,
    marginBottom: 8,
  },
  loadingSubtext: {
    color: c.textMuted,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  // Results
  resultsContainer: {
    paddingTop: 10,
  },
  // Disclaimer Banner
  disclaimerBanner: {
    flexDirection: 'row',
    backgroundColor: c.warning + '15',
    borderWidth: 1,
    borderColor: c.warning + '40',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    gap: 12,
    alignItems: 'flex-start',
  },
  disclaimerContent: {
    flex: 1,
  },
  disclaimerTitle: {
    color: c.warning,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  disclaimerText: {
    color: '#B8A070',
    fontSize: 12,
    lineHeight: 18,
  },
  // Score Card
  scoreCard: {
    backgroundColor: c.surface,
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: c.accentAlt + '30',
  },
  scoreCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: c.accentAlt + '20',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: c.accentAlt,
  },
  scoreValue: {
    color: c.accentAlt,
    fontSize: 28,
    fontWeight: '800',
  },
  scoreLabel: {
    color: c.accentAlt,
    fontSize: 10,
    fontWeight: '600',
  },
  scoreDetails: {
    flex: 1,
    marginLeft: 18,
  },
  scoreTitle: {
    color: c.text,
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 4,
  },
  scoreSubtitle: {
    color: c.textTertiary,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 10,
  },
  savingsHighlight: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: c.accent + '15',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    alignSelf: 'flex-start',
    gap: 6,
  },
  savingsText: {
    color: c.accent,
    fontSize: 13,
    fontWeight: '600',
  },
  // Sections
  sectionContainer: {
    backgroundColor: c.surface,
    borderRadius: 14,
    marginBottom: 14,
    overflow: 'hidden',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  sectionTitle: {
    color: c.text,
    fontSize: 16,
    fontWeight: '600',
  },
  sectionContent: {
    padding: 16,
    paddingTop: 0,
    borderTopWidth: 1,
    borderTopColor: c.surfaceAlt,
  },
  // Overview Grid
  overviewGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingTop: 12,
    gap: 12,
  },
  overviewItem: {
    width: '48%',
    backgroundColor: c.surfaceAlt,
    padding: 14,
    borderRadius: 10,
  },
  overviewLabel: {
    color: c.textMuted,
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 4,
  },
  overviewValue: {
    color: c.text,
    fontSize: 15,
    fontWeight: '600',
  },
  incomeValue: {
    color: c.accent,
  },
  deductionValue: {
    color: c.accentAlt,
  },
  missedValue: {
    color: c.danger,
  },
  // Deductions
  deductionItem: {
    backgroundColor: c.surfaceAlt,
    padding: 14,
    borderRadius: 10,
    marginBottom: 10,
  },
  deductionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  deductionName: {
    color: c.text,
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  deductionAmount: {
    color: c.danger,
    fontSize: 15,
    fontWeight: '700',
  },
  deductionDesc: {
    color: c.textTertiary,
    fontSize: 12,
    lineHeight: 18,
  },
  totalMissed: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: c.danger + '15',
    padding: 14,
    borderRadius: 10,
    marginTop: 6,
  },
  totalMissedLabel: {
    color: c.danger,
    fontSize: 14,
    fontWeight: '600',
  },
  totalMissedValue: {
    color: c.danger,
    fontSize: 18,
    fontWeight: '800',
  },
  // Recommendations
  recItem: {
    backgroundColor: c.surfaceAlt,
    padding: 14,
    borderRadius: 10,
    marginBottom: 10,
  },
  recHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  priorityText: {
    color: c.text,
    fontSize: 9,
    fontWeight: '800',
  },
  recTitle: {
    color: c.text,
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  recDesc: {
    color: c.textTertiary,
    fontSize: 13,
    lineHeight: 19,
  },
  // Insights
  insightItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 12,
  },
  insightText: {
    color: c.textSecondary,
    fontSize: 13,
    lineHeight: 20,
    flex: 1,
  },
  // Features
  featureItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: c.surfaceAlt,
    padding: 12,
    borderRadius: 10,
    marginBottom: 10,
    gap: 12,
  },
  featurePriority: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: c.accentAlt,
    justifyContent: 'center',
    alignItems: 'center',
  },
  featurePriorityText: {
    color: c.onPrimary,
    fontSize: 12,
    fontWeight: '700',
  },
  featureContent: {
    flex: 1,
  },
  featureName: {
    color: c.text,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  featureReason: {
    color: c.textTertiary,
    fontSize: 12,
    lineHeight: 18,
  },
  // Import Section
  importSection: {
    backgroundColor: c.surface,
    borderRadius: 14,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: c.accent + '30',
  },
  importTitle: {
    color: c.text,
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 6,
  },
  importSubtitle: {
    color: c.textTertiary,
    fontSize: 13,
    marginBottom: 16,
  },
  importButtons: {
    gap: 10,
  },
  importButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.accent,
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  importButtonSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: c.accent,
  },
  importButtonText: {
    color: c.onPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  importButtonTextSecondary: {
    color: c.accent,
  },
  // Analyze Another
  analyzeAnotherButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: c.accentAlt,
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
    marginTop: 10,
  },
  analyzeAnotherText: {
    color: c.accentAlt,
    fontSize: 15,
    fontWeight: '600',
  },
});
