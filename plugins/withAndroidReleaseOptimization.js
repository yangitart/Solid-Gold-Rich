const { withAppBuildGradle, withGradleProperties } = require('expo/config-plugins');

// Older SDK 54 templates read the Proguard key; refreshed templates read Minify.
const RELEASE_PROPERTIES = {
  'android.enableProguardInReleaseBuilds': 'true',
  'android.enableMinifyInReleaseBuilds': 'true',
  'android.enableShrinkResourcesInReleaseBuilds': 'true',
  'android.r8.fullMode': 'true',
};

/** Enable R8 during Expo prebuild without editing the generated Android project. */
module.exports = function withAndroidReleaseOptimization(config) {
  config = withGradleProperties(config, (mod) => {
    mod.modResults = mod.modResults.filter(
      (entry) => entry.type !== 'property' || !Object.hasOwn(RELEASE_PROPERTIES, entry.key),
    );
    for (const [key, value] of Object.entries(RELEASE_PROPERTIES)) {
      mod.modResults.push({ type: 'property', key, value });
    }
    return mod;
  });

  return withAppBuildGradle(config, (mod) => {
    // The SDK 54 preset includes -dontoptimize. Use the optimizing preset while
    // preserving the app and library keep rules needed by native modules / JNI.
    const defaultPreset =
      /getDefaultProguardFile\(\s*(['"])proguard-android(?:-optimize)?\.txt\1\s*\)/g;
    if (!defaultPreset.test(mod.modResults.contents)) {
      throw new Error(
        'Cannot configure Android release optimization: the default ProGuard preset was not found. Review withAndroidReleaseOptimization after changing the Expo template.',
      );
    }
    mod.modResults.contents = mod.modResults.contents.replace(
      defaultPreset,
      (_, quote) => `getDefaultProguardFile(${quote}proguard-android-optimize.txt${quote})`,
    );
    return mod;
  });
};
