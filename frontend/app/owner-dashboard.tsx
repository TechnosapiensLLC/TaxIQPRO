import React, { useCallback, useEffect, useState } from 'react';
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
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../src/services/api';
import { useColors } from '../src/context/ThemeContext';
import type { Palette } from '../src/theme';

const money = (value: number) =>
  `$${Number(value || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function OwnerDashboardScreen() {
  const c = useColors();
  const styles = makeStyles(c);
  const router = useRouter();

  const [period, setPeriod] = useState<'week' | 'month'>('week');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const result = await api.getChainSpend({ period });
      setData(result);
      setError(null);
    } catch (e: any) {
      const status = e?.response?.status;
      setError(
        status === 404
          ? 'You are not part of a store chain yet. Create one in Stores & Team first.'
          : status === 403
          ? 'Only chain owners, store owners and managers can see chain spend.'
          : 'Could not load chain spend. Pull down to retry.'
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [period]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={c.accent} />
        </View>
      </SafeAreaView>
    );
  }

  const totalUp = (data?.total_delta ?? 0) > 0;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconButton}>
          <Ionicons name="close" size={26} color={c.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Chain Spend</Text>
        <View style={styles.iconButton} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
            tintColor={c.accent}
          />
        }
      >
        <View style={styles.segmented}>
          {(['week', 'month'] as const).map((p) => (
            <TouchableOpacity
              key={p}
              style={[styles.segment, period === p && styles.segmentActive]}
              onPress={() => setPeriod(p)}
            >
              <Text style={[styles.segmentText, period === p && styles.segmentTextActive]}>
                {p === 'week' ? 'This week' : 'This month'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {error ? (
          <View style={styles.errorCard}>
            <Ionicons name="alert-circle-outline" size={22} color={c.warning} />
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity
              style={styles.errorButton}
              onPress={() => router.push('/store-chain')}
            >
              <Text style={styles.errorButtonText}>Open Stores & Team</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <View style={styles.heroCard}>
              <Text style={styles.heroLabel}>{data.current_label}</Text>
              <Text style={styles.heroValue}>{money(data.total_current)}</Text>
              <View style={styles.heroDeltaRow}>
                <Ionicons
                  name={totalUp ? 'trending-up' : 'trending-down'}
                  size={16}
                  color={totalUp ? c.danger : c.success}
                />
                <Text style={[styles.heroDelta, { color: totalUp ? c.danger : c.success }]}>
                  {totalUp ? '+' : ''}
                  {money(data.total_delta)}
                  {data.total_change_pct !== null ? ` (${data.total_change_pct > 0 ? '+' : ''}${data.total_change_pct}%)` : ''}
                </Text>
                <Text style={styles.heroVs}>vs {data.previous_label}</Text>
              </View>
              <Text style={styles.heroMeta}>
                {data.store_count} store{data.store_count === 1 ? '' : 's'} · business spend only
              </Text>
            </View>

            {data.alerts?.length > 0 && (
              <View style={styles.alertBlock}>
                <Text style={styles.sectionTitle}>Cost jumps to look at</Text>
                {data.alerts.map((alert: any, i: number) => (
                  <View key={i} style={styles.alertCard}>
                    <Ionicons name="warning" size={18} color={c.warning} />
                    <Text style={styles.alertText}>{alert.message}</Text>
                  </View>
                ))}
                <Text style={styles.thresholdNote}>
                  Flagged when a store rises more than {data.thresholds.percent}% and{' '}
                  {money(data.thresholds.amount)} in one period.
                </Text>
              </View>
            )}

            <Text style={styles.sectionTitle}>By store</Text>
            {data.stores?.length === 0 ? (
              <Text style={styles.emptyText}>No stores yet.</Text>
            ) : (
              data.stores.map((store: any) => {
                const up = store.delta > 0;
                const open = expanded === (store.store_id ?? 'unassigned');
                return (
                  <TouchableOpacity
                    key={store.store_id ?? 'unassigned'}
                    style={[styles.storeCard, store.flagged && styles.storeCardFlagged]}
                    onPress={() =>
                      setExpanded(open ? null : store.store_id ?? 'unassigned')
                    }
                    activeOpacity={0.8}
                  >
                    <View style={styles.storeTop}>
                      <View style={{ flex: 1 }}>
                        <View style={styles.storeNameRow}>
                          <Text style={styles.storeName}>{store.store_name}</Text>
                          {store.flagged && (
                            <View style={styles.flagPill}>
                              <Text style={styles.flagPillText}>Jump</Text>
                            </View>
                          )}
                        </View>
                        <Text style={styles.storeMeta}>
                          {store.miles} mi · was {money(store.previous)}
                        </Text>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={styles.storeValue}>{money(store.current)}</Text>
                        <Text
                          style={[
                            styles.storeDelta,
                            { color: up ? c.danger : store.delta < 0 ? c.success : c.textMuted },
                          ]}
                        >
                          {store.change_pct === null
                            ? '—'
                            : `${store.change_pct > 0 ? '+' : ''}${store.change_pct}%`}
                        </Text>
                      </View>
                      <Ionicons
                        name={open ? 'chevron-up' : 'chevron-down'}
                        size={18}
                        color={c.textMuted}
                      />
                    </View>

                    {open && (
                      <View style={styles.breakdown}>
                        {store.categories.length === 0 ? (
                          <Text style={styles.emptyText}>No spend this period.</Text>
                        ) : (
                          store.categories.map((cat: any) => (
                            <View key={cat.category} style={styles.catRow}>
                              <Text style={styles.catName}>{cat.category}</Text>
                              <Text style={styles.catAmount}>{money(cat.amount)}</Text>
                            </View>
                          ))
                        )}
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })
            )}

            <Text style={styles.sectionTitle}>Chain-wide categories</Text>
            {data.categories?.length === 0 ? (
              <Text style={styles.emptyText}>No business expenses recorded this period.</Text>
            ) : (
              <View style={styles.catCard}>
                {data.categories.map((cat: any) => {
                  const share = data.total_current
                    ? (cat.amount / data.total_current) * 100
                    : 0;
                  return (
                    <View key={cat.category} style={styles.catBarRow}>
                      <View style={styles.catBarTop}>
                        <Text style={styles.catName}>{cat.category}</Text>
                        <Text style={styles.catAmount}>{money(cat.amount)}</Text>
                      </View>
                      <View style={styles.catBarTrack}>
                        <View style={[styles.catBarFill, { width: `${share}%` }]} />
                      </View>
                    </View>
                  );
                })}
              </View>
            )}

            <View style={styles.privacyCard}>
              <Ionicons name="lock-closed-outline" size={18} color={c.textMuted} />
              <Text style={styles.privacyText}>
                Only expenses your team marked as Business appear here. Personal receipts and
                trips are never shared with the chain.
              </Text>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    iconButton: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
    headerTitle: { color: c.text, fontSize: 18, fontWeight: '700' },
    content: { padding: 16, paddingBottom: 48 },
    segmented: { flexDirection: 'row', gap: 10, marginBottom: 20 },
    segment: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 12,
      backgroundColor: c.surfaceAlt,
      borderWidth: 1,
      borderColor: c.border,
      minHeight: 48,
    },
    segmentActive: { backgroundColor: c.accent, borderColor: c.accent },
    segmentText: { color: c.textMuted, fontSize: 14, fontWeight: '600' },
    segmentTextActive: { color: c.onPrimary },
    heroCard: {
      backgroundColor: c.surface,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: c.border,
      padding: 20,
      marginBottom: 24,
    },
    heroLabel: { color: c.textMuted, fontSize: 12, fontWeight: '700', letterSpacing: 0.5 },
    heroValue: { color: c.text, fontSize: 34, fontWeight: '800', marginTop: 6 },
    heroDeltaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10, flexWrap: 'wrap' },
    heroDelta: { fontSize: 14, fontWeight: '700' },
    heroVs: { color: c.textMuted, fontSize: 12 },
    heroMeta: { color: c.textTertiary, fontSize: 12, marginTop: 10 },
    alertBlock: { marginBottom: 12 },
    alertCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: c.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: c.warning,
      padding: 14,
      marginBottom: 8,
    },
    alertText: { flex: 1, color: c.text, fontSize: 13, lineHeight: 19 },
    thresholdNote: { color: c.textTertiary, fontSize: 11, marginTop: 4, lineHeight: 16 },
    sectionTitle: {
      color: c.text,
      fontSize: 17,
      fontWeight: '700',
      marginTop: 12,
      marginBottom: 12,
    },
    storeCard: {
      backgroundColor: c.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: c.border,
      padding: 14,
      marginBottom: 10,
    },
    storeCardFlagged: { borderColor: c.warning },
    storeTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    storeNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    storeName: { color: c.text, fontSize: 15, fontWeight: '700' },
    flagPill: {
      backgroundColor: c.warning,
      borderRadius: 999,
      paddingHorizontal: 8,
      paddingVertical: 2,
    },
    flagPillText: { color: c.onPrimary, fontSize: 10, fontWeight: '800' },
    storeMeta: { color: c.textMuted, fontSize: 12, marginTop: 3 },
    storeValue: { color: c.text, fontSize: 16, fontWeight: '700' },
    storeDelta: { fontSize: 12, fontWeight: '700', marginTop: 2 },
    breakdown: {
      marginTop: 14,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: c.border,
      gap: 8,
    },
    catRow: { flexDirection: 'row', justifyContent: 'space-between' },
    catName: { color: c.textMuted, fontSize: 13 },
    catAmount: { color: c.text, fontSize: 13, fontWeight: '600' },
    catCard: {
      backgroundColor: c.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: c.border,
      padding: 16,
      gap: 14,
    },
    catBarRow: { gap: 6 },
    catBarTop: { flexDirection: 'row', justifyContent: 'space-between' },
    catBarTrack: {
      height: 6,
      borderRadius: 999,
      backgroundColor: c.surfaceAlt,
      overflow: 'hidden',
    },
    catBarFill: { height: 6, borderRadius: 999, backgroundColor: c.accentAlt },
    emptyText: { color: c.textMuted, fontSize: 13 },
    errorCard: {
      backgroundColor: c.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: c.border,
      padding: 24,
      alignItems: 'center',
      gap: 12,
    },
    errorText: { color: c.textMuted, fontSize: 13, textAlign: 'center', lineHeight: 19 },
    errorButton: {
      backgroundColor: c.accent,
      borderRadius: 12,
      paddingHorizontal: 20,
      justifyContent: 'center',
      minHeight: 44,
    },
    errorButtonText: { color: c.onPrimary, fontSize: 14, fontWeight: '700' },
    privacyCard: {
      flexDirection: 'row',
      gap: 10,
      backgroundColor: c.surfaceAlt,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: c.border,
      padding: 14,
      marginTop: 28,
    },
    privacyText: { flex: 1, color: c.textMuted, fontSize: 12, lineHeight: 18 },
  });
