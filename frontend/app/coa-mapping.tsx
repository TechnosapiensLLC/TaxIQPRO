import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { api } from '../src/services/api';
import { useColors } from '../src/context/ThemeContext';
import type { Palette } from '../src/theme';

export default function CoaMappingScreen() {
  const c = useColors();
  const styles = makeStyles(c);
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [defaults, setDefaults] = useState<Record<string, string>>({});
  const [categories, setCategories] = useState<string[]>([]);
  const [special, setSpecial] = useState<Record<string, string>>({});

  useEffect(() => {
    api
      .getCoaMapping()
      .then((data) => {
        setMapping(data.mapping || {});
        setDefaults(data.defaults || {});
        setCategories(data.categories || []);
        setSpecial(data.special_accounts || {});
      })
      .catch(() => Alert.alert('Error', 'Could not load your account mapping.'))
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await api.saveCoaMapping(mapping);
      Alert.alert('Saved', 'Your accounting exports will use these account names.');
      router.back();
    } catch {
      Alert.alert('Error', 'Could not save your mapping.');
    } finally {
      setSaving(false);
    }
  };

  const resetDefaults = () => setMapping({ ...defaults });

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
        <Text style={styles.headerTitle}>Chart of Accounts</Text>
        <TouchableOpacity onPress={resetDefaults} hitSlop={12}>
          <Text style={styles.resetText}>Reset</Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.infoBanner}>
            <Ionicons name="information-circle" size={20} color={c.accent} />
            <Text style={styles.infoText}>
              Match each TaxIQ category to the account name used in QuickBooks, Xero or Sage.
              Names must match your accounting file exactly.
            </Text>
          </View>

          {categories.map((category) => (
            <View key={category} style={styles.row}>
              <Text style={styles.label}>{category}</Text>
              <TextInput
                style={styles.input}
                value={mapping[category] ?? ''}
                onChangeText={(text) => setMapping((prev) => ({ ...prev, [category]: text }))}
                placeholder={defaults[category] || 'Account name'}
                placeholderTextColor={c.textTertiary}
                autoCapitalize="words"
              />
            </View>
          ))}

          <Text style={styles.sectionTitle}>Fixed accounts</Text>
          <View style={styles.fixedCard}>
            <Text style={styles.fixedRow}>Mileage → {special.mileage}</Text>
            <Text style={styles.fixedRow}>Income → {special.income}</Text>
            <Text style={styles.fixedRow}>Offset / clearing → {special.clearing}</Text>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity style={styles.saveButton} onPress={save} disabled={saving}>
            {saving ? (
              <ActivityIndicator size="small" color={c.onPrimary} />
            ) : (
              <Text style={styles.saveButtonText}>Save Mapping</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
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
    resetText: { color: c.accent, fontSize: 14, fontWeight: '600' },
    scroll: { flex: 1 },
    content: { padding: 20, paddingBottom: 32 },
    infoBanner: {
      flexDirection: 'row',
      gap: 10,
      backgroundColor: c.brandTint,
      borderRadius: 14,
      padding: 14,
      marginBottom: 20,
    },
    infoText: { flex: 1, color: c.textSecondary, fontSize: 12, lineHeight: 18 },
    row: { marginBottom: 16 },
    label: { color: c.text, fontSize: 13, fontWeight: '600', marginBottom: 6 },
    input: {
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
      color: c.text,
      fontSize: 14,
      minHeight: 48,
    },
    sectionTitle: {
      color: c.text,
      fontSize: 16,
      fontWeight: '600',
      marginTop: 12,
      marginBottom: 10,
    },
    fixedCard: {
      backgroundColor: c.surfaceAlt,
      borderRadius: 12,
      padding: 14,
      gap: 6,
    },
    fixedRow: { color: c.textMuted, fontSize: 12 },
    footer: {
      padding: 20,
      borderTopWidth: 1,
      borderTopColor: c.border,
      backgroundColor: c.bg,
    },
    saveButton: {
      backgroundColor: c.accent,
      borderRadius: 14,
      paddingVertical: 16,
      alignItems: 'center',
      minHeight: 52,
      justifyContent: 'center',
    },
    saveButtonText: { color: c.onPrimary, fontSize: 16, fontWeight: '700' },
  });
