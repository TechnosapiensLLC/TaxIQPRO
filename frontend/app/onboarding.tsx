import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../src/context/AuthContext';

const { width } = Dimensions.get('window');

const PROFESSIONS = [
  { id: 'rideshare', name: 'Rideshare Driver', icon: 'car', description: 'Uber, Lyft, etc.' },
  { id: 'delivery', name: 'Delivery Driver', icon: 'bicycle', description: 'DoorDash, Instacart, etc.' },
  { id: 'freelancer', name: 'Freelancer', icon: 'laptop', description: 'Upwork, Fiverr, etc.' },
  { id: 'consultant', name: 'Consultant', icon: 'briefcase', description: 'Business consulting' },
  { id: 'realtor', name: 'Real Estate Agent', icon: 'home', description: 'Property sales' },
  { id: 'photographer', name: 'Photographer', icon: 'camera', description: 'Photo & video' },
  { id: 'creator', name: 'Content Creator', icon: 'videocam', description: 'YouTube, TikTok, etc.' },
  { id: 'contractor', name: 'Contractor', icon: 'construct', description: 'Construction & repair' },
  { id: 'tutor', name: 'Tutor / Teacher', icon: 'school', description: 'Education services' },
  { id: 'healthcare', name: 'Healthcare Worker', icon: 'medical', description: 'Nursing, therapy, etc.' },
  { id: 'personal_trainer', name: 'Personal Trainer', icon: 'fitness', description: 'Fitness coaching' },
  { id: 'other', name: 'Other', icon: 'ellipsis-horizontal', description: 'Not listed above' },
];

