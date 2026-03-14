import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  Alert,
  Switch,
  Image,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { format, parseISO } from 'date-fns';
import {
  useAutoTripDetection,
  getPendingTrips,
  classifyTrip,
  deleteTrip,
  PendingTrip,
  RoutePoint,
} from '../src/services/autoTripService';
import { api } from '../src/services/api';

const IRS_MILEAGE_RATE = 0.70;
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const MAP_WIDTH = SCREEN_WIDTH - 40;
const MAP_HEIGHT = 180;

// Generate a static map URL showing the route
const generateMapUrl = (route: RoutePoint[]): string => {
  if (route.length < 2) return '';
  
  // Sample points to keep URL length manageable (max ~50 points)
  const maxPoints = 50;
  const step = Math.max(1, Math.floor(route.length / maxPoints));
  const sampledPoints = route.filter((_, index) => index % step === 0);
  
  // Create path string
  const pathPoints = sampledPoints
    .map(p => `${p.latitude.toFixed(5)},${p.longitude.toFixed(5)}`)
    .join('|');
  
  // Get start and end markers
  const start = route[0];
  const end = route[route.length - 1];
  
  // Use OpenStreetMap static map (free, no API key needed)
  // Fallback to a simple visualization
  const centerLat = (start.latitude + end.latitude) / 2;
  const centerLng = (start.longitude + end.longitude) / 2;
  
  // Calculate zoom based on distance
  const latDiff = Math.abs(start.latitude - end.latitude);
  const lngDiff = Math.abs(start.longitude - end.longitude);
  const maxDiff = Math.max(latDiff, lngDiff);
  let zoom = 14;
  if (maxDiff > 0.1) zoom = 12;
  if (maxDiff > 0.3) zoom = 10;
  if (maxDiff > 0.5) zoom = 9;
  
  // Using staticmapmaker.com or geoapify (free tier)
  return `https://maps.geoapify.com/v1/staticmap?style=osm-bright&width=${MAP_WIDTH}&height=${MAP_HEIGHT}&center=lonlat:${centerLng},${centerLat}&zoom=${zoom}&marker=lonlat:${start.longitude},${start.latitude};color:%2300D9A5;size:medium|lonlat:${end.longitude},${end.latitude};color:%23FF6B6B;size:medium&apiKey=demo`;
};

// Simple route visualization component (fallback)
const SimpleRouteMap = ({ route, style }: { route: RoutePoint[]; style?: any }) => {
  if (route.length < 2) {
    return (
      <View style={[styles.mapPlaceholder, style]}>
        <Ionicons name="map-outline" size={40} color="#2A2A35" />
        <Text style={styles.mapPlaceholderText}>Route not available</Text>
      </View>
    );
  }

  const start = route[0];
  const end = route[route.length - 1];
  
  // Calculate bounds
  const lats = route.map(p => p.latitude);
  const lngs = route.map(p => p.longitude);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  
  // Normalize points to view bounds
  const padding = 20;
  const viewWidth = MAP_WIDTH - padding * 2;
  const viewHeight = MAP_HEIGHT - padding * 2;
  
  const latRange = maxLat - minLat || 0.001;
  const lngRange = maxLng - minLng || 0.001;
  
  const normalizePoint = (p: RoutePoint) => ({
    x: padding + ((p.longitude - minLng) / lngRange) * viewWidth,
    y: padding + viewHeight - ((p.latitude - minLat) / latRange) * viewHeight,
  });

  // Sample points for smoother rendering
  const step = Math.max(1, Math.floor(route.length / 100));
  const sampledRoute = route.filter((_, i) => i % step === 0 || i === route.length - 1);
  const normalizedPoints = sampledRoute.map(normalizePoint);
  
  // Create SVG path
  const pathD = normalizedPoints
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
    .join(' ');

  const startNorm = normalizePoint(start);
  const endNorm = normalizePoint(end);

  return (
    <View style={[styles.mapContainer, style]}>
      <View style={styles.mapBackground}>
        {/* Simple SVG-like route using View positioning */}
        {normalizedPoints.map((point, index) => {
          if (index === 0) return null;
          const prev = normalizedPoints[index - 1];
          const dx = point.x - prev.x;
          const dy = point.y - prev.y;
          const length = Math.sqrt(dx * dx + dy * dy);
          const angle = Math.atan2(dy, dx) * (180 / Math.PI);
          
          return (
            <View
              key={index}
              style={[
                styles.routeLine,
                {
                  left: prev.x,
                  top: prev.y,
                  width: length,
                  transform: [{ rotate: `${angle}deg` }],
                },
              ]}
            />
          );
        })}
        
        {/* Start marker */}
        <View style={[styles.mapMarker, styles.startMarker, { left: startNorm.x - 8, top: startNorm.y - 8 }]}>
          <Ionicons name="radio-button-on" size={16} color="#00D9A5" />
        </View>
        
        {/* End marker */}
        <View style={[styles.mapMarker, styles.endMarker, { left: endNorm.x - 8, top: endNorm.y - 8 }]}>
          <Ionicons name="location" size={16} color="#FF6B6B" />
        </View>
      </View>
      
      {/* Legend */}
      <View style={styles.mapLegend}>
        <View style={styles.legendItem}>
          <Ionicons name="radio-button-on" size={12} color="#00D9A5" />
          <Text style={styles.legendText}>Start</Text>
        </View>
        <View style={styles.legendItem}>
          <Ionicons name="location" size={12} color="#FF6B6B" />
          <Text style={styles.legendText}>End</Text>
        </View>
      </View>
    </View>
  );
};

