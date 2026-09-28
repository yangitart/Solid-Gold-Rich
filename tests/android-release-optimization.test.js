import { test, expect } from 'vitest';
import withAndroidReleaseOptimization from '../plugins/withAndroidReleaseOptimization';

async function runMod(name, modResults) {
  const config = withAndroidReleaseOptimization({ name: 'Release test', slug: 'release-test' });
  const result = await config.mods.android[name]({ ...config, modResults, modRequest: {} });
  return result.modResults;
}

test('release settings replace conflicting values without duplicating or losing unrelated properties', async () => {
  const preserved = [
    { type: 'comment', value: 'Existing project settings' },
    { type: 'property', key: 'hermesEnabled', value: 'true' },
    { type: 'property', key: 'edgeToEdgeEnabled', value: 'true' },
  ];
  const result = await runMod('gradleProperties', [
    ...preserved,
    { type: 'property', key: 'android.enableProguardInReleaseBuilds', value: 'false' },
    { type: 'property', key: 'android.enableProguardInReleaseBuilds', value: 'true' },
    { type: 'property', key: 'android.enableMinifyInReleaseBuilds', value: 'false' },
    { type: 'property', key: 'android.enableShrinkResourcesInReleaseBuilds', value: 'false' },
    { type: 'property', key: 'android.r8.fullMode', value: 'false' },
  ]);
  expect(result.slice(0, preserved.length)).toEqual(preserved);
  expect(result.slice(preserved.length)).toEqual([
    { type: 'property', key: 'android.enableProguardInReleaseBuilds', value: 'true' },
    { type: 'property', key: 'android.enableMinifyInReleaseBuilds', value: 'true' },
    { type: 'property', key: 'android.enableShrinkResourcesInReleaseBuilds', value: 'true' },
    { type: 'property', key: 'android.r8.fullMode', value: 'true' },
  ]);
  expect(await runMod('gradleProperties', result)).toEqual(result);
});

test.each(['"', "'"])(
  'the optimizing preset preserves release configuration and custom rules (%s quotes)',
  async (quote) => {
    const contents = `android {
    buildTypes {
        debug { debuggable true }
        release {
            minifyEnabled enableProguardInReleaseBuilds
            shrinkResources (findProperty('android.enableShrinkResourcesInReleaseBuilds')?.toBoolean() ?: false)
            proguardFiles getDefaultProguardFile(${quote}proguard-android.txt${quote}), "proguard-rules.pro"
        }
    }
}`;
    const result = await runMod('appBuildGradle', { language: 'groovy', contents });
    expect(result.contents).toBe(
      contents.replace('proguard-android.txt', 'proguard-android-optimize.txt'),
    );
    expect(await runMod('appBuildGradle', result)).toEqual(result);
  },
);

test('an unrecognized template fails visibly instead of silently skipping optimization', async () => {
  await expect(
    runMod('appBuildGradle', { language: 'groovy', contents: 'android { buildTypes {} }' }),
  ).rejects.toThrow('default ProGuard preset was not found');
});
