import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Platform,
  Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { api } from '../src/services/api';
import { useAuth } from '../src/context/AuthContext';
import { useColors } from '../src/context/ThemeContext';
import type { Palette } from '../src/theme';

const ROLE_LABELS: Record<string, string> = {
  chain_owner: 'Chain Owner',
  store_owner: 'Store Owner',
  store_manager: 'Store Manager',
  driver_employee: 'Driver / Employee',
  individual: 'Individual',
};

const MANAGER_ROLES = ['chain_owner', 'store_owner', 'store_manager'];

export default function StoreChainScreen() {
  const c = useColors();
  const styles = makeStyles(c);
  const router = useRouter();
  const { user, refreshUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [org, setOrg] = useState<any>(null);
  const [stores, setStores] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [invites, setInvites] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [chainName, setChainName] = useState('');
  const [storeName, setStoreName] = useState('');

  const isManager = MANAGER_ROLES.includes(user?.role || '');
  const canAddStores = user?.role === 'chain_owner' || user?.role === 'store_owner';

  const load = useCallback(async () => {
    try {
      const orgData = await api.getMyOrg();
      setOrg(orgData);
      if (orgData.organization) {
        const [storeData, memberData, inviteData, summaryData] = await Promise.all([
          api.getStores(),
          MANAGER_ROLES.includes(orgData.role) ? api.getMembers() : Promise.resolve([]),
          MANAGER_ROLES.includes(orgData.role) ? api.getInvites() : Promise.resolve([]),
          MANAGER_ROLES.includes(orgData.role) ? api.getOrgSummary() : Promise.resolve(null),
        ]);
        setStores(storeData || []);
        setMembers(memberData || []);
        setInvites(inviteData || []);
        setSummary(summaryData);
      }
    } catch {
      /* not part of a chain yet */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const createChain = async () => {
    if (!chainName.trim()) {
      Alert.alert('Name required', 'Enter your store chain name.');
      return;
    }
    setBusy('chain');
    try {
      await api.createOrg(chainName.trim());
      await refreshUser();
      setChainName('');
      await load();
    } catch (error: any) {
      Alert.alert('Could not create chain', error?.response?.data?.detail || 'Try again.');
    } finally {
      setBusy(null);
    }
  };

  const addStore = async () => {
    if (!storeName.trim()) {
      Alert.alert('Name required', 'Enter the store name.');
      return;
    }
    setBusy('store');
    try {
      await api.createStore({ name: storeName.trim() });
      setStoreName('');
      await load();
    } catch (error: any) {
      Alert.alert('Could not add store', error?.response?.data?.detail || 'Try again.');
    } finally {
      setBusy(null);
    }
  };

  const invite = async (role: string, storeId?: string) => {
    setBusy(`invite_${role}_${storeId || 'chain'}`);
    try {
      const result = await api.createInvite({ role, store_id: storeId });
      await load();
      const message = `Join our TaxIQ Pro store chain. Invite code: ${result.code}`;
      if (Platform.OS === 'web') {
        Alert.alert('Invite code created', message);
      } else {
        await Share.share({ message });
      }
    } catch (error: any) {
      Alert.alert('Could not create invite', error?.response?.data?.detail || 'Try again.');
    } finally {
      setBusy(null);
    }
  };

  const issueServiceToken = async () => {
    setBusy('token');
    try {
      const result = await api.createServiceToken('cstore-bos');
      Alert.alert(
        'BOS API token (shown once)',
        `${result.token}\n\nStore this on your BOS server only. Send it as: Authorization: Bearer <token>`
      );
    } catch (error: any) {
      Alert.alert('Could not create token', error?.response?.data?.detail || 'Try again.');
    } finally {
      setBusy(null);
    }
  };

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
        <Text style={styles.headerTitle}>Store Chain</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {!org?.organization ? (
          <>
            <View style={styles.emptyCard}>
              <Ionicons name="storefront-outline" size={40} color={c.accent} />
              <Text style={styles.emptyTitle}>Set up your store chain</Text>
              <Text style={styles.emptyText}>
                Create a chain to add stores, invite managers and drivers, and see consolidated
                business mileage and expenses. Personal records always stay private.
              </Text>
              <TextInput
                style={styles.input}
                value={chainName}
                onChangeText={setChainName}
                placeholder="e.g. QuickStop Chain"
                placeholderTextColor={c.textTertiary}
              />
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={createChain}
                disabled={busy !== null}
              >
                {busy === 'chain' ? (
                  <ActivityIndicator size="small" color={c.onPrimary} />
                ) : (
                  <Text style={styles.primaryButtonText}>Create Chain</Text>
                )}
              </TouchableOpacity>
            </View>
            <Text style={styles.footnote}>
              Joining an existing chain? Ask your manager for an invite code and enter it when you
              sign up.
            </Text>
          </>
        ) : (
          <>
            <View style={styles.orgCard}>
              <Text style={styles.orgName}>{org.organization.name}</Text>
              <Text style={styles.orgRole}>
                You are {ROLE_LABELS[org.role] || org.role}
                {org.store ? ` at ${org.store.name}` : ''}
              </Text>
            </View>

            {summary && (
              <View style={styles.summaryCard}>
                <Text style={styles.sectionLabel}>Business totals (personal excluded)</Text>
                <View style={styles.summaryRow}>
                  <View style={styles.summaryItem}>
                    <Text style={styles.summaryValue}>
                      ${Number(summary.totals?.expenses || 0).toLocaleString()}
                    </Text>
                    <Text style={styles.summaryLabel}>Expenses</Text>
                  </View>
                  <View style={styles.summaryItem}>
                    <Text style={styles.summaryValue}>
                      {Number(summary.totals?.miles || 0).toLocaleString()}
                    </Text>
                    <Text style={styles.summaryLabel}>Miles</Text>
                  </View>
                  <View style={styles.summaryItem}>
                    <Text style={styles.summaryValue}>{summary.totals?.employee_count || 0}</Text>
                    <Text style={styles.summaryLabel}>People</Text>
                  </View>
                </View>
              </View>
            )}

            <Text style={styles.sectionTitle}>Stores</Text>
            {stores.length === 0 && <Text style={styles.muted}>No stores yet.</Text>}
            {stores.map((store) => (
              <View key={store.id} style={styles.rowCard}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>{store.name}</Text>
                  {!!store.store_number && (
                    <Text style={styles.rowSub}>Store #{store.store_number}</Text>
                  )}
                </View>
                {isManager && (
                  <TouchableOpacity
                    style={styles.inviteChip}
                    onPress={() => invite('driver_employee', store.id)}
                    disabled={busy !== null}
                  >
                    <Ionicons name="person-add-outline" size={16} color={c.accent} />
                    <Text style={styles.inviteChipText}>Invite</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))}

            {canAddStores && (
              <View style={styles.addRow}>
                <TextInput
                  style={[styles.input, { flex: 1, marginBottom: 0 }]}
                  value={storeName}
                  onChangeText={setStoreName}
                  placeholder="New store name"
                  placeholderTextColor={c.textTertiary}
                />
                <TouchableOpacity
                  style={styles.addButton}
                  onPress={addStore}
                  disabled={busy !== null}
                >
                  {busy === 'store' ? (
                    <ActivityIndicator size="small" color={c.onPrimary} />
                  ) : (
                    <Ionicons name="add" size={24} color={c.onPrimary} />
                  )}
                </TouchableOpacity>
              </View>
            )}

            {isManager && (
              <>
                <Text style={styles.sectionTitle}>Team</Text>
                {members.map((member) => (
                  <View key={member.id} style={styles.rowCard}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.rowTitle}>{member.name || member.email}</Text>
                      <Text style={styles.rowSub}>{ROLE_LABELS[member.role] || member.role}</Text>
                    </View>
                  </View>
                ))}

                <View style={styles.inviteActions}>
                  {user?.role === 'chain_owner' && (
                    <TouchableOpacity
                      style={styles.secondaryButton}
                      onPress={() => invite('store_manager')}
                      disabled={busy !== null}
                    >
                      <Text style={styles.secondaryButtonText}>Invite Manager</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={styles.secondaryButton}
                    onPress={() => invite('driver_employee')}
                    disabled={busy !== null}
                  >
                    <Text style={styles.secondaryButtonText}>Invite Driver</Text>
                  </TouchableOpacity>
                </View>

                {invites.filter((i) => !i.used).length > 0 && (
                  <>
                    <Text style={styles.sectionTitle}>Open invite codes</Text>
                    {invites
                      .filter((i) => !i.used)
                      .map((inviteItem) => (
                        <View key={inviteItem.code} style={styles.rowCard}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.codeText}>{inviteItem.code}</Text>
                            <Text style={styles.rowSub}>
                              {ROLE_LABELS[inviteItem.role] || inviteItem.role}
                            </Text>
                          </View>
                        </View>
                      ))}
                  </>
                )}
              </>
            )}

            {summary?.per_employee?.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>Per-employee business activity</Text>
                {summary.per_employee.map((row: any) => (
                  <View key={row.user_id} style={styles.rowCard}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.rowTitle}>{row.name}</Text>
                      <Text style={styles.rowSub}>
                        {row.trip_count} trips • {row.receipt_count} receipts
                      </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={styles.rowAmount}>${Number(row.expenses).toLocaleString()}</Text>
                      <Text style={styles.rowSub}>{Number(row.miles).toFixed(1)} mi</Text>
                    </View>
                  </View>
                ))}
              </>
            )}

            {user?.role === 'chain_owner' && (
              <>
                <Text style={styles.sectionTitle}>BOS Integration</Text>
                <TouchableOpacity
                  style={styles.rowCard}
                  onPress={issueServiceToken}
                  disabled={busy !== null}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowTitle}>Generate API token</Text>
                    <Text style={styles.rowSub}>
                      Server-to-server token for your C-Store BOS backend
                    </Text>
                  </View>
                  <Ionicons name="key-outline" size={20} color={c.accent} />
                </TouchableOpacity>
              </>
            )}

            <View style={styles.privacyNote}>
              <Ionicons name="lock-closed-outline" size={18} color={c.textMuted} />
              <Text style={styles.privacyText}>
                {summary?.privacy_note ||
                  'Personal receipts and trips are never shared with the chain.'}
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
    content: { padding: 20, paddingBottom: 48 },
    emptyCard: {
      backgroundColor: c.surface,
      borderRadius: 20,
      padding: 24,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: c.border,
    },
    emptyTitle: { color: c.text, fontSize: 18, fontWeight: '700', marginTop: 14 },
    emptyText: {
      color: c.textMuted,
      fontSize: 13,
      textAlign: 'center',
      lineHeight: 19,
      marginTop: 8,
      marginBottom: 18,
    },
    footnote: { color: c.textMuted, fontSize: 12, marginTop: 16, lineHeight: 18 },
    input: {
      width: '100%',
      backgroundColor: c.surfaceAlt,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
      color: c.text,
      fontSize: 14,
      minHeight: 48,
      marginBottom: 12,
    },
    primaryButton: {
      width: '100%',
      backgroundColor: c.accent,
      borderRadius: 14,
      paddingVertical: 15,
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 48,
    },
    primaryButtonText: { color: c.onPrimary, fontSize: 15, fontWeight: '700' },
    orgCard: {
      backgroundColor: c.brandTint,
      borderRadius: 18,
      padding: 18,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: c.accent + '40',
    },
    orgName: { color: c.text, fontSize: 20, fontWeight: '700' },
    orgRole: { color: c.textSecondary, fontSize: 13, marginTop: 4 },
    summaryCard: {
      backgroundColor: c.surface,
      borderRadius: 18,
      padding: 18,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: c.border,
    },
    sectionLabel: {
      color: c.textMuted,
      fontSize: 11,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.6,
      marginBottom: 12,
    },
    summaryRow: { flexDirection: 'row', gap: 12 },
    summaryItem: { flex: 1 },
    summaryValue: { color: c.text, fontSize: 18, fontWeight: '700' },
    summaryLabel: { color: c.textMuted, fontSize: 12, marginTop: 2 },
    sectionTitle: {
      color: c.text,
      fontSize: 16,
      fontWeight: '600',
      marginTop: 24,
      marginBottom: 12,
    },
    muted: { color: c.textMuted, fontSize: 13 },
    rowCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: c.surface,
      borderRadius: 14,
      padding: 16,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: c.border,
      minHeight: 56,
    },
    rowTitle: { color: c.text, fontSize: 15, fontWeight: '600' },
    rowSub: { color: c.textMuted, fontSize: 12, marginTop: 2 },
    rowAmount: { color: c.text, fontSize: 15, fontWeight: '700' },
    codeText: { color: c.accent, fontSize: 17, fontWeight: '700', letterSpacing: 2 },
    inviteChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: c.surfaceAlt,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 999,
      minHeight: 44,
    },
    inviteChipText: { color: c.accent, fontSize: 13, fontWeight: '600' },
    addRow: { flexDirection: 'row', gap: 10, alignItems: 'center', marginTop: 6 },
    addButton: {
      width: 48,
      height: 48,
      borderRadius: 14,
      backgroundColor: c.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    inviteActions: { flexDirection: 'row', gap: 10, marginTop: 6 },
    secondaryButton: {
      flex: 1,
      backgroundColor: c.surfaceAlt,
      borderRadius: 12,
      paddingVertical: 14,
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 48,
    },
    secondaryButtonText: { color: c.accent, fontSize: 14, fontWeight: '600' },
    privacyNote: {
      flexDirection: 'row',
      gap: 10,
      alignItems: 'flex-start',
      backgroundColor: c.bgSunken,
      borderRadius: 12,
      padding: 14,
      marginTop: 28,
    },
    privacyText: { flex: 1, color: c.textMuted, fontSize: 12, lineHeight: 18 },
  });
