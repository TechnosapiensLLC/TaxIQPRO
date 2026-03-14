import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  Animated,
  PanResponder,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSubscription } from '../src/store/subscriptionStore';
import { api } from '../src/services/api';
import { format, isValid, parseISO } from 'date-fns';

const { width, height } = Dimensions.get('window');
const SWIPE_THRESHOLD = width * 0.3;

interface Receipt {
  id: string;
  vendor: string;
  amount: number;
  date: string;
  category: string;
  is_deductible: boolean;
}

export default function SwipeClassifyScreen() {
  const router = useRouter();
  const { checkFeatureAccess, currentTier } = useSubscription();
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [classifying, setClassifying] = useState(false);

  const position = useRef(new Animated.ValueXY()).current;
  const rotation = position.x.interpolate({
    inputRange: [-width / 2, 0, width / 2],
    outputRange: ['-15deg', '0deg', '15deg'],
  });

  const businessOpacity = position.x.interpolate({
    inputRange: [0, width / 4],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  const personalOpacity = position.x.interpolate({
    inputRange: [-width / 4, 0],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  React.useEffect(() => {
    if (!checkFeatureAccess('swipeClassify')) {
      Alert.alert(
        'Pro Feature',
        'Swipe-to-classify is available on TaxIQ Pro and above.',
        [
          { text: 'Cancel', onPress: () => router.back() },
          { text: 'Upgrade', onPress: () => router.push('/pricing') },
        ]
      );
      return;
    }
    fetchReceipts();
  }, []);

  const fetchReceipts = async () => {
    try {
      const data = await api.getReceipts();
      // Filter receipts that might need classification review
      const needsReview = data.filter((r: Receipt) => !r.is_deductible || r.category === 'Other');
      setReceipts(needsReview);
    } catch (error) {
      console.error('Error fetching receipts:', error);
    } finally {
      setLoading(false);
    }
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderMove: (_, gesture) => {
        position.setValue({ x: gesture.dx, y: gesture.dy });
      },
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dx > SWIPE_THRESHOLD) {
          swipeRight();
        } else if (gesture.dx < -SWIPE_THRESHOLD) {
          swipeLeft();
        } else {
          resetPosition();
        }
      },
    })
  ).current;

  const resetPosition = () => {
    Animated.spring(position, {
      toValue: { x: 0, y: 0 },
      useNativeDriver: false,
    }).start();
  };

  const swipeRight = () => {
    // Business expense
    Animated.timing(position, {
      toValue: { x: width + 100, y: 0 },
      duration: 250,
      useNativeDriver: false,
    }).start(() => handleClassification(true));
  };

  const swipeLeft = () => {
    // Personal expense
    Animated.timing(position, {
      toValue: { x: -width - 100, y: 0 },
      duration: 250,
      useNativeDriver: false,
    }).start(() => handleClassification(false));
  };

  const handleClassification = async (isBusiness: boolean) => {
    setClassifying(true);
    const receipt = receipts[currentIndex];
    
    // Call the API to classify the receipt
    try {
      await api.classifyReceipt(receipt.id, isBusiness);
      console.log(`Classified ${receipt.vendor} as ${isBusiness ? 'Business' : 'Personal'}`);
    } catch (error) {
      console.error('Classification error:', error);
    }

    position.setValue({ x: 0, y: 0 });
    setCurrentIndex((prev) => prev + 1);
    setClassifying(false);
  };

  const formatDate = (dateStr: string): string => {
    if (!dateStr) return 'No date';
    try {
      const date = parseISO(dateStr);
      if (isValid(date)) return format(date, 'MMM d, yyyy');
      return 'Invalid date';
    } catch {
      return 'Invalid date';
    }
  };

  const currentReceipt = receipts[currentIndex];

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#00D9A5" />
          <Text style={styles.loadingText}>Loading receipts...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!currentReceipt || currentIndex >= receipts.length) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="close" size={28} color="#FFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Swipe to Classify</Text>
          <View style={{ width: 28 }} />
        </View>
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIcon}>
            <Ionicons name="checkmark-circle" size={64} color="#00D9A5" />
          </View>
          <Text style={styles.emptyTitle}>All caught up!</Text>
          <Text style={styles.emptySubtitle}>
            No receipts need classification right now.
          </Text>
          <TouchableOpacity style={styles.doneButton} onPress={() => router.back()}>
            <Text style={styles.doneButtonText}>Back to Dashboard</Text>
          </TouchableOpacity>
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
        <Text style={styles.headerTitle}>Swipe to Classify</Text>
        <Text style={styles.counter}>
          {currentIndex + 1}/{receipts.length}
        </Text>
      </View>

      <View style={styles.instructions}>
        <View style={styles.instructionItem}>
          <Ionicons name="arrow-back" size={20} color="#FF6B6B" />
          <Text style={styles.instructionText}>Personal</Text>
        </View>
        <View style={styles.instructionItem}>
          <Text style={styles.instructionText}>Business</Text>
          <Ionicons name="arrow-forward" size={20} color="#00D9A5" />
        </View>
      </View>

      <View style={styles.cardContainer}>
        <Animated.View
          {...panResponder.panHandlers}
          style={[
            styles.card,
            {
              transform: [
                { translateX: position.x },
                { translateY: position.y },
                { rotate: rotation },
              ],
            },
          ]}
        >
          {/* Business Overlay */}
          <Animated.View style={[styles.overlay, styles.businessOverlay, { opacity: businessOpacity }]}>
            <Ionicons name="briefcase" size={48} color="#00D9A5" />
            <Text style={styles.overlayText}>BUSINESS</Text>
          </Animated.View>

          {/* Personal Overlay */}
          <Animated.View style={[styles.overlay, styles.personalOverlay, { opacity: personalOpacity }]}>
            <Ionicons name="person" size={48} color="#FF6B6B" />
            <Text style={[styles.overlayText, { color: '#FF6B6B' }]}>PERSONAL</Text>
          </Animated.View>

          <View style={styles.cardContent}>
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryText}>{currentReceipt.category}</Text>
            </View>
            
            <Text style={styles.vendorName}>{currentReceipt.vendor}</Text>
            <Text style={styles.receiptAmount}>${currentReceipt.amount.toFixed(2)}</Text>
            <Text style={styles.receiptDate}>{formatDate(currentReceipt.date)}</Text>
          </View>
        </Animated.View>
      </View>

      <View style={styles.buttonRow}>
        <TouchableOpacity style={styles.actionButton} onPress={swipeLeft}>
          <Ionicons name="close-circle" size={32} color="#FF6B6B" />
          <Text style={styles.actionButtonText}>Personal</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.skipButton} onPress={() => setCurrentIndex((prev) => prev + 1)}>
          <Ionicons name="refresh" size={24} color="#6B6B7B" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton} onPress={swipeRight}>
          <Ionicons name="checkmark-circle" size={32} color="#00D9A5" />
          <Text style={styles.actionButtonText}>Business</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0F',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#6B6B7B',
    marginTop: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  counter: {
    color: '#6B6B7B',
    fontSize: 14,
  },
  instructions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 40,
    marginBottom: 20,
  },
  instructionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  instructionText: {
    color: '#6B6B7B',
    fontSize: 14,
  },
  cardContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    width: width - 60,
    height: height * 0.45,
    backgroundColor: '#14141A',
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#2A2A35',
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  businessOverlay: {
    backgroundColor: '#00D9A520',
  },
  personalOverlay: {
    backgroundColor: '#FF6B6B20',
  },
  overlayText: {
    color: '#00D9A5',
    fontSize: 28,
    fontWeight: '800',
    marginTop: 12,
  },
  cardContent: {
    flex: 1,
    padding: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryBadge: {
    backgroundColor: '#2A2A35',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 24,
  },
  categoryText: {
    color: '#6B6B7B',
    fontSize: 14,
    fontWeight: '500',
  },
  vendorName: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 16,
  },
  receiptAmount: {
    color: '#00D9A5',
    fontSize: 48,
    fontWeight: '800',
    marginBottom: 8,
  },
  receiptDate: {
    color: '#6B6B7B',
    fontSize: 16,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 30,
    gap: 30,
  },
  actionButton: {
    alignItems: 'center',
    gap: 8,
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
  skipButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#2A2A35',
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#00D9A520',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  emptyTitle: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
  },
  emptySubtitle: {
    color: '#6B6B7B',
    fontSize: 15,
    textAlign: 'center',
  },
  doneButton: {
    backgroundColor: '#00D9A5',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 14,
    marginTop: 32,
  },
  doneButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