export default function AutoTripTrackerScreen() {
  const router = useRouter();
  const { isEnabled, isTracking, currentTrip, startAutoDetection, stopAutoDetection } = useAutoTripDetection();
  const [pendingTrips, setPendingTrips] = useState<PendingTrip[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedTrip, setExpandedTrip] = useState<string | null>(null);

  const loadTrips = useCallback(async () => {
    const trips = await getPendingTrips();
    setPendingTrips(trips);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadTrips();
    }, [loadTrips])
  );

  const handleToggleAutoDetect = async (value: boolean) => {
    if (value) {
      const success = await startAutoDetection();
      if (!success) {
        Alert.alert('Error', 'Could not enable auto-tracking. Please check location permissions.');
      }
    } else {
      await stopAutoDetection();
    }
  };

  const handleClassify = async (tripId: string, purpose: 'Business' | 'Personal') => {
    const success = await classifyTrip(tripId, purpose);
    if (success) {
      // Save to backend
      const trip = pendingTrips.find(t => t.id === tripId);
      if (trip) {
        try {
          await api.createMileage({
            start_location: trip.startLocation,
            end_location: trip.endLocation,
            distance: trip.distance,
            purpose: purpose,
            date: format(parseISO(trip.startTime), 'yyyy-MM-dd'),
            notes: `Auto-tracked trip - ${formatDuration(trip.duration)} duration, ${trip.avgSpeed.toFixed(0)} mph avg`,
          });
        } catch (error) {
          console.error('Error saving to backend:', error);
        }
      }
      loadTrips();
    }
  };

  const handleDelete = (tripId: string) => {
    Alert.alert(
      'Delete Trip',
      'Are you sure you want to delete this trip?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteTrip(tripId);
            loadTrips();
          },
        },
      ]
    );
  };

  const formatDuration = (seconds: number): string => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (hrs > 0) {
      return `${hrs}h ${mins}m`;
    }
    return `${mins} min`;
  };

  const formatTime = (isoString: string): string => {
    try {
      return format(parseISO(isoString), 'h:mm a');
    } catch {
      return '';
    }
  };

  const formatDate = (isoString: string): string => {
    try {
      return format(parseISO(isoString), 'MMM d, yyyy');
    } catch {
      return '';
    }
  };

  const unclassifiedTrips = pendingTrips.filter(t => !t.classified);
  const classifiedTrips = pendingTrips.filter(t => t.classified);

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Auto Trip Tracker</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadTrips(); }} tintColor="#00D9A5" />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Auto-Detection Toggle */}
        <View style={styles.toggleCard}>
          <View style={styles.toggleInfo}>
            <View style={styles.toggleIconContainer}>
              <Ionicons name="car" size={24} color="#00D9A5" />
            </View>
            <View style={styles.toggleText}>
              <Text style={styles.toggleTitle}>Auto-Detect Trips</Text>
              <Text style={styles.toggleDescription}>
                Automatically track trips when driving
              </Text>
            </View>
          </View>
          <Switch
            value={isEnabled}
            onValueChange={handleToggleAutoDetect}
            trackColor={{ false: '#2A2A35', true: '#00D9A550' }}
            thumbColor={isEnabled ? '#00D9A5' : '#6B6B7B'}
          />
        </View>

        {/* Current Trip Indicator */}
        {isTracking && currentTrip && (
          <View style={styles.currentTripCard}>
            <View style={styles.currentTripHeader}>
              <View style={styles.liveIndicator}>
                <View style={styles.liveDot} />
                <Text style={styles.liveText}>TRACKING</Text>
              </View>
            </View>
            <View style={styles.currentTripStats}>
              <View style={styles.currentTripStat}>
                <Text style={styles.currentTripValue}>{currentTrip.distance?.toFixed(2) || '0.00'}</Text>
                <Text style={styles.currentTripLabel}>miles</Text>
              </View>
              <View style={styles.currentTripStat}>
                <Text style={styles.currentTripValue}>
                  {currentTrip.startLocation?.split(',')[0] || 'Starting...'}
                </Text>
                <Text style={styles.currentTripLabel}>from</Text>
              </View>
            </View>
          </View>
        )}

        {/* Unclassified Trips */}
        {unclassifiedTrips.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>
              Needs Classification ({unclassifiedTrips.length})
            </Text>
            {unclassifiedTrips.map((trip) => (
              <TripCard
                key={trip.id}
                trip={trip}
                expanded={expandedTrip === trip.id}
                onToggleExpand={() => setExpandedTrip(expandedTrip === trip.id ? null : trip.id)}
                onClassify={handleClassify}
                onDelete={handleDelete}
                formatDuration={formatDuration}
                formatTime={formatTime}
                formatDate={formatDate}
              />
            ))}
          </>
        )}

        {/* Recent Trips */}
        {classifiedTrips.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Recent Trips</Text>
            {classifiedTrips.slice(0, 10).map((trip) => (
              <TripCard
                key={trip.id}
                trip={trip}
                expanded={expandedTrip === trip.id}
                onToggleExpand={() => setExpandedTrip(expandedTrip === trip.id ? null : trip.id)}
                onClassify={handleClassify}
                onDelete={handleDelete}
                formatDuration={formatDuration}
                formatTime={formatTime}
                formatDate={formatDate}
              />
            ))}
          </>
        )}

        {/* Empty State */}
        {!loading && pendingTrips.length === 0 && !isTracking && (
          <View style={styles.emptyState}>
            <Ionicons name="navigate-outline" size={64} color="#2A2A35" />
            <Text style={styles.emptyTitle}>No trips detected yet</Text>
            <Text style={styles.emptySubtitle}>
              {isEnabled
                ? 'Start driving and your trips will be automatically recorded'
                : 'Enable auto-detection to start tracking your trips'}
            </Text>
          </View>
        )}

        {/* How it works */}
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>How Auto-Detection Works</Text>
          <View style={styles.infoItem}>
            <Ionicons name="speedometer" size={16} color="#6B6B7B" />
            <Text style={styles.infoText}>Trip starts when speed exceeds 5 mph</Text>
          </View>
          <View style={styles.infoItem}>
            <Ionicons name="time" size={16} color="#6B6B7B" />
            <Text style={styles.infoText}>Trip ends after 2 minutes of no movement</Text>
          </View>
          <View style={styles.infoItem}>
            <Ionicons name="location" size={16} color="#6B6B7B" />
            <Text style={styles.infoText}>Route and distance tracked via GPS</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// Trip Card Component
