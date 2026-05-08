import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  FlatList,
  Alert,
  ActivityIndicator,
  Dimensions,
  Modal,
  Platform,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { api } from '../src/services/api';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface GasStation {
  id: string;
  name: string;
  logo: string;
  address: string;
  latitude: number;
  longitude: number;
  distance_miles: number;
  prices: {
    regular: number;
    midgrade: number;
    premium: number;
    diesel: number;
  };
  last_updated: string;
  amenities: string[];
  is_member_only: boolean;
  hours: string;
}

interface Summary {
  total_found: number;
  cheapest_premium: number;
  average_premium: number;
  potential_savings_per_gallon: number;
  potential_savings_per_fillup: number;
  data_source?: string;
  base_prices?: {
    regular: number;
    midgrade: number;
    premium: number;
    diesel: number;
  };
}

type FuelGrade = 'regular' | 'midgrade' | 'premium' | 'diesel';
type ViewMode = 'list' | 'map';

const FUEL_GRADES: { key: FuelGrade; label: string; color: string }[] = [
  { key: 'regular', label: 'Regular', color: '#6B6B7B' },
  { key: 'midgrade', label: 'Mid-Grade', color: '#FFB84D' },
  { key: 'premium', label: 'Premium', color: '#7C6BFF' },
  { key: 'diesel', label: 'Diesel', color: '#00D9A5' },
];

const BRAND_COLORS: { [key: string]: string } = {
  shell: '#FFCC00',
  chevron: '#0054A6',
  exxon: '#E31837',
  bp: '#00A651',
  '76': '#F26522',
  arco: '#00529B',
  costco: '#E31837',
  sams: '#0072CE',
  valero: '#004F9F',
  speedway: '#E31837',
  circlek: '#E31837',
  quiktrip: '#E31837',
};