const GIG_PLATFORMS = [
  { id: 'uber', name: 'Uber', icon: 'car' },
  { id: 'lyft', name: 'Lyft', icon: 'car' },
  { id: 'doordash', name: 'DoorDash', icon: 'fast-food' },
  { id: 'instacart', name: 'Instacart', icon: 'cart' },
  { id: 'ubereats', name: 'Uber Eats', icon: 'restaurant' },
  { id: 'grubhub', name: 'Grubhub', icon: 'fast-food' },
  { id: 'amazon_flex', name: 'Amazon Flex', icon: 'cube' },
  { id: 'upwork', name: 'Upwork', icon: 'briefcase' },
  { id: 'fiverr', name: 'Fiverr', icon: 'briefcase' },
  { id: 'taskrabbit', name: 'TaskRabbit', icon: 'construct' },
  { id: 'airbnb', name: 'Airbnb', icon: 'home' },
  { id: 'turo', name: 'Turo', icon: 'car-sport' },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const { updateUser } = useAuth();
  const [step, setStep] = useState(1);
  const [selectedProfession, setSelectedProfession] = useState('');
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);

  const togglePlatform = (platformId: string) => {
    setSelectedPlatforms((prev) =>
      prev.includes(platformId)
        ? prev.filter((id) => id !== platformId)
        : [...prev, platformId]
    );
  };

  const handleComplete = async () => {
    await updateUser({
      profession: selectedProfession,
      gig_types: selectedPlatforms,
      onboarded: true,
    });
    router.replace('/(tabs)');
  };

  const handleSkip = async () => {
    await updateUser({ onboarded: true });
    router.replace('/(tabs)');
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Progress Bar */}
      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${(step / 2) * 100}%` }]} />
        </View>
        <TouchableOpacity onPress={handleSkip}>
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>
      </View>

      {step === 1 && (
        <View style={styles.stepContainer}>
          <View style={styles.stepHeader}>
            <Text style={styles.stepTitle}>What do you do?</Text>
            <Text style={styles.stepSubtitle}>
              We'll customize your deduction categories based on your profession
            </Text>
          </View>

          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.optionsGrid}
            showsVerticalScrollIndicator={false}
          >
            {PROFESSIONS.map((profession) => (
              <TouchableOpacity
                key={profession.id}
                style={[
                  styles.professionCard,
                  selectedProfession === profession.id && styles.professionCardSelected,
                ]}
                onPress={() => setSelectedProfession(profession.id)}
              >
                <View
                  style={[
                    styles.professionIcon,
                    selectedProfession === profession.id && styles.professionIconSelected,
                  ]}
                >
                  <Ionicons
                    name={profession.icon as any}
                    size={24}
                    color={selectedProfession === profession.id ? '#00D9A5' : '#6B6B7B'}
                  />
                </View>
                <Text
                  style={[
                    styles.professionName,
                    selectedProfession === profession.id && styles.professionNameSelected,
                  ]}
                >
                  {profession.name}
                </Text>
                <Text style={styles.professionDescription}>{profession.description}</Text>
                {selectedProfession === profession.id && (
                  <View style={styles.checkmark}>
                    <Ionicons name="checkmark-circle" size={24} color="#00D9A5" />
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>

          <TouchableOpacity
            style={[
              styles.continueButton,
              !selectedProfession && styles.continueButtonDisabled,
            ]}
            onPress={() => setStep(2)}
            disabled={!selectedProfession}
          >
            <Text style={styles.continueButtonText}>Continue</Text>
            <Ionicons name="arrow-forward" size={20} color="#FFF" />
          </TouchableOpacity>
        </View>
      )}

      {step === 2 && (
        <View style={styles.stepContainer}>
          <View style={styles.stepHeader}>
            <Text style={styles.stepTitle}>Connect your platforms</Text>
            <Text style={styles.stepSubtitle}>
              Select the gig platforms you use to auto-import income and track earnings
            </Text>
          </View>

          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.platformsGrid}
            showsVerticalScrollIndicator={false}
          >
            {GIG_PLATFORMS.map((platform) => (
              <TouchableOpacity
                key={platform.id}
                style={[
                  styles.platformCard,
                  selectedPlatforms.includes(platform.id) && styles.platformCardSelected,
                ]}
                onPress={() => togglePlatform(platform.id)}
              >
                <Ionicons
                  name={platform.icon as any}
                  size={22}
                  color={selectedPlatforms.includes(platform.id) ? '#00D9A5' : '#6B6B7B'}
                />
                <Text
                  style={[
                    styles.platformName,
                    selectedPlatforms.includes(platform.id) && styles.platformNameSelected,
                  ]}
                >
                  {platform.name}
                </Text>
                {selectedPlatforms.includes(platform.id) && (
                  <View style={styles.platformCheck}>
                    <Ionicons name="checkmark" size={14} color="#00D9A5" />
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>

          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => setStep(1)}
            >
              <Ionicons name="arrow-back" size={20} color="#FFF" />
              <Text style={styles.backButtonText}>Back</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.finishButton}
              onPress={handleComplete}
            >
              <Text style={styles.finishButtonText}>Get Started</Text>
              <Ionicons name="checkmark" size={20} color="#FFF" />
            </TouchableOpacity>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0F',
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 16,
  },
  progressBar: {
    flex: 1,
    height: 4,
    backgroundColor: '#1A1A22',
    borderRadius: 2,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#00D9A5',
    borderRadius: 2,
  },
  skipText: {
    color: '#6B6B7B',
    fontSize: 14,
  },
  stepContainer: {
    flex: 1,
    paddingHorizontal: 20,
  },
  stepHeader: {
    marginBottom: 24,
  },
  stepTitle: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 8,
  },
  stepSubtitle: {
    color: '#6B6B7B',
    fontSize: 15,
    lineHeight: 22,
  },
  scrollView: {
    flex: 1,
  },
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    paddingBottom: 20,
  },
  professionCard: {
    width: (width - 52) / 2,
    backgroundColor: '#14141A',
    borderRadius: 16,
    padding: 16,
    borderWidth: 2,
    borderColor: 'transparent',
    position: 'relative',
  },
  professionCardSelected: {
    borderColor: '#00D9A5',
    backgroundColor: '#0A1A15',
  },
  professionIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#1A1A22',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  professionIconSelected: {
    backgroundColor: '#00D9A520',
  },
  professionName: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  professionNameSelected: {
    color: '#00D9A5',
  },
  professionDescription: {
    color: '#6B6B7B',
    fontSize: 12,
  },
  checkmark: {
    position: 'absolute',
    top: 12,
    right: 12,
  },
  platformsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingBottom: 20,
  },
  platformCard: {
    width: (width - 60) / 3,
    backgroundColor: '#14141A',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
    position: 'relative',
  },
  platformCardSelected: {
    borderColor: '#00D9A5',
    backgroundColor: '#0A1A15',
  },
  platformName: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '500',
    marginTop: 8,
    textAlign: 'center',
  },
  platformNameSelected: {
    color: '#00D9A5',
  },
  platformCheck: {
    position: 'absolute',
    top: 6,
    right: 6,
  },
  continueButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#00D9A5',
    paddingVertical: 16,
    borderRadius: 14,
    marginBottom: 20,
    gap: 8,
  },
  continueButtonDisabled: {
    opacity: 0.5,
  },
  continueButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  backButton: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#2A2A35',
    paddingVertical: 16,
    borderRadius: 14,
    gap: 8,
  },
  backButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  finishButton: {
    flex: 2,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#00D9A5',
    paddingVertical: 16,
    borderRadius: 14,
    gap: 8,
  },
  finishButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
