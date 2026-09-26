import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { api } from '../src/services/api';

import { useColors } from '../src/context/ThemeContext';
import type { Palette } from '../src/theme';
export default function ScanScreen() {
  const c = useColors();
  const styles = makeStyles(c);
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<any>(null);
  const cameraRef = useRef<any>(null);

  const handleCapture = async () => {
    if (!cameraRef.current || scanning) return;

    try {
      setScanning(true);
      const photo = await cameraRef.current.takePictureAsync({
        base64: true,
        quality: 0.7,
      });

      if (photo?.base64) {
        // Analyze with AI
        const result = await api.scanReceipt(photo.base64);
        setScanResult({ ...result, image_base64: photo.base64 });
      }
    } catch (error) {
      console.error('Scan error:', error);
      Alert.alert('Error', 'Failed to scan receipt. Please try again.');
    } finally {
      setScanning(false);
    }
  };

  const handleSave = async () => {
    if (!scanResult) return;

    try {
      await api.createReceipt({
        vendor: scanResult.vendor || 'Unknown',
        amount: parseFloat(scanResult.amount) || 0,
        date: scanResult.date || new Date().toISOString().split('T')[0],
        category: scanResult.category || 'Other',
        notes: scanResult.suggested_deduction || '',
        image_base64: scanResult.image_base64,
      });
      router.back();
    } catch (error) {
      Alert.alert('Error', 'Failed to save receipt');
    }
  };

  const handleRetake = () => {
    setScanResult(null);
  };

  if (!permission) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={c.accent} />
        </View>
      </SafeAreaView>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.permissionContainer}>
          <Ionicons name="camera-outline" size={64} color={c.border} />
          <Text style={styles.permissionTitle}>Camera Access Required</Text>
          <Text style={styles.permissionText}>
            Receipt Brain needs camera access to scan your receipts
          </Text>
          <TouchableOpacity
            style={styles.permissionButton}
            onPress={requestPermission}
          >
            <Text style={styles.permissionButtonText}>Grant Access</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={() => router.back()}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (scanResult) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleRetake}>
            <Ionicons name="arrow-back" size={24} color="#FFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Scan Result</Text>
          <View style={{ width: 24 }} />
        </View>

        <View style={styles.resultContainer}>
          <View style={styles.resultCard}>
            <View style={styles.resultHeader}>
              <Ionicons name="checkmark-circle" size={48} color={c.accent} />
              <Text style={styles.resultTitle}>Receipt Analyzed</Text>
              <Text style={styles.confidenceText}>
                {Math.round((scanResult.confidence || 0) * 100)}% confidence
              </Text>
            </View>

            <View style={styles.resultDetails}>
              <View style={styles.resultRow}>
                <Text style={styles.resultLabel}>Vendor</Text>
                <Text style={styles.resultValue}>
                  {scanResult.vendor || 'Unknown'}
                </Text>
              </View>
              <View style={styles.resultRow}>
                <Text style={styles.resultLabel}>Amount</Text>
                <Text style={[styles.resultValue, styles.amountValue]}>
                  ${parseFloat(scanResult.amount || 0).toFixed(2)}
                </Text>
              </View>
              <View style={styles.resultRow}>
                <Text style={styles.resultLabel}>Date</Text>
                <Text style={styles.resultValue}>
                  {scanResult.date || 'Unknown'}
                </Text>
              </View>
              <View style={styles.resultRow}>
                <Text style={styles.resultLabel}>Category</Text>
                <Text style={styles.resultValue}>
                  {scanResult.category || 'Other'}
                </Text>
              </View>
            </View>

            {scanResult.suggested_deduction && (
              <View style={styles.deductionInfo}>
                <Ionicons name="bulb" size={20} color={c.warning} />
                <Text style={styles.deductionText}>
                  {scanResult.suggested_deduction}
                </Text>
              </View>
            )}
          </View>

          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={styles.retakeButton}
              onPress={handleRetake}
            >
              <Ionicons name="refresh" size={20} color="#FFF" />
              <Text style={styles.retakeButtonText}>Retake</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.saveButton}
              onPress={handleSave}
            >
              <Ionicons name="checkmark" size={20} color="#FFF" />
              <Text style={styles.saveButtonText}>Save Receipt</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="close" size={28} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Scan Receipt</Text>
        <View style={{ width: 28 }} />
      </View>

      <View style={styles.cameraContainer}>
        <CameraView
          ref={cameraRef}
          style={styles.camera}
          facing="back"
        >
          <View style={styles.overlay}>
            <View style={styles.scanFrame}>
              <View style={[styles.corner, styles.topLeft]} />
              <View style={[styles.corner, styles.topRight]} />
              <View style={[styles.corner, styles.bottomLeft]} />
              <View style={[styles.corner, styles.bottomRight]} />
            </View>
            <Text style={styles.instructionText}>
              Position receipt within frame
            </Text>
          </View>
        </CameraView>
      </View>

      <View style={styles.controls}>
        {scanning ? (
          <View style={styles.scanningContainer}>
            <ActivityIndicator size="large" color={c.accent} />
            <Text style={styles.scanningText}>Analyzing receipt...</Text>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.captureButton}
            onPress={handleCapture}
          >
            <View style={styles.captureButtonInner} />
          </TouchableOpacity>
        )}
      </View>

      <TouchableOpacity
        style={styles.manualButton}
        onPress={() => {
          router.back();
          router.push('/add-receipt');
        }}
      >
        <Ionicons name="create-outline" size={18} color={c.textMuted} />
        <Text style={styles.manualButtonText}>Enter manually instead</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const makeStyles = (c: Palette) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: c.bg,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  permissionTitle: {
    color: c.text,
    fontSize: 20,
    fontWeight: '600',
    marginTop: 20,
  },
  permissionText: {
    color: c.textMuted,
    fontSize: 14,
    textAlign: 'center',
    marginTop: 10,
  },
  permissionButton: {
    backgroundColor: c.accent,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 24,
  },
  permissionButtonText: {
    color: c.onPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButton: {
    marginTop: 16,
  },
  cancelButtonText: {
    color: c.textMuted,
    fontSize: 14,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  headerTitle: {
    color: c.text,
    fontSize: 18,
    fontWeight: '600',
  },
  cameraContainer: {
    flex: 1,
    marginHorizontal: 20,
    borderRadius: 20,
    overflow: 'hidden',
  },
  camera: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanFrame: {
    width: '85%',
    aspectRatio: 0.7,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderColor: c.accent,
  },
  topLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderTopLeftRadius: 8,
  },
  topRight: {
    top: 0,
    right: 0,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderTopRightRadius: 8,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderBottomLeftRadius: 8,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderBottomRightRadius: 8,
  },
  instructionText: {
    color: c.text,
    fontSize: 14,
    marginTop: 20,
    textShadowColor: '#000',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  controls: {
    paddingVertical: 30,
    alignItems: 'center',
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: c.text + '20',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: c.accent,
  },
  captureButtonInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: c.accent,
  },
  scanningContainer: {
    alignItems: 'center',
  },
  scanningText: {
    color: c.textMuted,
    fontSize: 14,
    marginTop: 12,
  },
  manualButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 20,
    gap: 6,
  },
  manualButtonText: {
    color: c.textMuted,
    fontSize: 14,
  },
  resultContainer: {
    flex: 1,
    paddingHorizontal: 20,
  },
  resultCard: {
    backgroundColor: c.surface,
    borderRadius: 20,
    padding: 24,
  },
  resultHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  resultTitle: {
    color: c.text,
    fontSize: 20,
    fontWeight: '600',
    marginTop: 12,
  },
  confidenceText: {
    color: c.textMuted,
    fontSize: 13,
    marginTop: 4,
  },
  resultDetails: {
    borderTopWidth: 1,
    borderTopColor: c.surfaceAlt,
    paddingTop: 20,
  },
  resultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  resultLabel: {
    color: c.textMuted,
    fontSize: 14,
  },
  resultValue: {
    color: c.text,
    fontSize: 16,
    fontWeight: '500',
  },
  amountValue: {
    color: c.accent,
    fontSize: 20,
    fontWeight: '700',
  },
  deductionInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: c.warning + '15',
    borderRadius: 12,
    padding: 14,
    marginTop: 8,
    gap: 10,
  },
  deductionText: {
    color: c.text,
    fontSize: 13,
    flex: 1,
    lineHeight: 20,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  retakeButton: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: c.border,
    paddingVertical: 16,
    borderRadius: 14,
    gap: 8,
  },
  retakeButtonText: {
    color: c.text,
    fontSize: 16,
    fontWeight: '600',
  },
  saveButton: {
    flex: 2,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: c.accent,
    paddingVertical: 16,
    borderRadius: 14,
    gap: 8,
  },
  saveButtonText: {
    color: c.onPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
});
