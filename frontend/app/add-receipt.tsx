import React, { useState } from 'react';
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

const CATEGORIES = [
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
  'Other',
];

export default function AddReceiptScreen() {
  const router = useRouter();
  const [vendor, setVendor] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [category, setCategory] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [showCategories, setShowCategories] = useState(false);

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
              placeholderTextColor="#4A4A5A"
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
                placeholderTextColor="#4A4A5A"
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
              placeholderTextColor="#4A4A5A"
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
                  !category && { color: '#4A4A5A' },
                ]}
              >
                {category || 'Select a category'}
              </Text>
              <Ionicons
                name={showCategories ? 'chevron-up' : 'chevron-down'}
                size={20}
                color="#6B6B7B"
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
                        color="#00D9A5"
                      />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Notes (optional)</Text>
            <TextInput
              style={[styles.input, styles.notesInput]}
              value={notes}
              onChangeText={setNotes}
              placeholder="Add any notes about this expense"
              placeholderTextColor="#4A4A5A"
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
            <Ionicons name="camera" size={20} color="#00D9A5" />
            <Text style={styles.scanButtonText}>Scan receipt instead</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
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
  saveText: {
    color: '#00D9A5',
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
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#14141A',
    borderRadius: 12,
    padding: 16,
    color: '#FFFFFF',
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#2A2A35',
  },
  amountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#14141A',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2A2A35',
  },
  currencySymbol: {
    color: '#00D9A5',
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
    backgroundColor: '#14141A',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#2A2A35',
  },
  categorySelectorText: {
    color: '#FFFFFF',
    fontSize: 16,
  },
  categoriesList: {
    backgroundColor: '#14141A',
    borderRadius: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#2A2A35',
    maxHeight: 250,
  },
  categoryOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1A1A22',
  },
  categoryOptionSelected: {
    backgroundColor: '#00D9A510',
  },
  categoryOptionText: {
    color: '#FFFFFF',
    fontSize: 15,
  },
  categoryOptionTextSelected: {
    color: '#00D9A5',
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
    color: '#00D9A5',
    fontSize: 14,
    fontWeight: '500',
  },
});
