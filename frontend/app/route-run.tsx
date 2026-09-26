import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { api } from '../src/services/api';
import { useColors } from '../src/context/ThemeContext';
import type { Palette } from '../src/theme';

export default function RouteRunScreen() {
  const c = useColors();
  const styles = makeStyles(c);
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [run, setRun] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [gpsDenied, setGpsDenied] = useState(false);

  const load = useCallback(async () => {
    if (!id) {
      setLoading(false);
      return;
    }
    try {
      const week = await api.getRouteWeek();
      let found: any = null;
      for (const day of week.days || []) {
        const match = (day.runs || []).find((r: any) => r.id === id);
        if (match) found = match;
      }
      // A run scheduled outside the current week still needs to be drivable.
      if (!found) {
        const started = await api.startRouteRun(String(id));
        found = started;
      }
      setRun(found);
    } catch {
      Alert.alert('Could not load this run', 'Go back and try again.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const getCoords = async (): Promise<{ lat: number; lng: number } | undefined> => {
    const existing = await Location.getForegroundPermissionsAsync();
    let status = existing.status;
    if (status !== 'granted' && existing.canAskAgain) {
      const asked = await Location.requestForegroundPermissionsAsync();
      status = asked.status;
      if (asked.status !== 'granted' && !asked.canAskAgain) setGpsDenied(true);
    } else if (status !== 'granted' && !existing.canAskAgain) {
      setGpsDenied(true);
    }
    if (status !== 'granted') return undefined;
    try {
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      return { lat: pos.coords.latitude, lng: pos.coords.longitude };
    } catch {
      return undefined;
    }
  };

  const arrive = async (index: number) => {
    setBusy(true);
    try {
      const coords = await getCoords();
      const updated = await api.arriveAtStop(String(id), index, coords);
      setRun(updated);
    } catch {
      Alert.alert('Could not record arrival', 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const finish = async () => {
    setBusy(true);
    try {
      const done = await api.completeRouteRun(String(id));
      setRun(done);
      Alert.alert(
        'Route logged',
        `${done.total_miles} business miles → $${(done.deduction_amount ?? 0).toFixed(
          2
        )} deduction added to your mileage log.`,
        [{ text: 'Done', onPress: () => router.back() }]
      );
    } catch {
      Alert.alert('Could not log route', 'Confirm at least one stop first.');
    } finally {
      setBusy(false);
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

  if (!run) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <Text style={styles.emptyText}>Run not found.</Text>
          <TouchableOpacity style={styles.finishButton} onPress={() => router.back()}>
            <Text style={styles.finishButtonText}>Go back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const stops = run.stops || [];
  const done = stops.filter((s: any) => s.arrived_at).length;
  const completed = run.status === 'completed';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconButton}>
          <Ionicons name="chevron-back" size={26} color={c.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {run.plan_name}
        </Text>
        <View style={styles.iconButton} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.progressCard}>
          <Text style={styles.progressValue}>
            {done}/{stops.length}
          </Text>
          <Text style={styles.progressLabel}>stops confirmed</Text>
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                { width: `${stops.length ? (done / stops.length) * 100 : 0}%` },
              ]}
            />
          </View>
          <Text style={styles.progressMeta}>
            {completed
              ? `${run.total_miles} mi logged · $${(run.deduction_amount ?? 0).toFixed(2)}`
              : `${run.planned_miles} mi planned · $${(run.planned_miles * 0.7).toFixed(
                  2
                )} est. deduction`}
          </Text>
        </View>

        {gpsDenied && (
          <View style={styles.gpsCard}>
            <Ionicons name="location-outline" size={18} color={c.warning} />
            <View style={{ flex: 1 }}>
              <Text style={styles.gpsText}>
                Location is off, so we will log your planned miles instead of actual GPS miles.
              </Text>
              <TouchableOpacity onPress={() => Linking.openSettings()} style={styles.gpsButton}>
                <Text style={styles.gpsButtonText}>Open Settings</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {stops.map((stop: any, index: number) => {
          const arrived = !!stop.arrived_at;
          return (
            <View key={index} style={[styles.stopCard, arrived && styles.stopCardDone]}>
              <View style={[styles.stopDot, arrived && styles.stopDotDone]}>
                {arrived ? (
                  <Ionicons name="checkmark" size={16} color={c.onPrimary} />
                ) : (
                  <Text style={styles.stopIndex}>{index + 1}</Text>
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.stopName}>{stop.name}</Text>
                {!!stop.address && <Text style={styles.stopAddress}>{stop.address}</Text>}
                {arrived && (
                  <Text style={styles.stopTime}>
                    Arrived {new Date(stop.arrived_at).toLocaleTimeString()}
                  </Text>
                )}
              </View>
              {!arrived && !completed && (
                <TouchableOpacity
                  style={styles.arriveButton}
                  onPress={() => arrive(index)}
                  disabled={busy}
                >
                  {busy ? (
                    <ActivityIndicator size="small" color={c.onPrimary} />
                  ) : (
                    <Text style={styles.arriveButtonText}>Arrived</Text>
                  )}
                </TouchableOpacity>
              )}
            </View>
          );
        })}

        {!completed && (
          <TouchableOpacity
            style={[styles.finishButton, busy && styles.finishDisabled]}
            onPress={finish}
            disabled={busy}
          >
            {busy ? (
              <ActivityIndicator color={c.onPrimary} />
            ) : (
              <>
                <Ionicons name="checkmark-done" size={18} color={c.onPrimary} />
                <Text style={styles.finishButtonText}>Finish & log mileage</Text>
              </>
            )}
          </TouchableOpacity>
        )}

        {completed && (
          <View style={styles.doneCard}>
            <Ionicons name="checkmark-circle" size={22} color={c.success} />
            <Text style={styles.doneText}>
              Logged as a business trip. It now appears in your mileage list, Schedule C and
              accounting exports.
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 8,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    iconButton: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
    headerTitle: { flex: 1, color: c.text, fontSize: 17, fontWeight: '700' },
    content: { padding: 16, paddingBottom: 48 },
    progressCard: {
      backgroundColor: c.surface,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: c.border,
      padding: 20,
      alignItems: 'center',
      marginBottom: 20,
    },
    progressValue: { color: c.text, fontSize: 32, fontWeight: '800' },
    progressLabel: { color: c.textMuted, fontSize: 13, marginTop: 2 },
    progressBar: {
      width: '100%',
      height: 8,
      borderRadius: 999,
      backgroundColor: c.surfaceAlt,
      marginTop: 16,
      overflow: 'hidden',
    },
    progressFill: { height: 8, borderRadius: 999, backgroundColor: c.accent },
    progressMeta: { color: c.accentAlt, fontSize: 13, fontWeight: '600', marginTop: 12 },
    gpsCard: {
      flexDirection: 'row',
      gap: 10,
      backgroundColor: c.surfaceAlt,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: c.border,
      padding: 14,
      marginBottom: 16,
    },
    gpsText: { color: c.textMuted, fontSize: 12, lineHeight: 18 },
    gpsButton: { marginTop: 8, minHeight: 44, justifyContent: 'center' },
    gpsButtonText: { color: c.accent, fontSize: 13, fontWeight: '700' },
    stopCard: {
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
    stopCardDone: { borderColor: c.success },
    stopDot: {
      width: 30,
      height: 30,
      borderRadius: 15,
      backgroundColor: c.surfaceAlt,
      borderWidth: 1,
      borderColor: c.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    stopDotDone: { backgroundColor: c.success, borderColor: c.success },
    stopIndex: { color: c.textMuted, fontSize: 13, fontWeight: '700' },
    stopName: { color: c.text, fontSize: 15, fontWeight: '600' },
    stopAddress: { color: c.textMuted, fontSize: 12, marginTop: 2 },
    stopTime: { color: c.success, fontSize: 12, marginTop: 4, fontWeight: '600' },
    arriveButton: {
      backgroundColor: c.accent,
      borderRadius: 10,
      paddingHorizontal: 14,
      minHeight: 44,
      minWidth: 84,
      alignItems: 'center',
      justifyContent: 'center',
    },
    arriveButtonText: { color: c.onPrimary, fontSize: 13, fontWeight: '700' },
    finishButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: c.accent,
      borderRadius: 14,
      minHeight: 54,
      marginTop: 12,
    },
    finishDisabled: { opacity: 0.6 },
    finishButtonText: { color: c.onPrimary, fontSize: 16, fontWeight: '700' },
    doneCard: {
      flexDirection: 'row',
      gap: 10,
      backgroundColor: c.surfaceAlt,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: c.success,
      padding: 14,
      marginTop: 16,
    },
    doneText: { flex: 1, color: c.textMuted, fontSize: 12, lineHeight: 18 },
    emptyText: { color: c.textMuted, fontSize: 14 },
  });
