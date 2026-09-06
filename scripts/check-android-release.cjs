const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { AndroidConfig } = require('expo/config-plugins');

// Run after Expo prebuild. An optional argument selects an isolated native build.
async function main() {
  const android = path.resolve(process.argv[2] ?? 'android');
  const read = (file) => fs.readFileSync(path.join(android, file), 'utf8');
  const properties = read('gradle.properties');
  for (const key of [
    'android.enableMinifyInReleaseBuilds',
    'android.enableShrinkResourcesInReleaseBuilds',
    'android.enableR8.fullMode',
    'edgeToEdgeEnabled',
  ]) {
    const values = properties.split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.startsWith(`${key}=`));
    assert.deepEqual(values, [`${key}=true`], `${key} must be enabled exactly once`);
  }
  const gradle = read('app/build.gradle');
  assert.match(gradle, /minifyEnabled\s+enableMinifyInReleaseBuilds/);
  assert.match(gradle, /findProperty\('android.enableMinifyInReleaseBuilds'\)/);
  assert.match(gradle, /def enableShrinkResources = findProperty\('android.enableShrinkResourcesInReleaseBuilds'\)/);
  assert.match(gradle, /shrinkResources enableShrinkResources\.toBoolean\(\)/);
  assert.match(gradle, /getDefaultProguardFile\(["']proguard-android-optimize\.txt["']\)/);
  assert.doesNotMatch(gradle, /["']proguard-android\.txt["']/);
  assert.doesNotMatch(read('app/proguard-rules.pro'), /^\s*-(dontobfuscate|dontoptimize|dontshrink)\b/m);

  const manifest = await AndroidConfig.Manifest.readAndroidManifestAsync(
    path.join(android, 'app/src/main/AndroidManifest.xml'),
  );
  const activity = AndroidConfig.Manifest.getMainActivityOrThrow(manifest);
  assert.equal(activity.$['android:resizeableActivity'], 'true');
  assert.ok([undefined, 'unspecified', 'fullUser', 'fullSensor'].includes(activity.$['android:screenOrientation']));
  assert.doesNotMatch(read('app/src/main/AndroidManifest.xml'), /android:(?:min|max)AspectRatio=|PROPERTY_COMPAT_ALLOW_RESTRICTED_RESIZABILITY/);
  assert.doesNotMatch(read('app/src/main/res/values/styles.xml'), /name="android:(?:statusBarColor|navigationBarColor|windowOptOutEdgeToEdgeEnforcement)"/);
  console.log('Android release config passed: R8, resource shrinking, edge-to-edge and unrestricted resizing.');
  console.log('Play Console must still evaluate the new AAB; these checks do not measure its optimization percentage or dependency API calls.');
}

main().catch((error) => {
  console.error(`Android release config failed: ${error.message}`);
  console.error('Run a clean Expo prebuild with the current app config before checking the release.');
  process.exitCode = 1;
});
