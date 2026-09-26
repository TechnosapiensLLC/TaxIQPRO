import React, { useCallback, useEffect, useState } from 'react';
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
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { api } from '../src/services/api';
import { downloadExport } from '../src/services/download';
import { useColors } from '../src/context/ThemeContext';
import type { Palette } from '../src/theme';

const YEAR = new Date().getFullYear();

const EXPORT_OPTIONS = [
  {
    id: 'schedule_c',
    title: 'Schedule C Data',
    description: 'All deductions organized for Schedule C filing',
    icon: 'document-text',
    tone: 'accent',
    formats: [
      { label: 'PDF', path: '/export/schedule-c.pdf', file: `Schedule_C_${YEAR}.pdf` },
      { label: 'CSV', path: '/export/schedule-c.csv', file: `Schedule_C_${YEAR}.csv` },
    ],
  },
  {
    id: 'mileage_log',
    title: 'IRS Mileage Log',
    description: 'Complete mileage log with all required IRS fields',
    icon: 'car',
    tone: 'accentAlt',
    formats: [
      { label: 'PDF', path: '/export/mileage-log.pdf', file: `IRS_Mileage_Log_${YEAR}.pdf` },
      { label: 'CSV', path: '/export/mileage-log.csv', file: `IRS_Mileage_Log_${YEAR}.csv` },
    ],
  },
  {
    id: 'receipt_summary',
    title: 'Receipt Summary',
    description: 'Every receipt with category and deductible status',
    icon: 'receipt',
    tone: 'warning',
    formats: [
      { label: 'PDF', path: '/export/receipt-summary.pdf', file: `Receipt_Summary_${YEAR}.pdf` },
    ],
  },
  {
    id: 'cpa_package',
    title: 'CPA Package',
    description: 'Complete tax documentation for your accountant',
    icon: 'briefcase',
    tone: 'danger',
    formats: [
      { label: 'PDF', path: '/export/cpa-package.pdf', file: `CPA_Package_${YEAR}.pdf` },
    ],
  },
];

const ACCOUNTING_OPTIONS = [
  {
    id: 'quickbooks_online_csv',
    name: 'QuickBooks Online',
    description: '3-column bank import (Banking → Upload transactions)',
    file: `QuickBooks_Online_${YEAR}.csv`,
  },
  {
    id: 'quickbooks_iif',
    name: 'QuickBooks Desktop (IIF)',
    description: 'General journal import (File → Utilities → Import → IIF)',
    file: `QuickBooks_Desktop_${YEAR}.iif`,
  },
  {
    id: 'quickbooks_desktop_csv',
    name: 'QuickBooks Desktop (CSV)',
    description: '3-column bank transactions file',
    file: `QuickBooks_Desktop_${YEAR}.csv`,
  },
  {
    id: 'xero_csv',
    name: 'Xero',
    description: 'Bank statement import with account codes',
    file: `Xero_${YEAR}.csv`,
  },
  {
    id: 'sage_csv',
    name: 'Sage',
    description: 'Balanced debit/credit journal import',
    file: `Sage_${YEAR}.csv`,
  },
];

