#!/usr/bin/env node
/**
 * Asserts the published tarball contains every file the plugin reads at prebuild time.
 *
 * This exists because `files` in package.json is a hard allowlist, and the example app
 * installs the plugin with `file:../`, so it sees the whole working tree and can never
 * catch an omission. A missing entry here fails only for real consumers, after publish.
 *
 * Run: node scripts/verify-package-contents.js
 */
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

// Paths the plugin resolves against getPluginRoot() at runtime, plus the files Expo
// autolinking and CocoaPods need from the installed package.
const REQUIRED = [
  'package.json',
  'expo-module.config.json',
  'dist/plugin/withKlaviyo.js',
  'ios/ExpoKlaviyo.podspec',
  'ios/ExpoKlaviyo/KlaviyoAppDelegate.swift',
  'ios/klaviyo-plugin-configuration.plist',
  'KlaviyoNotificationServiceExtension/KlaviyoNotificationService.swift',
  'KlaviyoNotificationServiceExtension/KlaviyoNotificationServiceExtension.entitlements',
  'KlaviyoNotificationServiceExtension/KlaviyoNotificationServiceExtension-Info.plist',
  // Referenced by a relative link in README.md, so it must ship or that link 404s.
  'MIGRATION_GUIDE.md',
];

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'klaviyo-pack-'));
try {
  const out = execFileSync('npm', ['pack', '--pack-destination', tmp], { encoding: 'utf8' });
  const tarball = fs.readdirSync(tmp).find((f) => f.endsWith('.tgz'));
  if (!tarball) {
    console.error('npm pack produced no tarball:\n' + out);
    process.exit(1);
  }

  const listed = execFileSync('tar', ['-tzf', path.join(tmp, tarball)], { encoding: 'utf8' })
    .split('\n')
    .filter(Boolean)
    .map((entry) => entry.replace(/^package\//, ''));
  const present = new Set(listed);

  const missing = REQUIRED.filter((f) => !present.has(f));
  if (missing.length > 0) {
    console.error(`\n${tarball} is missing ${missing.length} required file(s):`);
    for (const f of missing) console.error(`  - ${f}`);
    console.error('\nAdd the path to "files" in package.json, or drop it from REQUIRED here.');
    process.exit(1);
  }

  console.log(`${tarball}: all ${REQUIRED.length} required files present (${listed.length} total).`);
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
