import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { api } from '../src/services/api';

const EXPORT_OPTIONS = [
  {
    id: 'schedule_c',
    title: 'Schedule C Data',
    description: 'All deductions organized for Schedule C filing',
    icon: 'document-text',
    color: '#00D9A5',
    formats: ['PDF', 'CSV'],
  },
  {
    id: 'mileage_log',
    title: 'IRS Mileage Log',
    description: 'Complete mileage log with all required IRS fields',
    icon: 'car',
    color: '#7C6BFF',
    formats: ['PDF', 'CSV'],
  },
  {
    id: 'receipt_summary',
    title: 'Receipt Summary',
    description: 'All receipts with images and categorization',
    icon: 'receipt',
    color: '#FFB84D',
    formats: ['PDF'],
  },
  {
    id: 'cpa_package',
    title: 'CPA Package',
    description: 'Complete tax documentation for your accountant',
    icon: 'briefcase',
    color: '#FF6B6B',
    formats: ['PDF', 'ZIP'],
  },
];

const INTEGRATIONS = [
  {
    id: 'turbotax',
    name: 'TurboTax',
    description: 'Export directly to TurboTax',
    available: false,
    comingSoon: true,
  },
  {
    id: 'hrblock',
    name: 'H&R Block',
    description: 'Export to H&R Block',
    available: false,
    comingSoon: true,
  },
];

export default function ExportReportScreen() {
  const router = useRouter();
  const [generating, setGenerating] = useState<string | null>(null);
  const [dashboard, setDashboard] = useState<any>(null);

  const handleExport = async (exportId: string, format: string) => {
    setGenerating(`${exportId}_${format}`);
    
    // Simulate export generation
    await new Promise((resolve) => setTimeout(resolve, 2000));
    
    Alert.alert(
      'Export Ready',
      `Your ${format} file has been generated. In the production version, this would download or share the file.`,
      [{ text: 'OK' }]
    );
    
    setGenerating(null);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="close" size={28} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Export Reports</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Info Banner */}
        <View style={styles.infoBanner}>
          <Ionicons name="information-circle" size={20} color="#00D9A5" />
          <Text style={styles.infoText}>
            All exports are IRS-compliant and stored for 7 years
          </Text>
        </View>

        {/* Export Options */}
        <Text style={styles.sectionTitle}>Tax Documents</Text>
        {EXPORT_OPTIONS.map((option) => (
          <View key={option.id} style={styles.exportCard}>
            <View style={styles.exportHeader}>
              <View style={[styles.exportIcon, { backgroundColor: `${option.color}20` }]}>
                <Ionicons name={option.icon as any} size={24} color={option.color} />
              </View>
              <View style={styles.exportInfo}>
                <Text style={styles.exportTitle}>{option.title}</Text>
                <Text style={styles.exportDescription}>{option.description}</Text>
              </View>
            </View>
            <View style={styles.formatButtons}>
              {option.formats.map((format) => (
                <TouchableOpacity
                  key={format}
                  style={styles.formatButton}
                  onPress={() => handleExport(option.id, format)}
                  disabled={generating !== null}
                >
                  {generating === `${option.id}_${format}` ? (
                    <ActivityIndicator size="small" color="#00D9A5" />
                  ) : (
                    <>
                      <Ionicons
                        name={format === 'PDF' ? 'document' : format === 'CSV' ? 'grid' : 'folder'}
                        size={16}
                        color="#00D9A5"
                      />
                      <Text style={styles.formatButtonText}>{format}</Text>
                    </>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}

        {/* Tax Software Integrations */}
        <Text style={styles.sectionTitle}>Direct Integrations</Text>
        {INTEGRATIONS.map((integration) => (
          <View key={integration.id} style={styles.integrationCard}>
            <View style={styles.integrationInfo}>
              <Text style={styles.integrationName}>{integration.name}</Text>
              <Text style={styles.integrationDescription}>{integration.description}</Text>
            </View>
            {integration.comingSoon ? (
              <View style={styles.comingSoonBadge}>
                <Text style={styles.comingSoonText}>Coming Soon</Text>
              </View>
            ) : (
              <TouchableOpacity style={styles.connectButton}>
                <Text style={styles.connectButtonText}>Connect</Text>
              </TouchableOpacity>
            )}
          </View>
        ))}

        {/* Share with CPA */}
        <Text style={styles.sectionTitle}>Share Options</Text>
        <TouchableOpacity style={styles.shareCard}>
          <View style={styles.shareIcon}>
            <Ionicons name="link" size={24} color="#7C6BFF" />
          </View>
          <View style={styles.shareInfo}>
            <Text style={styles.shareTitle}>Generate CPA Share Link</Text>
            <Text style={styles.shareDescription}>
              Create an encrypted, time-limited link to share with your accountant
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={24} color="#6B6B7B" />
        </TouchableOpacity>

        {/* Storage Info */}
        <View style={styles.storageInfo}>
          <Ionicons name="shield-checkmark" size={20} color="#6B6B7B" />
          <Text style={styles.storageText}>
            All your tax documents are securely stored for 7 years, meeting IRS audit requirements.
          </Text>
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1A1A22',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#00D9A515',
    borderRadius: 12,
    padding: 14,
    marginBottom: 24,
    gap: 10,
  },
  infoText: {
    color: '#00D9A5',
    fontSize: 13,
    flex: 1,
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  exportCard: {
    backgroundColor: '#14141A',
    borderRadius: 16,
    padding: 18,
    marginBottom: 12,
  },
  exportHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  exportIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  exportInfo: {
    flex: 1,
    marginLeft: 14,
  },
  exportTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  exportDescription: {
    color: '#6B6B7B',
    fontSize: 13,
    marginTop: 2,
  },
  formatButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  formatButton: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1A1A22',
    paddingVertical: 12,
    borderRadius: 10,
    gap: 6,
  },
  formatButtonText: {
    color: '#00D9A5',
    fontSize: 14,
    fontWeight: '600',
  },
  integrationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#14141A',
    borderRadius: 16,
    padding: 18,
    marginBottom: 12,
  },
  integrationInfo: {
    flex: 1,
  },
  integrationName: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  integrationDescription: {
    color: '#6B6B7B',
    fontSize: 13,
    marginTop: 2,
  },
  comingSoonBadge: {
    backgroundColor: '#FFB84D20',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  comingSoonText: {
    color: '#FFB84D',
    fontSize: 12,
    fontWeight: '600',
  },
  connectButton: {
    backgroundColor: '#00D9A5',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  connectButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  shareCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#14141A',
    borderRadius: 16,
    padding: 18,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#7C6BFF30',
  },
  shareIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#7C6BFF20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  shareInfo: {
    flex: 1,
    marginLeft: 14,
  },
  shareTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  shareDescription: {
    color: '#6B6B7B',
    fontSize: 13,
    marginTop: 2,
  },
  storageInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#0F0F15',
    borderRadius: 12,
    padding: 14,
    gap: 10,
  },
  storageText: {
    color: '#6B6B7B',
    fontSize: 13,
    flex: 1,
    lineHeight: 20,
  },
});