export default function GasFinderScreen() {
  const router = useRouter();
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [selectedGrade, setSelectedGrade] = useState<FuelGrade>('premium');
  const [loading, setLoading] = useState(true);
  const [stations, setStations] = useState<GasStation[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [selectedStation, setSelectedStation] = useState<GasStation | null>(null);
  const [showPriceModal, setShowPriceModal] = useState(false);

  useEffect(() => {
    loadGasStations();
  }, [selectedGrade]);

  const loadGasStations = async () => {
    try {
      setLoading(true);
      
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Location access is needed to find gas stations near you.');
        setLoading(false);
        return;
      }

      const location = await Location.getCurrentPositionAsync({});
      const lat = location.coords.latitude;
      const lng = location.coords.longitude;
      setUserLocation({ lat, lng });

      const result = await api.getGasStations(lat, lng, 5, selectedGrade);
      setStations(result.stations || []);
      setSummary(result.summary);

      // Center map on user location
      if (mapRef.current && result.stations?.length > 0) {
        mapRef.current.animateToRegion({
          latitude: lat,
          longitude: lng,
          latitudeDelta: 0.1,
          longitudeDelta: 0.1,
        });
      }
    } catch (error) {
      console.error('Error loading gas stations:', error);
      Alert.alert('Error', 'Could not load gas stations. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleStationPress = (station: GasStation) => {
    setSelectedStation(station);
    setShowPriceModal(true);
  };

  const openDirections = (station: GasStation) => {
    const scheme = Platform.select({ ios: 'maps:', android: 'geo:' });
    const url = Platform.select({
      ios: `maps:?daddr=${station.latitude},${station.longitude}&dirflg=d`,
      android: `geo:${station.latitude},${station.longitude}?q=${station.latitude},${station.longitude}(${station.name})`,
      default: `https://www.google.com/maps/dir/?api=1&destination=${station.latitude},${station.longitude}`,
    });
    
    Linking.openURL(url as string).catch(() => {
      // Fallback to Google Maps web
      Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${station.latitude},${station.longitude}`);
    });
  };

  const formatPrice = (price: number) => `$${price.toFixed(2)}`;

  const getTimeSinceUpdate = (isoString: string) => {
    try {
      const date = new Date(isoString);
      const hours = Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60));
      if (hours < 1) return 'Just now';
      if (hours === 1) return '1 hour ago';
      return `${hours} hours ago`;
    } catch {
      return 'Recently';
    }
  };

  const getMarkerColor = (station: GasStation): string => {
    if (!summary) return '#6B6B7B';
    const price = station.prices[selectedGrade];
    const cheapest = summary.cheapest_premium;
    const avg = summary.average_premium;
    
    if (price <= cheapest + 0.05) return '#00D9A5'; // Green - cheapest
    if (price <= avg) return '#FFB84D'; // Yellow - below average
    return '#FF6B6B'; // Red - above average
  };

  const renderStationCard = ({ item }: { item: GasStation }) => {
    const isCheapest = summary && item.prices[selectedGrade] === summary.cheapest_premium;
    const savings = summary ? (summary.average_premium - item.prices[selectedGrade]).toFixed(2) : '0.00';
    
    return (
      <TouchableOpacity
        style={[styles.stationCard, isCheapest && styles.stationCardCheapest]}
        onPress={() => handleStationPress(item)}
        activeOpacity={0.8}
      >
        {isCheapest && (
          <View style={styles.cheapestBadge}>
            <Ionicons name="trophy" size={12} color="#FFB84D" />
            <Text style={styles.cheapestBadgeText}>CHEAPEST</Text>
          </View>
        )}
        
        <View style={styles.stationHeader}>
          <View style={styles.stationInfo}>
            <View style={[styles.brandDot, { backgroundColor: BRAND_COLORS[item.logo] || '#6B6B7B' }]} />
            <View>
              <Text style={styles.stationName}>{item.name}</Text>
              <Text style={styles.stationAddress} numberOfLines={1}>{item.address}</Text>
            </View>
          </View>
          <View style={styles.priceContainer}>
            <Text style={styles.priceValue}>{formatPrice(item.prices[selectedGrade])}</Text>
            <Text style={styles.priceLabel}>{selectedGrade}</Text>
          </View>
        </View>

        <View style={styles.stationDetails}>
          <View style={styles.detailItem}>
            <Ionicons name="location-outline" size={14} color="#6B6B7B" />
            <Text style={styles.detailText}>{item.distance_miles} mi</Text>
          </View>
          <View style={styles.detailItem}>
            <Ionicons name="time-outline" size={14} color="#6B6B7B" />
            <Text style={styles.detailText}>{item.hours}</Text>
          </View>
          {parseFloat(savings) > 0 && (
            <View style={styles.savingsBadge}>
              <Ionicons name="arrow-down" size={12} color="#00D9A5" />
              <Text style={styles.savingsText}>Save ${savings}/gal</Text>
            </View>
          )}
        </View>

        {item.is_member_only && (
          <View style={styles.memberBadge}>
            <Ionicons name="card" size={12} color="#FFB84D" />
            <Text style={styles.memberText}>Members Only</Text>
          </View>
        )}

        <View style={styles.cardActions}>
          <TouchableOpacity style={styles.allPricesButton} onPress={() => handleStationPress(item)}>
            <Text style={styles.allPricesText}>All Grades</Text>
            <Ionicons name="chevron-forward" size={14} color="#7C6BFF" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.directionsSmallButton} onPress={() => openDirections(item)}>
            <Ionicons name="navigate" size={14} color="#00D9A5" />
            <Text style={styles.directionsSmallText}>Directions</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  const renderMapView = () => {
    // Map view is only available on native devices with react-native-maps
    // For web preview, show a placeholder
    return (
      <View style={styles.mapUnavailable}>
        <Ionicons name="map-outline" size={48} color="#2A2A35" />
        <Text style={styles.mapUnavailableText}>Map view available on mobile devices</Text>
        <Text style={styles.mapUnavailableSubtext}>Open in Expo Go to see the interactive map</Text>
        <View style={styles.mapStationList}>
          {stations.slice(0, 5).map((station, index) => {
            const isCheapest = index === 0;
            return (
              <TouchableOpacity 
                key={station.id} 
                style={styles.mapListItem}
                onPress={() => handleStationPress(station)}
              >
                <View style={[styles.mapListDot, { backgroundColor: isCheapest ? '#00D9A5' : '#6B6B7B' }]} />
                <Text style={styles.mapListName} numberOfLines={1}>{station.name}</Text>
                <Text style={styles.mapListPrice}>{formatPrice(station.prices[selectedGrade])}</Text>
                <Text style={styles.mapListDistance}>{station.distance_miles} mi</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    );
  };

  const PriceModal = () => {
    if (!selectedStation) return null;
    
    return (
      <Modal
        visible={showPriceModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowPriceModal(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay} 
          activeOpacity={1} 
          onPress={() => setShowPriceModal(false)}
        >
          <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
            <View style={styles.modalHandle} />
            
            <View style={styles.modalHeader}>
              <View style={[styles.brandDotLarge, { backgroundColor: BRAND_COLORS[selectedStation.logo] || '#6B6B7B' }]} />
              <View style={styles.modalHeaderText}>
                <Text style={styles.modalTitle}>{selectedStation.name}</Text>
                <Text style={styles.modalSubtitle}>{selectedStation.address}</Text>
                <Text style={styles.modalDistance}>{selectedStation.distance_miles} miles away</Text>
              </View>
            </View>

            <Text style={styles.allPricesTitle}>All Fuel Grades</Text>
            
            <View style={styles.priceGrid}>
              {FUEL_GRADES.map((grade) => {
                const isSelected = selectedGrade === grade.key;
                const isCheapestGrade = summary?.base_prices && 
                  selectedStation.prices[grade.key] <= (summary.base_prices[grade.key] || 999);
                
                return (
                  <View key={grade.key} style={[
                    styles.priceGridItem,
                    isSelected && styles.priceGridItemSelected
                  ]}>
                    <View style={[styles.gradeIndicator, { backgroundColor: grade.color }]} />
                    <Text style={styles.gradeName}>{grade.label}</Text>
                    <Text style={styles.gradePrice}>
                      {formatPrice(selectedStation.prices[grade.key])}
                    </Text>
                    {isCheapestGrade && (
                      <View style={styles.belowAvgBadge}>
                        <Text style={styles.belowAvgText}>Below avg</Text>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>

            <View style={styles.amenitiesSection}>
              <Text style={styles.amenitiesTitle}>Amenities</Text>
              <View style={styles.amenitiesList}>
                {selectedStation.amenities.map((amenity, index) => (
                  <View key={index} style={styles.amenityChip}>
                    <Text style={styles.amenityText}>{amenity}</Text>
                  </View>
                ))}
              </View>
            </View>

            <View style={styles.updateInfo}>
              <Ionicons name="refresh" size={14} color="#6B6B7B" />
              <Text style={styles.updateText}>
                Updated {getTimeSinceUpdate(selectedStation.last_updated)}
              </Text>
              {summary?.data_source && (
                <Text style={styles.dataSourceText}> • {summary.data_source}</Text>
              )}
            </View>

            <TouchableOpacity 
              style={styles.directionsButton}
              onPress={() => {
                setShowPriceModal(false);
                openDirections(selectedStation);
              }}
            >
              <Ionicons name="navigate" size={20} color="#FFF" />
              <Text style={styles.directionsButtonText}>Get Directions</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Gas Finder</Text>
        <TouchableOpacity onPress={loadGasStations}>
          <Ionicons name="refresh" size={24} color="#FFF" />
        </TouchableOpacity>
      </View>

      {/* Savings Summary */}
      {summary && (
        <View style={styles.savingsSummary}>
          <View style={styles.savingsIcon}>
            <Ionicons name="flash" size={20} color="#FFB84D" />
          </View>
          <View style={styles.savingsInfo}>
            <Text style={styles.savingsTitle}>
              Save up to ${summary.potential_savings_per_fillup.toFixed(2)} per fill-up
            </Text>
            <Text style={styles.savingsSubtitle}>
              Cheapest: {formatPrice(summary.cheapest_premium)} • Avg: {formatPrice(summary.average_premium)}
            </Text>
          </View>
        </View>
      )}

      {/* Fuel Grade Selector */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.gradeSelector}>
        {FUEL_GRADES.map((grade) => (
          <TouchableOpacity
            key={grade.key}
            style={[
              styles.gradeButton,
              selectedGrade === grade.key && styles.gradeButtonActive,
              selectedGrade === grade.key && { borderColor: grade.color },
            ]}
            onPress={() => setSelectedGrade(grade.key)}
          >
            <View style={[styles.gradeDot, { backgroundColor: grade.color }]} />
            <Text style={[
              styles.gradeButtonText,
              selectedGrade === grade.key && styles.gradeButtonTextActive,
            ]}>
              {grade.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* View Toggle */}
      <View style={styles.viewToggle}>
        <TouchableOpacity
          style={[styles.toggleButton, viewMode === 'list' && styles.toggleButtonActive]}
          onPress={() => setViewMode('list')}
        >
          <Ionicons name="list" size={18} color={viewMode === 'list' ? '#FFF' : '#6B6B7B'} />
          <Text style={[styles.toggleText, viewMode === 'list' && styles.toggleTextActive]}>List</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toggleButton, viewMode === 'map' && styles.toggleButtonActive]}
          onPress={() => setViewMode('map')}
        >
          <Ionicons name="map" size={18} color={viewMode === 'map' ? '#FFF' : '#6B6B7B'} />
          <Text style={[styles.toggleText, viewMode === 'map' && styles.toggleTextActive]}>Map</Text>
        </TouchableOpacity>
        <Text style={styles.stationCount}>{stations.length} stations</Text>
      </View>

      {/* Content */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#00D9A5" />
          <Text style={styles.loadingText}>Finding gas stations near you...</Text>
        </View>
      ) : viewMode === 'list' ? (
        <FlatList
          data={stations}
          keyExtractor={(item) => item.id}
          renderItem={renderStationCard}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      ) : (
        renderMapView()
      )}

      <PriceModal />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0F' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16 },
  headerTitle: { color: '#FFF', fontSize: 18, fontWeight: '600' },
  savingsSummary: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFB84D15', marginHorizontal: 20, borderRadius: 12, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: '#FFB84D30' },
  savingsIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#FFB84D20', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  savingsInfo: { flex: 1 },
  savingsTitle: { color: '#FFB84D', fontSize: 15, fontWeight: '600' },
  savingsSubtitle: { color: '#6B6B7B', fontSize: 12, marginTop: 2 },
  gradeSelector: { paddingHorizontal: 20, marginBottom: 12, maxHeight: 44 },
  gradeButton: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, backgroundColor: '#14141A', marginRight: 10, borderWidth: 1, borderColor: 'transparent' },
  gradeButtonActive: { backgroundColor: '#1A1A24' },
  gradeDot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  gradeButtonText: { color: '#6B6B7B', fontSize: 13, fontWeight: '500' },
  gradeButtonTextActive: { color: '#FFF' },
  viewToggle: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, marginBottom: 12 },
  toggleButton: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, backgroundColor: '#14141A', marginRight: 10, gap: 6 },
  toggleButtonActive: { backgroundColor: '#7C6BFF' },
  toggleText: { color: '#6B6B7B', fontSize: 13, fontWeight: '500' },
  toggleTextActive: { color: '#FFF' },
  stationCount: { color: '#6B6B7B', fontSize: 13, marginLeft: 'auto' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: '#6B6B7B', marginTop: 12 },
  listContent: { padding: 20, paddingTop: 0 },
  stationCard: { backgroundColor: '#14141A', borderRadius: 16, padding: 16, marginBottom: 12 },
  stationCardCheapest: { borderWidth: 1, borderColor: '#FFB84D50' },
  cheapestBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, position: 'absolute', top: 12, right: 12, backgroundColor: '#FFB84D20', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, zIndex: 1 },
  cheapestBadgeText: { color: '#FFB84D', fontSize: 10, fontWeight: '700' },
  stationHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  stationInfo: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  brandDot: { width: 36, height: 36, borderRadius: 18, marginRight: 12 },
  stationName: { color: '#FFF', fontSize: 16, fontWeight: '600' },
  stationAddress: { color: '#6B6B7B', fontSize: 13, marginTop: 2, maxWidth: 180 },
  priceContainer: { alignItems: 'flex-end' },
  priceValue: { color: '#FFF', fontSize: 24, fontWeight: '700' },
  priceLabel: { color: '#6B6B7B', fontSize: 11, textTransform: 'capitalize' },
  stationDetails: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 12 },
  detailItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  detailText: { color: '#6B6B7B', fontSize: 12 },
  savingsBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#00D9A520', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  savingsText: { color: '#00D9A5', fontSize: 11, fontWeight: '600' },
  memberBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#FFB84D15', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, alignSelf: 'flex-start', marginBottom: 12 },
  memberText: { color: '#FFB84D', fontSize: 11 },
  cardActions: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: '#2A2A35', marginTop: 4, paddingTop: 12 },
  allPricesButton: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 4 },
  allPricesText: { color: '#7C6BFF', fontSize: 13, fontWeight: '500' },
  directionsSmallButton: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#00D9A520', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  directionsSmallText: { color: '#00D9A5', fontSize: 13, fontWeight: '500' },
  mapContainer: { flex: 1, margin: 20, marginTop: 0, borderRadius: 16, overflow: 'hidden' },
  map: { flex: 1 },
  mapMarker: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, flexDirection: 'row', alignItems: 'center' },
  mapMarkerText: { color: '#FFF', fontSize: 11, fontWeight: '700' },
  trophyIcon: { marginLeft: 4 },
  mapMarkerArrow: { width: 0, height: 0, borderLeftWidth: 6, borderRightWidth: 6, borderTopWidth: 8, borderLeftColor: 'transparent', borderRightColor: 'transparent', alignSelf: 'center' },
  mapLegend: { position: 'absolute', bottom: 16, left: 16, right: 16, flexDirection: 'row', justifyContent: 'center', gap: 16, backgroundColor: 'rgba(20,20,26,0.9)', padding: 10, borderRadius: 10 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { color: '#FFF', fontSize: 11 },
  mapUnavailable: { flex: 1, justifyContent: 'center', alignItems: 'center', margin: 20 },
  mapUnavailableText: { color: '#6B6B7B', fontSize: 16, marginTop: 12 },
  mapUnavailableSubtext: { color: '#4A4A5A', fontSize: 13, marginTop: 4 },
  mapStationList: { width: '100%', marginTop: 20, paddingHorizontal: 20 },
  mapListItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#14141A', padding: 12, borderRadius: 10, marginBottom: 8 },
  mapListDot: { width: 10, height: 10, borderRadius: 5, marginRight: 10 },
  mapListName: { flex: 1, color: '#FFF', fontSize: 14 },
  mapListPrice: { color: '#FFF', fontSize: 14, fontWeight: '700', marginRight: 10 },
  mapListDistance: { color: '#6B6B7B', fontSize: 12 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#14141A', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: SCREEN_HEIGHT * 0.75 },
  modalHandle: { width: 40, height: 4, backgroundColor: '#2A2A35', borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  brandDotLarge: { width: 48, height: 48, borderRadius: 24, marginRight: 14 },
  modalHeaderText: { flex: 1 },
  modalTitle: { color: '#FFF', fontSize: 20, fontWeight: '700' },
  modalSubtitle: { color: '#6B6B7B', fontSize: 14, marginTop: 2 },
  modalDistance: { color: '#00D9A5', fontSize: 13, marginTop: 4 },
  allPricesTitle: { color: '#FFF', fontSize: 16, fontWeight: '600', marginBottom: 12 },
  priceGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  priceGridItem: { width: (SCREEN_WIDTH - 70) / 2, backgroundColor: '#0A0A0F', borderRadius: 12, padding: 14, alignItems: 'center' },
  priceGridItemSelected: { borderWidth: 1, borderColor: '#7C6BFF' },
  gradeIndicator: { width: 8, height: 8, borderRadius: 4, marginBottom: 8 },
  gradeName: { color: '#6B6B7B', fontSize: 12, marginBottom: 4 },
  gradePrice: { color: '#FFF', fontSize: 22, fontWeight: '700' },
  belowAvgBadge: { backgroundColor: '#00D9A520', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, marginTop: 6 },
  belowAvgText: { color: '#00D9A5', fontSize: 10 },
  amenitiesSection: { marginBottom: 16 },
  amenitiesTitle: { color: '#6B6B7B', fontSize: 13, marginBottom: 8 },
  amenitiesList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  amenityChip: { backgroundColor: '#0A0A0F', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  amenityText: { color: '#FFF', fontSize: 12 },
  updateInfo: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  updateText: { color: '#6B6B7B', fontSize: 12, marginLeft: 6 },
  dataSourceText: { color: '#4A4A5A', fontSize: 11 },
  directionsButton: { backgroundColor: '#00D9A5', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16, borderRadius: 14, gap: 8 },
  directionsButtonText: { color: '#FFF', fontSize: 16, fontWeight: '600' },
});
