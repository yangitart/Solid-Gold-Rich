const {
  AndroidConfig,
  withAndroidManifest,
  withAndroidStyles,
  withAppBuildGradle,
  withGradleProperties,
} = require('expo/config-plugins');

// Keep release settings in prebuild's source of truth; EAS regenerates android/.
module.exports = function withAndroidReleaseOptimizations(config) {
  config = withAndroidStyles(config, (config) => {
    // Expo's legacy splash plugin injects its background as a status bar color.
    // The app draws this background itself and lets Android handle system bars.
    for (const style of config.modResults.resources.style ?? []) {
      if (style.$.name !== 'AppTheme') continue;
      style.item = (style.item ?? []).filter((item) =>
        !['android:statusBarColor', 'android:navigationBarColor'].includes(item.$.name),
      );
    }
    return config;
  });

  config = withGradleProperties(config, (config) => {
    const properties = {
      'android.enableMinifyInReleaseBuilds': 'true',
      'android.enableShrinkResourcesInReleaseBuilds': 'true',
      'android.enableR8.fullMode': 'true',
    };
    config.modResults = config.modResults.filter(
      (item) => item.type !== 'property' || !(item.key in properties),
    );
    for (const [key, value] of Object.entries(properties)) {
      config.modResults.push({ type: 'property', key, value });
    }
    return config;
  });

  config = withAppBuildGradle(config, (config) => {
    if (config.modResults.language !== 'groovy' ||
        !config.modResults.contents.includes("findProperty('android.enableMinifyInReleaseBuilds')")) {
      throw new Error('Android release settings require the Expo SDK 54 template. Regenerate Android with a clean prebuild.');
    }
    // The template's proguard-android.txt contains -dontoptimize.
    const defaultRules = /getDefaultProguardFile\((["'])proguard-android(?:-optimize)?\.txt\1\)/g;
    if (!defaultRules.test(config.modResults.contents)) {
      throw new Error('Cannot locate the Android default ProGuard rules. Review the release optimization plugin before building.');
    }
    config.modResults.contents = config.modResults.contents.replace(
      defaultRules,
      'getDefaultProguardFile("proguard-android-optimize.txt")',
    );
    return config;
  });

  return withAndroidManifest(config, (config) => {
    const activity = AndroidConfig.Manifest.getMainActivityOrThrow(config.modResults);
    activity.$['android:resizeableActivity'] = 'true';
    return config;
  });
};
