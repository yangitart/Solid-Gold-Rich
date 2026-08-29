export type AppPreferences = {
  isOnboardingComplete: () => Promise<boolean>;
  markOnboardingComplete: () => Promise<void>;
};
