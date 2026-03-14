import React, { useState, useEffect } from 'react';
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

const PLATFORMS = [
  { id: 'Uber', icon: 'car', color: '#000000' },
  { id: 'Lyft', icon: 'car', color: '#FF00BF' },
  { id: 'DoorDash', icon: 'fast-food', color: '#FF3008' },
  { id: 'Uber Eats', icon: 'restaurant', color: '#06C167' },
  { id: 'Instacart', icon: 'cart', color: '#43B02A' },
  { id: 'Grubhub', icon: 'fast-food', color: '#F63440' },
  { id: 'Amazon Flex', icon: 'cube', color: '#FF9900' },
  { id: 'Upwork', icon: 'briefcase', color: '#14A800' },
  { id: 'Fiverr', icon: 'briefcase', color: '#1DBF73' },
  { id: 'TaskRabbit', icon: 'construct', color: '#8BC34A' },
  { id: 'Rover', icon: 'paw', color: '#00B268' },
  { id: 'Airbnb', icon: 'home', color: '#FF5A5F' },
  { id: 'Turo', icon: 'car-sport', color: '#4B2D84' },
  { id: 'Etsy', icon: 'storefront', color: '#F56400' },
  { id: 'Other', icon: 'cash', color: '#6B6B7B' },
];

export default function AddIncomeScreen() {
  const router = useRouter();
  const [source, setSource] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [description, setDescription] = useState('');
  const [is1099, setIs1099] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showPlatforms, setShowPlatforms] = useState(false);

  const handleSave = async () => {
    if (!source) {
      Alert.alert('Error', 'Please select an income source');
      return;
    }
    if (!amount || parseFloat(amount) <= 0) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }

    try {
      setSaving(true);
      await api.createIncome({
        source,
        amount: parseFloat(amount),
        date,
        description: description.trim(),
        is_1099: is1099,
      });
      router.back();
    } catch (error) {
      Alert.alert('Error', 'Failed to save income');
    } finally {
      setSaving(false);
    }
  };

  const selectedPlatform = PLATFORMS.find((p) => p.id === source);

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
          <Text style={styles.headerTitle}>Add Income</Text>
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
          {/* Platform Selection */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Income Source</Text>
            <TouchableOpacity
              style={[
                styles.platformSelector,
                source && { borderColor: '#00D9A530' },
              ]}
              onPress={() => setShowPlatforms(!showPlatforms)}
            >
              {source ? (
                <View style={styles.selectedPlatform}>
                  <Ionicons
                    name={selectedPlatform?.icon as any}
                    size={24}
                    color="#00D9A5"
                  />
                  <Text style={styles.selectedPlatformText}>{source}</Text>
                </View>
              ) : (
                <Text style={styles.platformPlaceholder}>Select platform</Text>
              )}
              <Ionicons
                name={showPlatforms ? 'chevron-up' : 'chevron-down'}
                size={20}
                color="#6B6B7B"
              />
            </TouchableOpacity>

            {showPlatforms && (
              <View style={styles.platformsGrid}>
                {PLATFORMS.map((platform) => (
                  <TouchableOpacity
                    key={platform.id}
                    style={[
                      styles.platformOption,
                      source === platform.id && styles.platformOptionSelected,
                    ]}
                    onPress={() => {
                      setSource(platform.id);
                      setShowPlatforms(false);
                    }}
                  >
                    <Ionicons
                      name={platform.icon as any}
                      size={22}
                      color={source === platform.id ? '#00D9A5' : '#6B6B7B'}
                    />
                    <Text
                      style={[
                        styles.platformOptionText,
                        source === platform.id && styles.platformOptionTextSelected,
                      ]}
                      numberOfLines={1}
                    >
                      {platform.id}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {/* Amount */}
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

          {/* Date */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Date Received</Text>
            <TextInput
              style={styles.input}
              value={date}
              onChangeText={setDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor="#4A4A5A"
            />
          </View>

          {/* 1099 Toggle */}
          <View style={styles.inputGroup}>
            <TouchableOpacity
              style={styles.toggleRow}
              onPress={() => setIs1099(!is1099)}
            >
              <View style={styles.toggleInfo}>
                <Text style={styles.toggleTitle}>1099 Income</Text>
                <Text style={styles.toggleDescription}>
                  Income reported on a 1099 form
                </Text>
              </View>
              <View
                style={[
                  styles.toggle,
                  is1099 && styles.toggleActive,
                ]}
              >
                <View
                  style={[
                    styles.toggleKnob,
                    is1099 && styles.toggleKnobActive,
                  ]}
                />
              </View>
            </TouchableOpacity>
          </View>

          {/* Description */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Description (optional)</Text>
            <TextInput
              style={[styles.input, styles.descriptionInput]}
              value={description}
              onChangeText={setDescription}
              placeholder="e.g., Weekly earnings, tips, bonuses"
              placeholderTextColor="#4A4A5A"
              multiline
              numberOfLines={2}
              textAlignVertical="top"
            />
          </View>

          {/* Tax Info */}
          <View style={styles.taxInfo}>
            <Ionicons name="information-circle" size={18} color="#FFB84D" />
            <Text style={styles.taxInfoText}>
              Gig income over $600 is typically reported on 1099-K or 1099-NEC forms
            </Text>
          </View>
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
  platformSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#14141A',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#2A2A35',
  },
  platformPlaceholder: {
    color: '#4A4A5A',
    fontSize: 16,
  },
  selectedPlatform: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  selectedPlatformText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
  },
  platformsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
    backgroundColor: '#14141A',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#2A2A35',
  },
  platformOption: {
    width: '31%',
    alignItems: 'center',
    backgroundColor: '#1A1A22',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  platformOptionSelected: {
    backgroundColor: '#00D9A520',
    borderWidth: 1,
    borderColor: '#00D9A550',
  },
  platformOptionText: {
    color: '#6B6B7B',
    fontSize: 11,
    marginTop: 6,
    textAlign: 'center',
  },
  platformOptionTextSelected: {
    color: '#00D9A5',
    fontWeight: '500',
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
    fontSize: 24,
    fontWeight: '600',
    paddingLeft: 16,
  },
  amountInput: {
    flex: 1,
    borderWidth: 0,
    fontSize: 28,
    fontWeight: '600',
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#14141A',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#2A2A35',
  },
  toggleInfo: {
    flex: 1,
  },
  toggleTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '500',
  },
  toggleDescription: {
    color: '#6B6B7B',
    fontSize: 12,
    marginTop: 2,
  },
  toggle: {
    width: 50,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#2A2A35',
    justifyContent: 'center',
    padding: 2,
  },
  toggleActive: {
    backgroundColor: '#00D9A5',
  },
  toggleKnob: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
  },
  toggleKnobActive: {
    alignSelf: 'flex-end',
  },
  descriptionInput: {
    minHeight: 70,
    paddingTop: 14,
  },
  taxInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFB84D10',
    borderRadius: 12,
    padding: 14,
    gap: 10,
  },
  taxInfoText: {
    color: '#FFB84D',
    fontSize: 13,
    flex: 1,
    lineHeight: 20,
  },
});
