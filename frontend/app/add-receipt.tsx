import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { api } from '../src/services/api';
import { format } from 'date-fns';
import { useScanStore } from '../src/store/scanStore';

import { useColors } from '../src/context/ThemeContext';
import type { Palette } from '../src/theme';
const CATEGORIES = [
  'Inventory & Stock',
  'Fuel',
  'Vehicle & Gas',
  'Equipment & Supplies',
  'Phone & Internet',
  'Insurance',
  'Food & Meals',
  'Office Supplies',
  'Software & Subscriptions',
  'Professional Services',
  'Education & Training',
  'Marketing & Advertising',
  'Health & Medical',
  'Entertainment',
  'Parking & Tolls',
  'Maintenance & Repairs',
  'Travel',
  'Bank Fees',
  'Other',
];

export default function AddReceiptScreen() {
  const c = useColors();
  const styles = makeStyles(c);
  const router = useRouter();
  const [vendor, setVendor] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [category, setCategory] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [showCategories, setShowCategories] = useState(false);
  const [isBusiness, setIsBusiness] = useState(true);
  const [stores, setStores] = useState<any[]>([]);
  const [storeId, setStoreId] = useState<string | null>(null);
  const lastScan = useScanStore((state) => state.lastScan);
  const clearScan = useScanStore((state) => state.clear);
  const barcode = lastScan?.barcode ?? null;

  useEffect(() => () => clearScan(), [clearScan]);

  useEffect(() => {
    api
      .getStores()
      .then((data) => setStores(data || []))
      .catch(() => setStores([]));
  }, []);

  const handleSave = async () => {
    if (!vendor.trim()) {
      Alert.alert('Error', 'Please enter a vendor name');
      return;
    }
    if (!amount || parseFloat(amount) <= 0) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }
    if (!category) {
      Alert.alert('Error', 'Please select a category');
      return;
    }

    try {
      setSaving(true);
      await api.createReceipt({
        vendor: vendor.trim(),
        amount: parseFloat(amount),
        date,
        category,
        notes: notes.trim(),
        is_business: isBusiness,
        store_id: isBusiness ? storeId ?? undefined : undefined,
        barcode: barcode ?? undefined,
      });
      router.back();
    } catch (error) {
      Alert.alert('Error', 'Failed to save receipt');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="close" size={28} color="#FFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Add Receipt</Text>
          <TouchableOpacity onPress={handleSave} disabled={saving}>
            <Text style={[styles.saveText, saving && { opacity: 0.5 }]}>
              {saving ? 'Saving...' : 'Save'}
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Vendor / Store</Text>
            <TextInput
              style={styles.input}
              value={vendor}
              onChangeText={setVendor}
              placeholder="e.g., Shell Gas Station"
              placeholderTextColor={c.borderStrong}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Amount</Text>
            <View style={styles.amountContainer}>
              <Text style={styles.currencySymbol}>$</Text>
              <TextInput
                style={[styles.input, styles.amountInput]}
                value={amount}
                onChangeText={setAmount}
                placeholder="0.00"
                placeholderTextColor={c.borderStrong}
                keyboardType="decimal-pad"
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Date</Text>
            <TextInput
              style={styles.input}
              value={date}
              onChangeText={setDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={c.borderStrong}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Category</Text>
            <TouchableOpacity
              style={styles.categorySelector}
              onPress={() => setShowCategories(!showCategories)}
            >
              <Text
                style={[
                  styles.categorySelectorText,
                  !category && { color: c.borderStrong },
                ]}
              >
                {category || 'Select a category'}
              </Text>
              <Ionicons
                name={showCategories ? 'chevron-up' : 'chevron-down'}
                size={20}
                color={c.textMuted}
              />
            </TouchableOpacity>

            {showCategories && (
              <View style={styles.categoriesList}>
                {CATEGORIES.map((cat) => (
                  <TouchableOpacity
                    key={cat}
                    style={[
                      styles.categoryOption,
                      category === cat && styles.categoryOptionSelected,
                    ]}
                    onPress={() => {
                      setCategory(cat);
                      setShowCategories(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.categoryOptionText,
                        category === cat && styles.categoryOptionTextSelected,
                      ]}
                    >
                      {cat}
                    </Text>
                    {category === cat && (
                      <Ionicons
                        name="checkmark"
                        size={18}
                        color={c.accent}
                      />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Is this business or personal?</Text>
            <View style={styles.segmented}>
              <TouchableOpacity
                style={[styles.segment, isBusiness && styles.segmentActive]}
                onPress={() => setIsBusiness(true)}
              >
                <Ionicons
                  name="briefcase-outline"
                  size={18}
                  color={isBusiness ? c.onPrimary : c.textMuted}
                />
                <Text style={[styles.segmentText, isBusiness && styles.segmentTextActive]}>
                  Business
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.segment, !isBusiness && styles.segmentActive]}
                onPress={() => setIsBusiness(false)}
              >
                <Ionicons
                  name="person-outline"
                  size={18}
                  color={!isBusiness ? c.onPrimary : c.textMuted}
                />
                <Text style={[styles.segmentText, !isBusiness && styles.segmentTextActive]}>
                  Personal
                </Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.helperText}>
              {isBusiness
                ? 'Counted toward your deductions and chain reports.'
                : 'Kept private — never shared with your store chain.'}
            </Text>
          </View>

          {isBusiness && stores.length > 0 && (
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Store (optional)</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                {stores.map((store) => (
                  <TouchableOpacity
                    key={store.id}
                    style={[styles.chip, storeId === store.id && styles.chipActive]}
                    onPress={() => setStoreId(storeId === store.id ? null : store.id)}
                  >
                    <Text style={[styles.chipText, storeId === store.id && styles.chipTextActive]}>
                      {store.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          <TouchableOpacity
            style={styles.barcodeRow}
            onPress={() => router.push('/barcode-scan')}
          >
            <Ionicons name="barcode-outline" size={20} color={c.accent} />
            <Text style={styles.barcodeText}>
              {barcode ? `Item barcode: ${barcode}` : 'Scan item barcode (warehouse purchases)'}
            </Text>
            <Ionicons name="chevron-forward" size={18} color={c.textMuted} />
          </TouchableOpacity>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Notes (optional)</Text>
            <TextInput
              style={[styles.input, styles.notesInput]}
              value={notes}
              onChangeText={setNotes}
              placeholder="Add any notes about this expense"
              placeholderTextColor={c.borderStrong}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </View>

          <TouchableOpacity
            style={styles.scanButton}
            onPress={() => {
              router.back();
              router.push('/scan');
            }}
          >
            <Ionicons name="camera" size={20} color={c.accent} />
            <Text style={styles.scanButtonText}>Scan receipt instead</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const makeStyles = (c: Palette) => StyleSheet.create({
  segmented: {
    flexDirection: 'row',
    gap: 10,
  },
  segment: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: c.surfaceAlt,
    borderWidth: 1,
    borderColor: c.border,
    minHeight: 48,
  },
  segmentActive: {
    backgroundColor: c.accent,
    borderColor: c.accent,
  },
  segmentText: {
    color: c.textMuted,
    fontSize: 14,
    fontWeight: '600',
  },
  segmentTextActive: {
    color: c.onPrimary,
  },
  helperText: {
    color: c.textMuted,
    fontSize: 12,
    marginTop: 8,
    lineHeight: 17,
  },
  chipRow: {
    gap: 8,
    paddingRight: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: c.surfaceAlt,
    borderWidth: 1,
    borderColor: c.border,
    minHeight: 44,
    justifyContent: 'center',
  },
  chipActive: {
    backgroundColor: c.accent,
    borderColor: c.accent,
  },
  chipText: {
    color: c.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  chipTextActive: {
    color: c.onPrimary,
  },
  barcodeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 20,
    minHeight: 48,
  },
  barcodeText: {
    flex: 1,
    color: c.text,
    fontSize: 13,
    fontWeight: '600',
  },
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
    borderBottomColor: c.surfaceAlt,
  },
  headerTitle: {
    color: c.text,
    fontSize: 18,
    fontWeight: '600',
  },
  saveText: {
    color: c.accent,
    fontSize: 16,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    color: c.text,
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  input: {
    backgroundColor: c.surface,
    borderRadius: 12,
    padding: 16,
    color: c.text,
    fontSize: 16,
    borderWidth: 1,
    borderColor: c.border,
  },
  amountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: c.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: c.border,
  },
  currencySymbol: {
    color: c.accent,
    fontSize: 20,
    fontWeight: '600',
    paddingLeft: 16,
  },
  amountInput: {
    flex: 1,
    borderWidth: 0,
    fontSize: 24,
    fontWeight: '600',
  },
  categorySelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: c.surface,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: c.border,
  },
  categorySelectorText: {
    color: c.text,
    fontSize: 16,
  },
  categoriesList: {
    backgroundColor: c.surface,
    borderRadius: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: c.border,
    maxHeight: 250,
  },
  categoryOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: c.surfaceAlt,
  },
  categoryOptionSelected: {
    backgroundColor: c.accent + '10',
  },
  categoryOptionText: {
    color: c.text,
    fontSize: 15,
  },
  categoryOptionTextSelected: {
    color: c.accent,
    fontWeight: '500',
  },
  notesInput: {
    minHeight: 80,
    paddingTop: 14,
  },
  scanButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
    marginTop: 10,
    gap: 8,
  },
  scanButtonText: {
    color: c.accent,
    fontSize: 14,
    fontWeight: '500',
  },
});