interface TripCardProps {
  trip: PendingTrip;
  expanded: boolean;
  onToggleExpand: () => void;
  onClassify: (tripId: string, purpose: 'Business' | 'Personal') => void;
  onDelete: (tripId: string) => void;
  formatDuration: (seconds: number) => string;
  formatTime: (isoString: string) => string;
  formatDate: (isoString: string) => string;
}

const TripCard = ({
  trip,
  expanded,
  onToggleExpand,
  onClassify,
  onDelete,
  formatDuration,
  formatTime,
  formatDate,
}: TripCardProps) => {
  const deduction = trip.purpose === 'Business' ? trip.distance * IRS_MILEAGE_RATE : 0;

  return (
    <TouchableOpacity
      style={styles.tripCard}
      onPress={onToggleExpand}
      onLongPress={() => onDelete(trip.id)}
      activeOpacity={0.8}
    >
      {/* Trip Header */}
      <View style={styles.tripHeader}>
        <View style={styles.tripDateContainer}>
          <Text style={styles.tripDate}>{formatDate(trip.startTime)}</Text>
          <Text style={styles.tripTime}>
            {formatTime(trip.startTime)} - {formatTime(trip.endTime)}
          </Text>
        </View>
        {trip.classified ? (
          <View style={[
            styles.purposeBadge,
            { backgroundColor: trip.purpose === 'Business' ? '#00D9A520' : '#6B6B7B20' }
          ]}>
            <Text style={[
              styles.purposeBadgeText,
              { color: trip.purpose === 'Business' ? '#00D9A5' : '#6B6B7B' }
            ]}>
              {trip.purpose}
            </Text>
          </View>
        ) : (
          <View style={styles.needsClassifyBadge}>
            <Ionicons name="help-circle" size={14} color="#FFB84D" />
            <Text style={styles.needsClassifyText}>Classify</Text>
          </View>
        )}
      </View>

      {/* Trip Stats */}
      <View style={styles.tripStats}>
        <View style={styles.tripStat}>
          <Text style={styles.tripStatValue}>{trip.distance.toFixed(2)}</Text>
          <Text style={styles.tripStatLabel}>miles</Text>
        </View>
        <View style={styles.tripStatDivider} />
        <View style={styles.tripStat}>
          <Text style={styles.tripStatValue}>{formatDuration(trip.duration)}</Text>
          <Text style={styles.tripStatLabel}>duration</Text>
        </View>
        <View style={styles.tripStatDivider} />
        <View style={styles.tripStat}>
          <Text style={styles.tripStatValue}>{trip.avgSpeed.toFixed(0)}</Text>
          <Text style={styles.tripStatLabel}>avg mph</Text>
        </View>
        {trip.classified && trip.purpose === 'Business' && (
          <>
            <View style={styles.tripStatDivider} />
            <View style={styles.tripStat}>
              <Text style={[styles.tripStatValue, { color: '#00D9A5' }]}>${deduction.toFixed(2)}</Text>
              <Text style={styles.tripStatLabel}>deduction</Text>
            </View>
          </>
        )}
      </View>

      {/* Route */}
      <View style={styles.tripRoute}>
        <View style={styles.routePoint}>
          <Ionicons name="radio-button-on" size={12} color="#00D9A5" />
          <Text style={styles.routeText} numberOfLines={1}>{trip.startLocation}</Text>
        </View>
        <View style={styles.routeLineSmall} />
        <View style={styles.routePoint}>
          <Ionicons name="location" size={12} color="#FF6B6B" />
          <Text style={styles.routeText} numberOfLines={1}>{trip.endLocation}</Text>
        </View>
      </View>

      {/* Expanded Content */}
      {expanded && (
        <View style={styles.expandedContent}>
          {/* Map */}
          <SimpleRouteMap route={trip.route} style={styles.tripMap} />
          
          {/* Additional Stats */}
          <View style={styles.additionalStats}>
            <View style={styles.additionalStat}>
              <Ionicons name="speedometer" size={16} color="#6B6B7B" />
              <Text style={styles.additionalStatText}>Max: {trip.maxSpeed.toFixed(0)} mph</Text>
            </View>
            <View style={styles.additionalStat}>
              <Ionicons name="navigate" size={16} color="#6B6B7B" />
              <Text style={styles.additionalStatText}>{trip.route.length} GPS points</Text>
            </View>
          </View>

          {/* Classification Buttons */}
          {!trip.classified && (
            <View style={styles.classifyButtons}>
              <TouchableOpacity
                style={styles.businessButton}
                onPress={() => onClassify(trip.id, 'Business')}
              >
                <Ionicons name="briefcase" size={18} color="#FFF" />
                <Text style={styles.classifyButtonText}>Business</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.personalButton}
                onPress={() => onClassify(trip.id, 'Personal')}
              >
                <Ionicons name="car" size={18} color="#FFF" />
                <Text style={styles.classifyButtonText}>Personal</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}

      {/* Expand indicator */}
      <View style={styles.expandIndicator}>
        <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={20} color="#6B6B7B" />
      </View>
    </TouchableOpacity>
  );
};

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
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  toggleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#14141A',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
  },
  toggleInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  toggleIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#00D9A520',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  toggleText: {
    flex: 1,
  },
  toggleTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  toggleDescription: {
    color: '#6B6B7B',
    fontSize: 13,
    marginTop: 2,
  },
  currentTripCard: {
    backgroundColor: '#00D9A515',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#00D9A530',
  },
  currentTripHeader: {
    marginBottom: 12,
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#00D9A5',
  },
  liveText: {
    color: '#00D9A5',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
  },
  currentTripStats: {
    flexDirection: 'row',
    gap: 24,
  },
  currentTripStat: {
    alignItems: 'flex-start',
  },
  currentTripValue: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '700',
  },
  currentTripLabel: {
    color: '#6B6B7B',
    fontSize: 12,
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    marginTop: 8,
  },
  tripCard: {
    backgroundColor: '#14141A',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  tripHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  tripDateContainer: {},
  tripDate: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  tripTime: {
    color: '#6B6B7B',
    fontSize: 12,
    marginTop: 2,
  },
  purposeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  purposeBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  needsClassifyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFB84D20',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  needsClassifyText: {
    color: '#FFB84D',
    fontSize: 12,
    fontWeight: '600',
  },
  tripStats: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  tripStat: {
    alignItems: 'center',
    flex: 1,
  },
  tripStatValue: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  tripStatLabel: {
    color: '#6B6B7B',
    fontSize: 11,
    marginTop: 2,
  },
  tripStatDivider: {
    width: 1,
    height: 30,
    backgroundColor: '#2A2A35',
  },
  tripRoute: {
    backgroundColor: '#0A0A0F',
    borderRadius: 10,
    padding: 12,
  },
  routePoint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  routeLineSmall: {
    width: 1,
    height: 12,
    backgroundColor: '#2A2A35',
    marginLeft: 5,
    marginVertical: 4,
  },
  routeText: {
    color: '#FFFFFF',
    fontSize: 13,
    flex: 1,
  },
  expandedContent: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#2A2A35',
  },
  tripMap: {
    marginBottom: 16,
  },
  additionalStats: {
    flexDirection: 'row',
    gap: 20,
    marginBottom: 16,
  },
  additionalStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  additionalStatText: {
    color: '#6B6B7B',
    fontSize: 13,
  },
  classifyButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  businessButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#00D9A5',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  personalButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#6B6B7B',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  classifyButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  expandIndicator: {
    alignItems: 'center',
    marginTop: 8,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
  },
  emptySubtitle: {
    color: '#6B6B7B',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 20,
  },
  infoCard: {
    backgroundColor: '#14141A',
    borderRadius: 16,
    padding: 16,
    marginTop: 20,
  },
  infoTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  infoText: {
    color: '#6B6B7B',
    fontSize: 13,
  },
  mapContainer: {
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#1A1A22',
  },
  mapBackground: {
    width: MAP_WIDTH - 40,
    height: MAP_HEIGHT,
    position: 'relative',
  },
  mapPlaceholder: {
    width: MAP_WIDTH - 40,
    height: MAP_HEIGHT,
    backgroundColor: '#1A1A22',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mapPlaceholderText: {
    color: '#6B6B7B',
    fontSize: 12,
    marginTop: 8,
  },
  routeLine: {
    position: 'absolute',
    height: 3,
    backgroundColor: '#7C6BFF',
    transformOrigin: 'left center',
    borderRadius: 1.5,
  },
  mapMarker: {
    position: 'absolute',
    width: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  startMarker: {},
  endMarker: {},
  mapLegend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    paddingVertical: 8,
    backgroundColor: '#14141A',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendText: {
    color: '#6B6B7B',
    fontSize: 11,
  },
});
