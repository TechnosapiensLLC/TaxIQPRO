import React, { useCallback, useEffect, useState } from 'react';
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
import { useColors } from '../src/context/ThemeContext';
import type { Palette } from '../src/theme';

interface QboAccount {
  id: string;
  name: string;
  type?: string;
  sub_type?: string;
}

const YEAR = new Date().getFullYear();

export default function QboSyncScreen() {
  const c = useColors();
  const styles = makeStyles(c);
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState<QboAccount[]>([]);
  const [clearing, setClearing] = useState<string | null>(null);
  const [expense, setExpense] = useState<string | null>(null);
  const [income, setIncome] = useState<string | null>(null);
  const [plan, setPlan] = useState<any>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [log, setLog] = useState<any[]>([]);

  const load = useCallback(async () => {
    try {
      const [accountData, logData] = await Promise.all([
        api.getQboAccounts(),
        api.getQboSyncLog(),
      ]);
      setAccounts(accountData.accounts || []);
      setLog(logData || []);
    } catch (error: any) {
      Alert.alert(
        'QuickBooks error',
        error?.response?.data?.detail || 'Could not load your QuickBooks accounts.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const preview = async () => {
    if (!clearing) {
      Alert.alert('Pick an offset account', 'Choose the bank or liability account to balance against.');
      return;
    }
    setBusy('preview');
    try {
      setPlan(
        await api.syncToQbo({
          clearing_account_id: clearing,
          expense_account_id: expense || undefined,
          income_account_id: income || undefined,
          year: YEAR,
          dry_run: true,
        })
      );
    } catch (error: any) {
      Alert.alert('Preview failed', error?.response?.data?.detail || 'Try again.');
    } finally {
      setBusy(null);
    }
  };

  const runSync = async () => {
    if (!clearing) return;
    setBusy('sync');
    try {
      const result = await api.syncToQbo({
        clearing_account_id: clearing,
        expense_account_id: expense || undefined,
        income_account_id: income || undefined,
        year: YEAR,
      });
      Alert.alert(
        'Sync complete',
        `${result.created} entries created, ${result.skipped_already_synced} already synced${
          result.failed?.length ? `, ${result.failed.length} failed` : ''
        }.`
      );
      setPlan(null);
      await load();
    } catch (error: any) {
      Alert.alert('Sync failed', error?.response?.data?.detail || 'Try again.');
    } finally {
      setBusy(null);
    }
  };

  const picker = (
    title: string,
    hint: string,
    value: string | null,
    setValue: (id: string) => void,
    filter?: (a: QboAccount) => boolean
  ) => (
    <View style={styles.pickerBlock}>
      <Text style={styles.pickerTitle}>{title}</Text>
      <Text style={styles.pickerHint}>{hint}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        {accounts.filter(filter || (() => true)).map((account) => (
          <TouchableOpacity
            key={account.id}
            style={[styles.chip, value === account.id && styles.chipActive]}
            onPress={() => setValue(account.id)}
          >
            <Text style={[styles.chipText, value === account.id && styles.chipTextActive]}>
              {account.name}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color={c.accent} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="close" size={28} color={c.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>QuickBooks Sync</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <View style={styles.infoBanner}>
          <Ionicons name="information-circle" size={20} color={c.accent} />
          <Text style={styles.infoText}>
            Each record posts as one balanced journal entry. Records already synced are skipped so
            you never get duplicates.
          </Text>
        </View>

        {picker(
          'Offset account',
          'Bank, credit card or owner-reimbursement account used for the balancing side.',
          clearing,
          setClearing
        )}
        {picker(
          'Expense account',
          'Where expenses and mileage are debited.',
          expense,
          setExpense,
          (a) => a.type === 'Expense'
        )}
        {picker(
          'Income account (optional)',
          'Leave empty to skip pushing income.',
          income,
          setIncome,
          (a) => a.type === 'Income'
        )}

        {plan && (
          <View style={styles.planCard}>
            <Text style={styles.planTitle}>Preview</Text>
            <Text style={styles.planText}>
              {plan.planned_count} entries • ${Number(plan.total_amount || 0).toLocaleString()}
            </Text>
          </View>
        )}

        <View style={styles.actions}>
          <TouchableOpacity style={styles.secondaryButton} onPress={preview} disabled={busy !== null}>
            {busy === 'preview' ? (
              <ActivityIndicator size="small" color={c.accent} />
            ) : (
              <Text style={styles.secondaryButtonText}>Preview</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.primaryButton, !clearing && styles.disabled]}
            onPress={runSync}
            disabled={busy !== null || !clearing}
          >
            {busy === 'sync' ? (
              <ActivityIndicator size="small" color={c.onPrimary} />
            ) : (
              <Text style={styles.primaryButtonText}>Sync to QuickBooks</Text>
            )}
          </TouchableOpacity>
        </View>

        {log.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Recently synced</Text>
            {log.slice(0, 15).map((row) => (
              <View key={row.source_id} style={styles.logRow}>
                <Text style={styles.logSource}>{row.source}</Text>
                <Text style={styles.logAmount}>${Number(row.amount || 0).toFixed(2)}</Text>
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    center: { flex: 1, backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center' },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    headerTitle: { color: c.text, fontSize: 18, fontWeight: '600' },
    scroll: { flex: 1 },
    content: { padding: 20, paddingBottom: 40 },
    infoBanner: {
      flexDirection: 'row',
      gap: 10,
      backgroundColor: c.brandTint,
      borderRadius: 14,
      padding: 14,
      marginBottom: 20,
    },
    infoText: { flex: 1, color: c.textSecondary, fontSize: 12, lineHeight: 18 },
    pickerBlock: { marginBottom: 22 },
    pickerTitle: { color: c.text, fontSize: 15, fontWeight: '600' },
    pickerHint: { color: c.textMuted, fontSize: 12, marginTop: 2, marginBottom: 10 },
    chipRow: { gap: 8, paddingRight: 8 },
    chip: {
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 999,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      minHeight: 44,
      justifyContent: 'center',
    },
    chipActive: { backgroundColor: c.accent, borderColor: c.accent },
    chipText: { color: c.textMuted, fontSize: 13, fontWeight: '600' },
    chipTextActive: { color: c.onPrimary },
    planCard: {
      backgroundColor: c.surface,
      borderRadius: 14,
      padding: 16,
      borderWidth: 1,
      borderColor: c.border,
      marginBottom: 18,
    },
    planTitle: { color: c.text, fontSize: 14, fontWeight: '700', marginBottom: 4 },
    planText: { color: c.textMuted, fontSize: 13 },
    actions: { flexDirection: 'row', gap: 12 },
    secondaryButton: {
      flex: 1,
      backgroundColor: c.surfaceAlt,
      borderRadius: 14,
      paddingVertical: 15,
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 48,
    },
    secondaryButtonText: { color: c.accent, fontSize: 15, fontWeight: '600' },
    primaryButton: {
      flex: 1.4,
      backgroundColor: c.accent,
      borderRadius: 14,
      paddingVertical: 15,
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 48,
    },
    primaryButtonText: { color: c.onPrimary, fontSize: 15, fontWeight: '700' },
    disabled: { opacity: 0.5 },
    sectionTitle: {
      color: c.text,
      fontSize: 16,
      fontWeight: '600',
      marginTop: 28,
      marginBottom: 12,
    },
    logRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    logSource: { color: c.textMuted, fontSize: 13, textTransform: 'capitalize' },
    logAmount: { color: c.text, fontSize: 13, fontWeight: '600' },
  });
