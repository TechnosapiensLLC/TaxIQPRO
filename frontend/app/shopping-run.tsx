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
  Modal,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { api } from '../src/services/api';
import { useColors } from '../src/context/ThemeContext';
import { useScanStore } from '../src/store/scanStore';
import type { Palette } from '../src/theme';

const money = (value: number) => `$${Number(value || 0).toFixed(2)}`;

export default function ShoppingRunScreen() {
  const c = useColors();
  const styles = makeStyles(c);
  const router = useRouter();

  const lastScan = useScanStore((s) => s.lastScan);
  const clearScan = useScanStore((s) => s.clear);

  const [run, setRun] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [vendor, setVendor] = useState('');
  const [stores, setStores] = useState<any[]>([]);
  const [storeId, setStoreId] = useState<string | null>(null);

  const [itemModal, setItemModal] = useState(false);
  const [itemBarcode, setItemBarcode] = useState<string | null>(null);
  const [itemName, setItemName] = useState('');
  const [itemQty, setItemQty] = useState('1');
  const [itemPrice, setItemPrice] = useState('');

  const [checkoutModal, setCheckoutModal] = useState(false);
  const [receiptTotal, setReceiptTotal] = useState('');
  const [receiptImage, setReceiptImage] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [active, storeList] = await Promise.all([
        api.getActiveShoppingRun(),
        api.getStores().catch(() => []),
      ]);
      setRun(active);
      setStores(storeList || []);
    } catch {
      Alert.alert('Could not load', 'Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // A barcode coming back from the scanner opens the item sheet pre-filled.
  useEffect(() => {
    if (!lastScan?.barcode || !run) return;
    const barcode = lastScan.barcode;
    clearScan();
    setItemBarcode(barcode);
    setItemName('');
    setItemQty('1');
    setItemPrice('');
    setItemModal(true);
    api
      .lookupBarcode(barcode)
      .then((hit) => {
        if (hit?.found) {
          setItemName(hit.name || '');
          setItemPrice(hit.unit_price ? String(hit.unit_price) : '');
        }
      })
      .catch(() => {});
  }, [lastScan, run, clearScan]);

  const startRun = async () => {
    if (!vendor.trim()) {
      Alert.alert('Where are you shopping?', 'Enter the warehouse or supplier name.');
      return;
    }
    setBusy(true);
    try {
      const created = await api.startShoppingRun({
        vendor: vendor.trim(),
        store_id: storeId ?? undefined,
      });
      setRun(created);
      setVendor('');
    } catch (e: any) {
      Alert.alert('Could not start', e?.response?.data?.detail || 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const saveItem = async () => {
    const qty = parseFloat(itemQty) || 1;
    const price = parseFloat(itemPrice) || 0;
    if (!itemName.trim()) {
      Alert.alert('Name required', 'What is this item?');
      return;
    }
    setBusy(true);
    try {
      const updated = await api.addShoppingItem(run.id, {
        barcode: itemBarcode ?? undefined,
        name: itemName.trim(),
        qty,
        unit_price: price,
      });
      setRun(updated);
      setItemModal(false);
      setItemBarcode(null);
    } catch {
      Alert.alert('Could not add item', 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const removeItem = async (index: number) => {
    setBusy(true);
    try {
      setRun(await api.removeShoppingItem(run.id, index));
    } catch {
      Alert.alert('Could not remove item', 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const pickReceipt = async () => {
    const existing = await ImagePicker.getCameraPermissionsAsync();
    let status = existing.status;
    if (Platform.OS !== 'web' && status !== 'granted' && existing.canAskAgain) {
      status = (await ImagePicker.requestCameraPermissionsAsync()).status;
    }
    const launch =
      Platform.OS === 'web' || status !== 'granted'
        ? ImagePicker.launchImageLibraryAsync
        : ImagePicker.launchCameraAsync;
    const result = await launch({ base64: true, quality: 0.6 });
    if (!result.canceled && result.assets?.[0]?.base64) {
      setReceiptImage(result.assets[0].base64);
    }
  };

  const checkout = async () => {
    setBusy(true);
    try {
      const done = await api.checkoutShoppingRun(run.id, {
        receipt_total: receiptTotal ? parseFloat(receiptTotal) : undefined,
        receipt_image_base64: receiptImage ?? undefined,
      });
      setCheckoutModal(false);
      setReceiptTotal('');
      setReceiptImage(null);
      setRun(null);
      const variance = done.variance ?? 0;
      Alert.alert(
        'Expense created',
        `${money(done.receipt_total)} logged as one expense with ${done.item_count} line items.` +
          (Math.abs(variance) > 0.01
            ? `\n\nReceipt differs from scanned total by ${money(Math.abs(variance))}.`
            : ''),
        [{ text: 'Done' }]
      );
    } catch (e: any) {
      Alert.alert('Could not check out', e?.response?.data?.detail || 'Please try again.');
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

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconButton}>
          <Ionicons name="close" size={26} color={c.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Shopping Run</Text>
        <View style={styles.iconButton} />
      </View>

      {!run ? (
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.introCard}>
            <Ionicons name="cart-outline" size={28} color={c.accent} />
            <Text style={styles.introTitle}>Start a warehouse run</Text>
            <Text style={styles.introText}>
              Scan each item as it goes in the cart. At checkout we turn the whole trip into one
              clean expense with every line item attached.
            </Text>
          </View>

          <Text style={styles.label}>Warehouse / supplier</Text>
          <TextInput
            style={styles.input}
            value={vendor}
            onChangeText={setVendor}
            placeholder="Restaurant Depot"
            placeholderTextColor={c.borderStrong}
          />

          {stores.length > 0 && (
            <>
              <Text style={styles.label}>Buying for (optional)</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chipRow}
              >
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
            </>
          )}

          <TouchableOpacity
            style={[styles.primaryButton, busy && styles.disabled]}
            onPress={startRun}
            disabled={busy}
          >
            {busy ? (
              <ActivityIndicator color={c.onPrimary} />
            ) : (
              <>
                <Ionicons name="play" size={18} color={c.onPrimary} />
                <Text style={styles.primaryButtonText}>Start run</Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      ) : (
        <>
          <ScrollView contentContainerStyle={styles.content}>
            <View style={styles.runHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.runVendor}>{run.vendor}</Text>
                <Text style={styles.runMeta}>
                  {run.item_count} line{run.item_count === 1 ? '' : 's'} · {run.unit_count} units
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.runTotal}>{money(run.scanned_total)}</Text>
                <Text style={styles.runMeta}>running total</Text>
              </View>
            </View>

            <View style={styles.actionRow}>
              <TouchableOpacity
                style={styles.scanButton}
                onPress={() => router.push('/barcode-scan')}
              >
                <Ionicons name="barcode-outline" size={20} color={c.onPrimary} />
                <Text style={styles.scanButtonText}>Scan item</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.manualButton}
                onPress={() => {
                  setItemBarcode(null);
                  setItemName('');
                  setItemQty('1');
                  setItemPrice('');
                  setItemModal(true);
                }}
              >
                <Ionicons name="create-outline" size={18} color={c.accent} />
                <Text style={styles.manualButtonText}>Add manually</Text>
              </TouchableOpacity>
            </View>

            {run.items.length === 0 ? (
              <Text style={styles.emptyText}>
                Nothing in the cart yet. Scan your first item.
              </Text>
            ) : (
              run.items.map((item: any, index: number) => (
                <View key={index} style={styles.itemCard}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemName}>{item.name}</Text>
                    <Text style={styles.itemMeta}>
                      {item.qty} × {money(item.unit_price)}
                      {item.barcode ? ` · ${item.barcode}` : ''}
                    </Text>
                  </View>
                  <Text style={styles.itemTotal}>{money(item.line_total)}</Text>
                  <TouchableOpacity
                    onPress={() => removeItem(index)}
                    style={styles.itemRemove}
                    disabled={busy}
                  >
                    <Ionicons name="trash-outline" size={18} color={c.danger} />
                  </TouchableOpacity>
                </View>
              ))
            )}
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.primaryButton, run.items.length === 0 && styles.disabled]}
              onPress={() => setCheckoutModal(true)}
              disabled={run.items.length === 0}
            >
              <Ionicons name="receipt-outline" size={18} color={c.onPrimary} />
              <Text style={styles.primaryButtonText}>
                Checkout · {money(run.scanned_total)}
              </Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      {/* Add item */}
      <Modal visible={itemModal} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{itemBarcode ? 'Scanned item' : 'Add item'}</Text>
              <TouchableOpacity onPress={() => setItemModal(false)}>
                <Ionicons name="close" size={24} color={c.text} />
              </TouchableOpacity>
            </View>
            {!!itemBarcode && <Text style={styles.barcodeLine}>Barcode {itemBarcode}</Text>}
            <Text style={styles.label}>Item name</Text>
            <TextInput
              style={styles.input}
              value={itemName}
              onChangeText={setItemName}
              placeholder="Pepsi 12pk"
              placeholderTextColor={c.borderStrong}
            />
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Quantity</Text>
                <TextInput
                  style={styles.input}
                  value={itemQty}
                  onChangeText={setItemQty}
                  keyboardType="decimal-pad"
                  placeholder="1"
                  placeholderTextColor={c.borderStrong}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Unit price</Text>
                <TextInput
                  style={styles.input}
                  value={itemPrice}
                  onChangeText={setItemPrice}
                  keyboardType="decimal-pad"
                  placeholder="0.00"
                  placeholderTextColor={c.borderStrong}
                />
              </View>
            </View>
            <TouchableOpacity
              style={[styles.primaryButton, busy && styles.disabled]}
              onPress={saveItem}
              disabled={busy}
            >
              {busy ? (
                <ActivityIndicator color={c.onPrimary} />
              ) : (
                <Text style={styles.primaryButtonText}>Add to cart</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Checkout */}
      <Modal visible={checkoutModal} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Checkout</Text>
              <TouchableOpacity onPress={() => setCheckoutModal(false)}>
                <Ionicons name="close" size={24} color={c.text} />
              </TouchableOpacity>
            </View>
            <Text style={styles.helper}>
              Scanned total is {money(run?.scanned_total ?? 0)}. Snap the till receipt and we read
              the real total, or type it in.
            </Text>

            <TouchableOpacity style={styles.receiptButton} onPress={pickReceipt}>
              <Ionicons
                name={receiptImage ? 'checkmark-circle' : 'camera-outline'}
                size={20}
                color={receiptImage ? c.success : c.accent}
              />
              <Text style={styles.receiptButtonText}>
                {receiptImage ? 'Receipt attached' : 'Attach receipt photo'}
              </Text>
            </TouchableOpacity>

            <Text style={styles.label}>Receipt total (optional)</Text>
            <TextInput
              style={styles.input}
              value={receiptTotal}
              onChangeText={setReceiptTotal}
              keyboardType="decimal-pad"
              placeholder={String(run?.scanned_total ?? '0.00')}
              placeholderTextColor={c.borderStrong}
            />

            <TouchableOpacity
              style={[styles.primaryButton, busy && styles.disabled]}
              onPress={checkout}
              disabled={busy}
            >
              {busy ? (
                <ActivityIndicator color={c.onPrimary} />
              ) : (
                <Text style={styles.primaryButtonText}>Create one expense</Text>
              )}
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
    content: { padding: 16, paddingBottom: 40 },
    introCard: {
      backgroundColor: c.surface,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: c.border,
      padding: 20,
      alignItems: 'center',
      gap: 10,
      marginBottom: 24,
    },
    introTitle: { color: c.text, fontSize: 18, fontWeight: '700' },
    introText: { color: c.textMuted, fontSize: 13, textAlign: 'center', lineHeight: 20 },
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
    row: { flexDirection: 'row', gap: 12 },
    chipRow: { gap: 8, paddingRight: 8, paddingBottom: 16 },
    chip: {
      paddingHorizontal: 14,
      borderRadius: 999,
      backgroundColor: c.surfaceAlt,
      borderWidth: 1,
      borderColor: c.border,
      minHeight: 44,
      justifyContent: 'center',
    },
    chipActive: { backgroundColor: c.accent, borderColor: c.accent },
    chipText: { color: c.textMuted, fontSize: 13, fontWeight: '600' },
    chipTextActive: { color: c.onPrimary },
    primaryButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: c.accent,
      borderRadius: 14,
      minHeight: 52,
    },
    primaryButtonText: { color: c.onPrimary, fontSize: 16, fontWeight: '700' },
    disabled: { opacity: 0.5 },
    runHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: c.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: c.border,
      padding: 18,
      marginBottom: 16,
    },
    runVendor: { color: c.text, fontSize: 17, fontWeight: '700' },
    runMeta: { color: c.textMuted, fontSize: 12, marginTop: 3 },
    runTotal: { color: c.accentAlt, fontSize: 22, fontWeight: '800' },
    actionRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
    scanButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: c.accent,
      borderRadius: 12,
      minHeight: 48,
    },
    scanButtonText: { color: c.onPrimary, fontSize: 14, fontWeight: '700' },
    manualButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      backgroundColor: c.surfaceAlt,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 12,
      minHeight: 48,
    },
    manualButtonText: { color: c.accent, fontSize: 14, fontWeight: '600' },
    emptyText: { color: c.textMuted, fontSize: 13, textAlign: 'center', marginTop: 12 },
    itemCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: c.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: c.border,
      padding: 14,
      marginBottom: 8,
    },
    itemName: { color: c.text, fontSize: 14, fontWeight: '600' },
    itemMeta: { color: c.textMuted, fontSize: 12, marginTop: 3 },
    itemTotal: { color: c.text, fontSize: 14, fontWeight: '700' },
    itemRemove: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
    footer: {
      padding: 16,
      borderTopWidth: 1,
      borderTopColor: c.border,
      backgroundColor: c.surface,
    },
    modalBackdrop: { flex: 1, backgroundColor: c.scrim, justifyContent: 'flex-end' },
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
    modalTitle: { color: c.text, fontSize: 18, fontWeight: '700' },
    barcodeLine: { color: c.textMuted, fontSize: 12, marginBottom: 14 },
    helper: { color: c.textMuted, fontSize: 13, lineHeight: 19, marginBottom: 16 },
    receiptButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: c.surfaceAlt,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 12,
      paddingHorizontal: 14,
      minHeight: 52,
      marginBottom: 18,
    },
    receiptButtonText: { color: c.text, fontSize: 14, fontWeight: '600' },
  });
