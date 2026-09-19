/**
 * Expo Config Plugin — Android UsageStats Permission
 *
 * Automatically injects the PACKAGE_USAGE_STATS permission into
 * AndroidManifest.xml during `npx expo prebuild`.
 *
 * This permission is required to read per-app screen time via
 * UsageStatsManager. It is a "special" AppOps permission — declaring
 * it in the manifest is not enough; the user must also grant it
 * manually via Settings → Apps → Special App Access → Usage Access.
 * Our native module handles directing the user there.
 */
const { withAndroidManifest } = require('@expo/config-plugins');

module.exports = function withUsageStatsPermission(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;

    if (!manifest['uses-permission']) {
      manifest['uses-permission'] = [];
    }

    const alreadyAdded = manifest['uses-permission'].some(
      (p) => p.$?.['android:name'] === 'android.permission.PACKAGE_USAGE_STATS',
    );

    if (!alreadyAdded) {
      manifest['uses-permission'].push({
        $: {
          'android:name': 'android.permission.PACKAGE_USAGE_STATS',
          'tools:ignore': 'ProtectedPermissions',
        },
      });
    }

    // Ensure the tools namespace is declared on the root manifest element
    if (!manifest.$['xmlns:tools']) {
      manifest.$['xmlns:tools'] = 'http://schemas.android.com/tools';
    }

    return config;
  });
};
