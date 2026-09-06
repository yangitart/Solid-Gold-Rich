import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AppPreferences } from '@/features/onboarding/application/ports/AppPreferences';

const ONBOARDING_KEY = '@solid-gold/onboarding-v1';

export const appPreferences: AppPreferences = {
  isOnboardingComplete: async () => (await AsyncStorage.getItem(ONBOARDING_KEY)) === 'complete',
  markOnboardingComplete: async () => { await AsyncStorage.setItem(ONBOARDING_KEY, 'complete'); },
};
