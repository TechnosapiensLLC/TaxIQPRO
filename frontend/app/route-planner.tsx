import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../src/services/api';
import { useColors } from '../src/context/ThemeContext';
import type { Palette } from '../src/theme';

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function mondayOf(base: Date) {
  const d = new Date(base);
  const offset = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - offset);
  return d.toISOString().slice(0, 10);
}

function shiftWeek(weekStart: string, weeks: number) {
  const d = new Date(`${weekStart}T00:00:00`);
  d.setDate(d.getDate() + weeks * 7);
  return d.toISOString().slice(0, 10);
}

interface Stop {
  name: string;
  address?: string;
  lat?: number;
  lng?: number;
  arrived_at?: string | null;
}

export default function RoutePlannerScreen() {
  const c = useColors();
  const styles = makeStyles(c);
  const router = useRouter();

  const [weekStart, setWeekStart] = useState(() => mondayOf(new Date()));
  const [week, setWeek] = useState<any>(null);
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyRun, setBusyRun] = useState<string | null>(null);

  const [showPlanModal, setShowPlanModal] = useState(false);
  const [planName, setPlanName] = useState('');
  const [stopDrafts, setStopDrafts] = useState<Stop[]>([
    { name: '', lat: undefined, lng: undefined },
    { name: '', lat: undefined, lng: undefined },
  ]);
  const [saving, setSaving] = useState(false);

  const [scheduleFor, setScheduleFor] = useState<any>(null);
  const [selectedDays, setSelectedDays] = useState<string[]>([]);

  const weekDates = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const d = new Date(`${weekStart}T00:00:00`);
        d.setDate(d.getDate() + i);
        return d.toISOString().slice(0, 10);
      }),
    [weekStart]
  );

  const load = useCallback(async () => {
    try {
      const [weekData, planData] = await Promise.all([
        api.getRouteWeek(weekStart),
        api.getRoutePlans(),
      ]);
      setWeek(weekData);
      setPlans(planData || []);
    } catch {
      Alert.alert('Could not load routes', 'Pull down to try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [weekStart]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  const savePlan = async () => {
    const stops = stopDrafts.filter((s) => s.name.trim());
    if (!planName.trim()) {
      Alert.alert('Name required', 'Give this route a name, e.g. "Monday Supply Loop".');
      return;
    }
    if (stops.length < 2) {
      Alert.alert('Add more stops', 'A route needs at least two stops.');
      return;
    }
    setSaving(true);
    try {
      await api.createRoutePlan({ name: planName.trim(), stops, round_trip: true });
      setShowPlanModal(false);
      setPlanName('');
      setStopDrafts([{ name: '' }, { name: '' }]);
      await load();
    } catch {
      Alert.alert('Could not save route', 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const confirmSchedule = async () => {
    if (!scheduleFor || selectedDays.length === 0) return;
    try {
      const result = await api.scheduleRoute(scheduleFor.id, selectedDays);
      setScheduleFor(null);
      setSelectedDays([]);
      await load();
      Alert.alert('Scheduled', `${result.scheduled} run(s) added to your week.`);
    } catch {
      Alert.alert('Could not schedule', 'Please try again.');
    }
  };

  const driveRun = (runId: string) => router.push(`/route-run?id=${runId}`);

  const quickComplete = async (runId: string) => {
    setBusyRun(runId);
    try {
      const done = await api.completeRouteRun(runId);
      await load();
      Alert.alert(
        'Mileage logged',
        `${done.total_miles} business miles → $${done.deduction_amount?.toFixed(2)} deduction.`
      );
    } catch {
      Alert.alert('Could not log', 'Open the run and confirm your stops first.');
    } finally {
      setBusyRun(null);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={c.accent} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconButton}>
          <Ionicons name="close" size={26} color={c.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Route Planner</Text>
        <TouchableOpacity onPress={() => setShowPlanModal(true)} style={styles.iconButton}>
          <Ionicons name="add" size={26} color={c.accent} />
        </TouchableOpacity>
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
        <View style={styles.weekNav}>
          <TouchableOpacity
            onPress={() => setWeekStart(shiftWeek(weekStart, -1))}
            style={styles.weekArrow}
          >
            <Ionicons name="chevron-back" size={20} color={c.text} />
          </TouchableOpacity>
          <View style={styles.weekLabelWrap}>
            <Text style={styles.weekLabel}>Week of {weekStart}</Text>
            <Text style={styles.weekSub}>
              {week?.planned_miles ?? 0} mi planned · {week?.logged_miles ?? 0} mi logged
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => setWeekStart(shiftWeek(weekStart, 1))}
            style={styles.weekArrow}
          >
            <Ionicons name="chevron-forward" size={20} color={c.text} />
          </TouchableOpacity>
        </View>

        <View style={styles.summaryCard}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{week?.logged_miles ?? 0}</Text>
            <Text style={styles.summaryLabel}>Miles logged</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryValue, { color: c.accentAlt }]}>
              ${(week?.logged_deduction ?? 0).toFixed(2)}
            </Text>
            <Text style={styles.summaryLabel}>Deduction earned</Text>
          </View>
        </View>

        {weekDates.map((day, index) => {
          const runs = week?.days?.find((d: any) => d.date === day)?.runs ?? [];
          return (
            <View key={day} style={styles.daySection}>
              <View style={styles.dayHeader}>
                <Text style={styles.dayLabel}>{DAY_LABELS[index]}</Text>
                <Text style={styles.dayDate}>{day.slice(5)}</Text>
              </View>
              {runs.length === 0 ? (
                <Text style={styles.dayEmpty}>No runs scheduled</Text>
              ) : (
                runs.map((run: any) => (
                  <View key={run.id} style={styles.runCard}>
                    <View style={styles.runTop}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.runName}>{run.plan_name}</Text>
                        <Text style={styles.runMeta}>
                          {run.stops_done}/{run.stops_total} stops · {run.total_miles} mi
                          {run.status === 'completed'
                            ? ` · $${(run.deduction_amount ?? 0).toFixed(2)} logged`
                            : ''}
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.statusPill,
                          run.status === 'completed' && styles.statusDone,
                          run.status === 'in_progress' && styles.statusActive,
                        ]}
                      >
                        <Text
                          style={[
                            styles.statusText,
                            (run.status === 'completed' || run.status === 'in_progress') &&
                              styles.statusTextOn,
                          ]}
                        >
                          {run.status === 'in_progress'
                            ? 'Driving'
                            : run.status === 'completed'
                            ? 'Logged'
                            : 'Planned'}
                        </Text>
                      </View>
                    </View>

                    {run.status !== 'completed' && (
                      <View style={styles.runActions}>
                        <TouchableOpacity
                          style={styles.runPrimary}
                          onPress={() => driveRun(run.id)}
                        >
                          <Ionicons name="navigate" size={16} color={c.onPrimary} />
                          <Text style={styles.runPrimaryText}>
                            {run.status === 'in_progress' ? 'Continue' : 'Drive it'}
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.runSecondary}
                          onPress={() => quickComplete(run.id)}
                          disabled={busyRun === run.id}
                        >
                          {busyRun === run.id ? (
                            <ActivityIndicator size="small" color={c.accent} />
                          ) : (
                            <Text style={styles.runSecondaryText}>Log planned miles</Text>
                          )}
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                ))
              )}
            </View>
          );
        })}

        <Text style={styles.sectionTitle}>Saved Routes</Text>
        {plans.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="map-outline" size={28} color={c.textMuted} />
            <Text style={styles.emptyText}>
              Build a route once, then drop it onto any day of the week.
            </Text>
            <TouchableOpacity style={styles.emptyButton} onPress={() => setShowPlanModal(true)}>
              <Text style={styles.emptyButtonText}>Create your first route</Text>
            </TouchableOpacity>
          </View>
        ) : (
          plans.map((plan) => (
            <View key={plan.id} style={styles.planCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.planName}>{plan.name}</Text>
                <Text style={styles.planMeta}>
                  {plan.stops.length} stops · {plan.planned_miles} mi · $
                  {plan.estimated_deduction.toFixed(2)} per run
                </Text>
              </View>
              <TouchableOpacity
                style={styles.planSchedule}
                onPress={() => {
                  setScheduleFor(plan);
                  setSelectedDays([]);
                }}
              >
                <Ionicons name="calendar-outline" size={18} color={c.onPrimary} />
              </TouchableOpacity>
            </View>
          ))
        )}

        <View style={styles.noteCard}>
          <Ionicons name="information-circle-outline" size={18} color={c.textMuted} />
          <Text style={styles.noteText}>
            Distances are straight-line estimates between stops. Confirming arrivals with GPS while
            you drive gives the most defensible mileage log.
          </Text>
        </View>
      </ScrollView>

      {/* New route modal */}
      <Modal visible={showPlanModal} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>New Route</Text>
              <TouchableOpacity onPress={() => setShowPlanModal(false)}>
                <Ionicons name="close" size={24} color={c.text} />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 420 }}>
              <Text style={styles.label}>Route name</Text>
              <TextInput
                style={styles.input}
                value={planName}
                onChangeText={setPlanName}
                placeholder="Monday Supply Loop"
                placeholderTextColor={c.borderStrong}
              />
              <Text style={styles.label}>Stops</Text>
              {stopDrafts.map((stop, index) => (
                <View key={index} style={styles.stopRow}>
                  <TextInput
                    style={[styles.input, { flex: 1, marginBottom: 0 }]}
                    value={stop.name}
                    onChangeText={(text) =>
                      setStopDrafts((prev) =>
                        prev.map((s, i) => (i === index ? { ...s, name: text } : s))
                      )
                    }
                    placeholder={index === 0 ? 'Store 12 (start)' : `Stop ${index + 1}`}
                    placeholderTextColor={c.borderStrong}
                  />
                  {stopDrafts.length > 2 && (
                    <TouchableOpacity
                      onPress={() =>
                        setStopDrafts((prev) => prev.filter((_, i) => i !== index))
                      }
                      style={styles.stopRemove}
                    >
                      <Ionicons name="remove-circle-outline" size={22} color={c.danger} />
                    </TouchableOpacity>
                  )}
                </View>
              ))}
              <TouchableOpacity
                style={styles.addStop}
                onPress={() => setStopDrafts((prev) => [...prev, { name: '' }])}
              >
                <Ionicons name="add" size={18} color={c.accent} />
                <Text style={styles.addStopText}>Add stop</Text>
              </TouchableOpacity>
              <Text style={styles.helper}>
                Stops without GPS coordinates still schedule fine — record actual miles by
                confirming arrivals while driving.
              </Text>
            </ScrollView>
            <TouchableOpacity
              style={[styles.saveButton, saving && styles.saveDisabled]}
              onPress={savePlan}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color={c.onPrimary} />
              ) : (
                <Text style={styles.saveButtonText}>Save route</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Schedule modal */}
      <Modal visible={!!scheduleFor} animationType="fade" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Schedule {scheduleFor?.name}</Text>
              <TouchableOpacity onPress={() => setScheduleFor(null)}>
                <Ionicons name="close" size={24} color={c.text} />
              </TouchableOpacity>
            </View>
            <Text style={styles.helper}>Pick the days this route runs.</Text>
            <View style={styles.dayGrid}>
              {weekDates.map((day, index) => {
                const active = selectedDays.includes(day);
                return (
                  <TouchableOpacity
                    key={day}
                    style={[styles.dayChip, active && styles.dayChipActive]}
                    onPress={() =>
                      setSelectedDays((prev) =>
                        prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
                      )
                    }
                  >
                    <Text style={[styles.dayChipText, active && styles.dayChipTextActive]}>
                      {DAY_LABELS[index]}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <TouchableOpacity
              style={[styles.saveButton, selectedDays.length === 0 && styles.saveDisabled]}
              onPress={confirmSchedule}
              disabled={selectedDays.length === 0}
            >
              <Text style={styles.saveButtonText}>
                Add {selectedDays.length || ''} run{selectedDays.length === 1 ? '' : 's'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
    weekNav: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
    weekArrow: {
      width: 44,
      height: 44,
      borderRadius: 12,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    weekLabelWrap: { flex: 1, alignItems: 'center' },
    weekLabel: { color: c.text, fontSize: 15, fontWeight: '700' },
    weekSub: { color: c.textMuted, fontSize: 12, marginTop: 2 },
    summaryCard: {
      flexDirection: 'row',
      backgroundColor: c.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: c.border,
      padding: 18,
      marginBottom: 24,
    },
    summaryItem: { flex: 1, alignItems: 'center' },
    summaryDivider: { width: 1, backgroundColor: c.border },
    summaryValue: { color: c.text, fontSize: 22, fontWeight: '800' },
    summaryLabel: { color: c.textMuted, fontSize: 12, marginTop: 4 },
    daySection: { marginBottom: 18 },
    dayHeader: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginBottom: 8 },
    dayLabel: { color: c.text, fontSize: 15, fontWeight: '700' },
    dayDate: { color: c.textMuted, fontSize: 12 },
    dayEmpty: { color: c.textTertiary, fontSize: 13 },
    runCard: {
      backgroundColor: c.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: c.border,
      padding: 14,
      marginBottom: 10,
    },
    runTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
    runName: { color: c.text, fontSize: 15, fontWeight: '700' },
    runMeta: { color: c.textMuted, fontSize: 12, marginTop: 3 },
    statusPill: {
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 999,
      backgroundColor: c.surfaceAlt,
      borderWidth: 1,
      borderColor: c.border,
    },
    statusDone: { backgroundColor: c.success, borderColor: c.success },
    statusActive: { backgroundColor: c.accentAlt, borderColor: c.accentAlt },
    statusText: { color: c.textMuted, fontSize: 11, fontWeight: '700' },
    statusTextOn: { color: c.onPrimary },
    runActions: { flexDirection: 'row', gap: 10, marginTop: 12 },
    runPrimary: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      backgroundColor: c.accent,
      borderRadius: 12,
      paddingHorizontal: 16,
      minHeight: 44,
    },
    runPrimaryText: { color: c.onPrimary, fontSize: 14, fontWeight: '700' },
    runSecondary: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 12,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surfaceAlt,
      minHeight: 44,
    },
    runSecondaryText: { color: c.text, fontSize: 13, fontWeight: '600' },
    sectionTitle: {
      color: c.text,
      fontSize: 17,
      fontWeight: '700',
      marginTop: 10,
      marginBottom: 12,
    },
    emptyCard: {
      backgroundColor: c.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: c.border,
      padding: 24,
      alignItems: 'center',
      gap: 12,
    },
    emptyText: { color: c.textMuted, fontSize: 13, textAlign: 'center', lineHeight: 19 },
    emptyButton: {
      backgroundColor: c.accent,
      borderRadius: 12,
      paddingHorizontal: 20,
      justifyContent: 'center',
      minHeight: 44,
    },
    emptyButtonText: { color: c.onPrimary, fontSize: 14, fontWeight: '700' },
    planCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: c.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: c.border,
      padding: 14,
      marginBottom: 10,
    },
    planName: { color: c.text, fontSize: 15, fontWeight: '700' },
    planMeta: { color: c.textMuted, fontSize: 12, marginTop: 3 },
    planSchedule: {
      width: 44,
      height: 44,
      borderRadius: 12,
      backgroundColor: c.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    noteCard: {
      flexDirection: 'row',
      gap: 10,
      backgroundColor: c.surfaceAlt,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: c.border,
      padding: 14,
      marginTop: 24,
    },
    noteText: { flex: 1, color: c.textMuted, fontSize: 12, lineHeight: 18 },
    modalBackdrop: {
      flex: 1,
      backgroundColor: c.scrim,
      justifyContent: 'flex-end',
    },
    modalCard: {
      backgroundColor: c.surface,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      padding: 20,
      paddingBottom: 32,
    },
    modalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 16,
    },
    modalTitle: { color: c.text, fontSize: 18, fontWeight: '700', flex: 1 },
    label: { color: c.textMuted, fontSize: 13, fontWeight: '600', marginBottom: 8 },
    input: {
      backgroundColor: c.surfaceAlt,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 12,
      paddingHorizontal: 14,
      color: c.text,
      fontSize: 15,
      minHeight: 48,
      marginBottom: 16,
    },
    stopRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
    stopRemove: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
    addStop: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      minHeight: 44,
    },
    addStopText: { color: c.accent, fontSize: 14, fontWeight: '600' },
    helper: { color: c.textMuted, fontSize: 12, lineHeight: 18, marginBottom: 12 },
    dayGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
    dayChip: {
      paddingHorizontal: 14,
      borderRadius: 12,
      backgroundColor: c.surfaceAlt,
      borderWidth: 1,
      borderColor: c.border,
      minHeight: 44,
      justifyContent: 'center',
    },
    dayChipActive: { backgroundColor: c.accent, borderColor: c.accent },
    dayChipText: { color: c.textMuted, fontSize: 13, fontWeight: '600' },
    dayChipTextActive: { color: c.onPrimary },
    saveButton: {
      backgroundColor: c.accent,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 52,
    },
    saveDisabled: { opacity: 0.5 },
    saveButtonText: { color: c.onPrimary, fontSize: 16, fontWeight: '700' },
  });
