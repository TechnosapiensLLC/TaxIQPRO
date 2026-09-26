import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useScanStore } from '../src/store/scanStore';
import { useColors } from '../src/context/ThemeContext';
import type { Palette } from '../src/theme';

export default function BarcodeScanScreen() {
  const c = useColors();
  const styles = makeStyles(c);
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const setScan = useScanStore((state) => state.setScan);
  const [captured, setCaptured] = useState<string | null>(null);
  const [asked, setAsked] = useState(false);

  const handleScanned = ({ data }: { data: string }) => {
    if (captured) return;
    setCaptured(data);
    setScan(data);
    setTimeout(() => router.back(), 600);
  };

  if (!permission) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color={c.accent} />
      </SafeAreaView>
    );
  }

  if (!permission.granted) {
    const canAsk = permission.canAskAgain && !asked;
    return (
      <SafeAreaView style={styles.center}>
        <Ionicons name="barcode-outline" size={64} color={c.accent} />
        <Text style={styles.title}>Scan item barcodes</Text>
        <Text style={styles.body}>
          Use the camera to capture product barcodes while buying stock at the warehouse, so each
          item lands on the right expense record.
        </Text>
        {canAsk ? (
          <TouchableOpacity
            style={styles.button}
            onPress={async () => {
              setAsked(true);
              await requestPermission();
            }}
          >
            <Text style={styles.buttonText}>Allow Camera</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.button} onPress={() => Linking.openSettings()}>
            <Text style={styles.buttonText}>Open Settings</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.linkButton} onPress={() => router.back()}>
          <Text style={styles.linkText}>Not now</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  if (Platform.OS === 'web') {
    return (
      <SafeAreaView style={styles.center}>
        <Ionicons name="phone-portrait-outline" size={56} color={c.accent} />
        <Text style={styles.title}>Use the mobile app</Text>
        <Text style={styles.body}>
          Barcode scanning works on your phone. Open TaxIQ Pro on iOS or Android to scan items.
        </Text>
        <TouchableOpacity style={styles.button} onPress={() => router.back()}>
          <Text style={styles.buttonText}>Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={StyleSheet.absoluteFill}
        barcodeScannerSettings={{
          barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'code39', 'itf14'],
        }}
        onBarcodeScanned={handleScanned}
      />
      <SafeAreaView style={styles.overlay}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="close" size={28} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.overlayTitle}>Scan Item</Text>
          <View style={{ width: 28 }} />
        </View>
        <View style={styles.frame} />
        <Text style={styles.hint}>
          {captured ? `Captured ${captured}` : 'Point the camera at the product barcode'}
        </Text>
      </SafeAreaView>
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bgSunken },
    center: {
      flex: 1,
      backgroundColor: c.bg,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 32,
    },
    title: { color: c.text, fontSize: 20, fontWeight: '700', marginTop: 16 },
    body: {
      color: c.textMuted,
      fontSize: 14,
      textAlign: 'center',
      lineHeight: 20,
      marginTop: 10,
      marginBottom: 24,
    },
    button: {
      backgroundColor: c.accent,
      borderRadius: 14,
      paddingVertical: 15,
      paddingHorizontal: 32,
      minHeight: 48,
      justifyContent: 'center',
    },
    buttonText: { color: c.onPrimary, fontSize: 15, fontWeight: '700' },
    linkButton: { marginTop: 16, padding: 12 },
    linkText: { color: c.textMuted, fontSize: 14 },
    overlay: { flex: 1, justifyContent: 'space-between' },
    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingVertical: 16,
    },
    overlayTitle: { color: '#FFFFFF', fontSize: 17, fontWeight: '600' },
    frame: {
      alignSelf: 'center',
      width: '78%',
      height: 180,
      borderWidth: 3,
      borderColor: c.accent,
      borderRadius: 20,
    },
    hint: {
      color: '#FFFFFF',
      fontSize: 14,
      textAlign: 'center',
      paddingHorizontal: 32,
      paddingBottom: 40,
    },
  });
