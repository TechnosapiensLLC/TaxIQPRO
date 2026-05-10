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
      setAnalysis(result);
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

  const formatCurrency = (amount: number) => {
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
        return '#FF6B6B';
      case 'medium':
        return '#FFB84D';
      case 'low':
        return '#00D9A5';
      default:
        return '#6B6B7B';
    }
  };

  const renderUploadSection = () => (
    <View style={styles.uploadSection}>
      <View style={styles.uploadIcon}>
        <Ionicons name="document-text" size={48} color="#7C6BFF" />
      </View>
      <Text style={styles.uploadTitle}>Analyze Your Tax Filing</Text>
      <Text style={styles.uploadSubtitle}>
        Upload a previous tax return (Schedule C, 1040, 1099s) and our AI will identify missed deductions, recommend tax-saving strategies, and suggest if S-Corp could save you money.
      </Text>

      <View style={styles.uploadButtons}>
        <TouchableOpacity style={styles.uploadButton} onPress={pickDocument}>
          <Ionicons name="document" size={24} color="#FFFFFF" />
          <Text style={styles.uploadButtonText}>Upload PDF</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.uploadButton, styles.uploadButtonSecondary]} onPress={pickImage}>
          <Ionicons name="image" size={24} color="#7C6BFF" />
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
            <Ionicons name={icon as any} size={22} color="#7C6BFF" />
            <Text style={styles.sectionTitle}>{title}</Text>
          </View>
          <Ionicons
            name={isExpanded ? 'chevron-up' : 'chevron-down'}
            size={20}
            color="#6B6B7B"
          />
        </TouchableOpacity>
        {isExpanded && <View style={styles.sectionContent}>{content}</View>}
      </View>
    );
  };

  const renderAnalysisResults = () => {
    if (!analysis) return null;

    const totalMissedDeductions = analysis.missed_deductions.reduce(
      (sum, d) => sum + (d.estimated_value || 0),
      0
    );

    return (
      <View style={styles.resultsContainer}>
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
              <Ionicons name="trending-up" size={18} color="#00D9A5" />
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
              <Text style={styles.overviewValue}>{analysis.filing_type}</Text>
            </View>
            <View style={styles.overviewItem}>
              <Text style={styles.overviewLabel}>Tax Year</Text>
              <Text style={styles.overviewValue}>{analysis.tax_year}</Text>
            </View>
            <View style={styles.overviewItem}>
              <Text style={styles.overviewLabel}>Business Type</Text>
              <Text style={styles.overviewValue}>{analysis.business_type}</Text>
            </View>
            <View style={styles.overviewItem}>
              <Text style={styles.overviewLabel}>Total Income</Text>
              <Text style={[styles.overviewValue, styles.incomeValue]}>
                {formatCurrency(analysis.total_income)}
              </Text>
            </View>
            <View style={styles.overviewItem}>
              <Text style={styles.overviewLabel}>Total Deductions</Text>
              <Text style={[styles.overviewValue, styles.deductionValue]}>
                {formatCurrency(analysis.total_deductions)}
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
        {renderSection(
          `Missed Deductions (${analysis.missed_deductions.length})`,
          'missed',
          'alert-circle',
          <View>
            {analysis.missed_deductions.map((deduction, index) => (
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
        {renderSection(
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
                    <Text style={styles.priorityText}>{rec.priority.toUpperCase()}</Text>
                  </View>
                  <Text style={styles.recTitle}>{rec.title}</Text>
                </View>
                <Text style={styles.recDesc}>{rec.description}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Insights Section */}
        {renderSection('AI Insights', 'insights', 'sparkles', (
          <View>
            {analysis.insights.map((insight, index) => (
              <View key={index} style={styles.insightItem}>
                <Ionicons name="checkmark-circle" size={18} color="#00D9A5" />
                <Text style={styles.insightText}>{insight}</Text>
              </View>
            ))}
          </View>
        ))}

        {/* App Features Section */}
        {renderSection('Recommended Features', 'features', 'apps', (
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
                  <Ionicons name="wallet" size={20} color="#FFFFFF" />
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
                  <Ionicons name="receipt" size={20} color="#00D9A5" />
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
          <Ionicons name="add-circle" size={20} color="#7C6BFF" />
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
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Tax Filing Analyzer</Text>
        <View style={styles.headerBadge}>
          <Ionicons name="sparkles" size={14} color="#FFB84D" />
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
            <ActivityIndicator size="large" color="#7C6BFF" />
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
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFB84D20',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
  },
  headerBadgeText: {
    color: '#FFB84D',
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
    backgroundColor: '#7C6BFF15',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  uploadTitle: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
  },
  uploadSubtitle: {
    color: '#8A8A9A',
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
    backgroundColor: '#7C6BFF',
    paddingVertical: 16,
    borderRadius: 14,
    gap: 10,
  },
  uploadButtonSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: '#7C6BFF',
  },
  uploadButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  uploadButtonTextSecondary: {
    color: '#7C6BFF',
  },
  supportedFormats: {
    backgroundColor: '#14141A',
    padding: 16,
    borderRadius: 12,
    width: '100%',
  },
  supportedFormatsTitle: {
    color: '#6B6B7B',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
  },
  supportedFormatsText: {
    color: '#8A8A9A',
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
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 24,
    marginBottom: 8,
  },
  loadingSubtext: {
    color: '#6B6B7B',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  // Results
  resultsContainer: {
    paddingTop: 10,
  },
  // Score Card
  scoreCard: {
    backgroundColor: '#14141A',
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#7C6BFF30',
  },
  scoreCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#7C6BFF20',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#7C6BFF',
  },
  scoreValue: {
    color: '#7C6BFF',
    fontSize: 28,
    fontWeight: '800',
  },
  scoreLabel: {
    color: '#7C6BFF',
    fontSize: 10,
    fontWeight: '600',
  },
  scoreDetails: {
    flex: 1,
    marginLeft: 18,
  },
  scoreTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 4,
  },
  scoreSubtitle: {
    color: '#8A8A9A',
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 10,
  },
  savingsHighlight: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#00D9A515',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    alignSelf: 'flex-start',
    gap: 6,
  },
  savingsText: {
    color: '#00D9A5',
    fontSize: 13,
    fontWeight: '600',
  },
  // Sections
  sectionContainer: {
    backgroundColor: '#14141A',
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
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  sectionContent: {
    padding: 16,
    paddingTop: 0,
    borderTopWidth: 1,
    borderTopColor: '#1A1A22',
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
    backgroundColor: '#1A1A22',
    padding: 14,
    borderRadius: 10,
  },
  overviewLabel: {
    color: '#6B6B7B',
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 4,
  },
  overviewValue: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  incomeValue: {
    color: '#00D9A5',
  },
  deductionValue: {
    color: '#7C6BFF',
  },
  missedValue: {
    color: '#FF6B6B',
  },
  // Deductions
  deductionItem: {
    backgroundColor: '#1A1A22',
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
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  deductionAmount: {
    color: '#FF6B6B',
    fontSize: 15,
    fontWeight: '700',
  },
  deductionDesc: {
    color: '#8A8A9A',
    fontSize: 12,
    lineHeight: 18,
  },
  totalMissed: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FF6B6B15',
    padding: 14,
    borderRadius: 10,
    marginTop: 6,
  },
  totalMissedLabel: {
    color: '#FF6B6B',
    fontSize: 14,
    fontWeight: '600',
  },
  totalMissedValue: {
    color: '#FF6B6B',
    fontSize: 18,
    fontWeight: '800',
  },
  // Recommendations
  recItem: {
    backgroundColor: '#1A1A22',
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
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
  },
  recTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  recDesc: {
    color: '#8A8A9A',
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
    color: '#DDDDDD',
    fontSize: 13,
    lineHeight: 20,
    flex: 1,
  },
  // Features
  featureItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#1A1A22',
    padding: 12,
    borderRadius: 10,
    marginBottom: 10,
    gap: 12,
  },
  featurePriority: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#7C6BFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  featurePriorityText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  featureContent: {
    flex: 1,
  },
  featureName: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  featureReason: {
    color: '#8A8A9A',
    fontSize: 12,
    lineHeight: 18,
  },
  // Import Section
  importSection: {
    backgroundColor: '#14141A',
    borderRadius: 14,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#00D9A530',
  },
  importTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 6,
  },
  importSubtitle: {
    color: '#8A8A9A',
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
    backgroundColor: '#00D9A5',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  importButtonSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: '#00D9A5',
  },
  importButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  importButtonTextSecondary: {
    color: '#00D9A5',
  },
  // Analyze Another
  analyzeAnotherButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: '#7C6BFF',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
    marginTop: 10,
  },
  analyzeAnotherText: {
    color: '#7C6BFF',
    fontSize: 15,
    fontWeight: '600',
  },
});