export default function ExportReportScreen() {
  const c = useColors();
  const styles = makeStyles(c);
  const router = useRouter();
  const params = useLocalSearchParams<{ qbo?: string }>();
  const [busy, setBusy] = useState<string | null>(null);
  const [preview, setPreview] = useState<any>(null);
  const [qbo, setQbo] = useState<any>(null);

  const loadQbo = useCallback(async () => {
    try {
      setQbo(await api.getQboStatus());
    } catch {
      setQbo(null);
    }
  }, []);

  useEffect(() => {
    api.getTurboTaxPreview({ year: YEAR }).then(setPreview).catch(() => setPreview(null));
    loadQbo();
  }, [loadQbo]);

  useEffect(() => {
    if (params.qbo === 'connected') {
      Alert.alert('QuickBooks connected', 'Your QuickBooks Online company is now linked.');
      loadQbo();
    } else if (params.qbo === 'denied' || params.qbo === 'error') {
      Alert.alert('QuickBooks not connected', 'Authorization was cancelled or failed.');
    }
  }, [params.qbo, loadQbo]);

  const runDownload = async (key: string, path: string, filename: string) => {
    setBusy(key);
    try {
      const result = await downloadExport(path, filename);
      if (Platform.OS === 'web') {
        Alert.alert('Download started', `${result.filename} is saving to your device.`);
      }
    } catch (error: any) {
      Alert.alert('Export failed', error?.message || 'Could not generate the file.');
    } finally {
      setBusy(null);
    }
  };

  const connectQuickBooks = async () => {
    setBusy('qbo_connect');
    try {
      const { url } = await api.getQboAuthUrl(Platform.OS === 'web' ? 'web' : 'native');
      if (Platform.OS === 'web') {
        globalThis.location.assign(url);
      } else {
        await WebBrowser.openAuthSessionAsync(url, 'taxiqpro://export-report');
        await loadQbo();
      }
    } catch (error: any) {
      Alert.alert(
        'QuickBooks unavailable',
        error?.response?.data?.detail ||
          'QuickBooks Online is not configured yet. Add your Intuit app credentials first.'
      );
    } finally {
      setBusy(null);
    }
  };

  const disconnectQuickBooks = async () => {
    setBusy('qbo_connect');
    try {
      await api.disconnectQbo();
      await loadQbo();
    } finally {
      setBusy(null);
    }
  };

  const toneColor = (tone: string) =>
    tone === 'accent' ? c.accent : tone === 'accentAlt' ? c.accentAlt : tone === 'warning' ? c.warning : c.danger;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="close" size={28} color={c.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Export Reports</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {preview && (
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>Tax year {preview.tax_year}</Text>
            <View style={styles.summaryRow}>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryValue}>
                  ${Number(preview.summary?.total_gross_income || 0).toLocaleString()}
                </Text>
                <Text style={styles.summaryLabel}>Income</Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryValue}>
                  ${Number(preview.summary?.total_deductions || 0).toLocaleString()}
                </Text>
                <Text style={styles.summaryLabel}>Deductions</Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryValue}>
                  {Number(preview.summary?.total_mileage_miles || 0).toLocaleString()}
                </Text>
                <Text style={styles.summaryLabel}>Miles</Text>
              </View>
            </View>
            <Text style={styles.summaryMeta}>
              {preview.record_counts?.expenses || 0} expenses •{' '}
              {preview.record_counts?.mileage || 0} trips •{' '}
              {preview.record_counts?.income || 0} income entries
            </Text>
          </View>
        )}

        {/* TurboTax */}
        <Text style={styles.sectionTitle}>File with TurboTax</Text>
        <View style={styles.featureCard}>
          <View style={styles.exportHeader}>
            <View style={[styles.exportIcon, { backgroundColor: c.accent + '20' }]}>
              <Ionicons name="cloud-download" size={24} color={c.accent} />
            </View>
            <View style={styles.exportInfo}>
              <Text style={styles.exportTitle}>TurboTax Self-Employed Export</Text>
              <Text style={styles.exportDescription}>
                Summary, Schedule C totals, income, expenses and mileage in one import-ready file
              </Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() =>
              runDownload('turbotax', `/export/turbotax.csv?year=${YEAR}`, `TurboTax_Export_${YEAR}.csv`)
            }
            disabled={busy !== null}
          >
            {busy === 'turbotax' ? (
              <ActivityIndicator size="small" color={c.onPrimary} />
            ) : (
              <>
                <Ionicons name="download-outline" size={18} color={c.onPrimary} />
                <Text style={styles.primaryButtonText}>Download TurboTax CSV</Text>
              </>
            )}
          </TouchableOpacity>
          {preview?.instructions?.length ? (
            <View style={styles.stepsBox}>
              {preview.instructions.map((step: string) => (
                <Text key={step} style={styles.stepText}>
                  {step}
                </Text>
              ))}
            </View>
          ) : null}
        </View>

        {/* Tax documents */}
        <Text style={styles.sectionTitle}>Tax Documents</Text>
        {EXPORT_OPTIONS.map((option) => (
          <View key={option.id} style={styles.exportCard}>
            <View style={styles.exportHeader}>
              <View style={[styles.exportIcon, { backgroundColor: toneColor(option.tone) + '20' }]}>
                <Ionicons name={option.icon as any} size={24} color={toneColor(option.tone)} />
              </View>
              <View style={styles.exportInfo}>
                <Text style={styles.exportTitle}>{option.title}</Text>
                <Text style={styles.exportDescription}>{option.description}</Text>
              </View>
            </View>
            <View style={styles.formatButtons}>
              {option.formats.map((format) => {
                const key = `${option.id}_${format.label}`;
                return (
                  <TouchableOpacity
                    key={format.label}
                    style={styles.formatButton}
                    onPress={() => runDownload(key, `${format.path}?year=${YEAR}`, format.file)}
                    disabled={busy !== null}
                  >
                    {busy === key ? (
                      <ActivityIndicator size="small" color={c.accent} />
                    ) : (
                      <>
                        <Ionicons
                          name={format.label === 'PDF' ? 'document' : 'grid'}
                          size={16}
                          color={c.accent}
                        />
                        <Text style={styles.formatButtonText}>{format.label}</Text>
                      </>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        ))}

        {/* Accounting exports */}
        <Text style={styles.sectionTitle}>Accounting Export</Text>
        <View style={styles.featureCard}>
          <View style={styles.exportHeader}>
            <View style={[styles.exportIcon, { backgroundColor: c.accentAlt + '20' }]}>
              <Ionicons name="calculator" size={24} color={c.accentAlt} />
            </View>
            <View style={styles.exportInfo}>
              <Text style={styles.exportTitle}>Send to your accounting software</Text>
              <Text style={styles.exportDescription}>
                Import-ready files for QuickBooks, Xero and Sage using your chart of accounts
              </Text>
            </View>
          </View>

          <TouchableOpacity style={styles.linkRow} onPress={() => router.push('/coa-mapping')}>
            <Ionicons name="options-outline" size={18} color={c.accent} />
            <Text style={styles.linkRowText}>Edit chart-of-accounts mapping</Text>
            <Ionicons name="chevron-forward" size={18} color={c.textMuted} />
          </TouchableOpacity>

          {ACCOUNTING_OPTIONS.map((option) => (
            <TouchableOpacity
              key={option.id}
              style={styles.accountingRow}
              onPress={() =>
                runDownload(
                  option.id,
                  `/export/accounting?format=${option.id}&year=${YEAR}`,
                  option.file
                )
              }
              disabled={busy !== null}
            >
              <View style={styles.accountingInfo}>
                <Text style={styles.accountingName}>{option.name}</Text>
                <Text style={styles.accountingDescription}>{option.description}</Text>
              </View>
              {busy === option.id ? (
                <ActivityIndicator size="small" color={c.accent} />
              ) : (
                <Ionicons name="download-outline" size={20} color={c.accent} />
              )}
            </TouchableOpacity>
          ))}
        </View>

        {/* QuickBooks Online live sync */}
        <Text style={styles.sectionTitle}>Live Sync</Text>
        <View style={styles.featureCard}>
          <View style={styles.exportHeader}>
            <View style={[styles.exportIcon, { backgroundColor: c.success + '20' }]}>
              <Ionicons name="sync" size={24} color={c.success} />
            </View>
            <View style={styles.exportInfo}>
              <Text style={styles.exportTitle}>QuickBooks Online</Text>
              <Text style={styles.exportDescription}>
                {qbo?.connected
                  ? `Connected • company ${qbo.realm_id} (${qbo.environment})`
                  : qbo?.configured
                  ? 'Post expenses, mileage and income straight into QuickBooks'
                  : 'Needs your Intuit app credentials before it can connect'}
              </Text>
            </View>
          </View>

          {qbo?.connected ? (
            <View style={styles.formatButtons}>
              <TouchableOpacity
                style={styles.primaryButtonHalf}
                onPress={() => router.push('/qbo-sync')}
                disabled={busy !== null}
              >
                <Ionicons name="cloud-upload-outline" size={18} color={c.onPrimary} />
                <Text style={styles.primaryButtonText}>Sync now</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.secondaryButtonHalf}
                onPress={disconnectQuickBooks}
                disabled={busy !== null}
              >
                <Text style={styles.secondaryButtonText}>Disconnect</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={[styles.primaryButton, !qbo?.configured && styles.primaryButtonMuted]}
              onPress={connectQuickBooks}
              disabled={busy !== null}
            >
              {busy === 'qbo_connect' ? (
                <ActivityIndicator size="small" color={c.onPrimary} />
              ) : (
                <>
                  <Ionicons name="link-outline" size={18} color={c.onPrimary} />
                  <Text style={styles.primaryButtonText}>Connect QuickBooks Online</Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.storageInfo}>
          <Ionicons name="shield-checkmark" size={20} color={c.textMuted} />
          <Text style={styles.storageText}>
            Exports are generated from your own records only. Verify all amounts with a tax
            professional before filing, and keep documentation for 7 years.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
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
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    headerTitle: {
      color: c.text,
      fontSize: 18,
      fontWeight: '600',
    },
    scrollView: { flex: 1 },
    scrollContent: { padding: 20, paddingBottom: 48 },
    summaryCard: {
      backgroundColor: c.brandTint,
      borderRadius: 20,
      padding: 18,
      marginBottom: 24,
      borderWidth: 1,
      borderColor: c.accent + '40',
    },
    summaryTitle: {
      color: c.accent,
      fontSize: 13,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.6,
      marginBottom: 12,
    },
    summaryRow: { flexDirection: 'row', gap: 12 },
    summaryItem: { flex: 1 },
    summaryValue: { color: c.text, fontSize: 18, fontWeight: '700' },
    summaryLabel: { color: c.textMuted, fontSize: 12, marginTop: 2 },
    summaryMeta: { color: c.textMuted, fontSize: 12, marginTop: 12 },
    sectionTitle: {
      color: c.text,
      fontSize: 18,
      fontWeight: '600',
      marginBottom: 16,
    },
    exportCard: {
      backgroundColor: c.surface,
      borderRadius: 16,
      padding: 18,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: c.border,
    },
    featureCard: {
      backgroundColor: c.surface,
      borderRadius: 16,
      padding: 18,
      marginBottom: 24,
      borderWidth: 1,
      borderColor: c.border,
    },
    exportHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
    exportIcon: {
      width: 48,
      height: 48,
      borderRadius: 14,
      justifyContent: 'center',
      alignItems: 'center',
    },
    exportInfo: { flex: 1, marginLeft: 14 },
    exportTitle: { color: c.text, fontSize: 16, fontWeight: '600' },
    exportDescription: { color: c.textMuted, fontSize: 13, marginTop: 2, lineHeight: 18 },
    formatButtons: { flexDirection: 'row', gap: 10 },
    formatButton: {
      flex: 1,
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: c.surfaceAlt,
      paddingVertical: 12,
      borderRadius: 12,
      gap: 6,
      minHeight: 48,
    },
    formatButtonText: { color: c.accent, fontSize: 14, fontWeight: '600' },
    primaryButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: c.accent,
      paddingVertical: 14,
      borderRadius: 14,
      minHeight: 48,
    },
    primaryButtonMuted: { opacity: 0.6 },
    primaryButtonHalf: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: c.accent,
      paddingVertical: 14,
      borderRadius: 14,
      minHeight: 48,
    },
    primaryButtonText: { color: c.onPrimary, fontSize: 15, fontWeight: '700' },
    secondaryButtonHalf: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.surfaceAlt,
      paddingVertical: 14,
      borderRadius: 14,
      minHeight: 48,
    },
    secondaryButtonText: { color: c.textMuted, fontSize: 15, fontWeight: '600' },
    stepsBox: {
      marginTop: 14,
      backgroundColor: c.surfaceAlt,
      borderRadius: 12,
      padding: 14,
      gap: 6,
    },
    stepText: { color: c.textMuted, fontSize: 12, lineHeight: 17 },
    linkRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 14,
      borderTopWidth: 1,
      borderTopColor: c.border,
      minHeight: 48,
    },
    linkRowText: { flex: 1, color: c.text, fontSize: 14, fontWeight: '600' },
    accountingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 14,
      borderTopWidth: 1,
      borderTopColor: c.border,
      minHeight: 56,
    },
    accountingInfo: { flex: 1, paddingRight: 12 },
    accountingName: { color: c.text, fontSize: 15, fontWeight: '600' },
    accountingDescription: { color: c.textMuted, fontSize: 12, marginTop: 2 },
    storageInfo: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      backgroundColor: c.bgSunken,
      borderRadius: 12,
      padding: 14,
      gap: 10,
    },
    storageText: { color: c.textMuted, fontSize: 12, flex: 1, lineHeight: 18 },
  });
