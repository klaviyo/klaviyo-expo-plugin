#!/usr/bin/env node

/**
 * Bump the plugin version everywhere it needs to stay in sync:
 *   - package.json (root)
 *   - example/package.json
 *   - ios/klaviyo-plugin-configuration.plist  (klaviyo_sdk_plugin_version_override)
 *   - plugin/withKlaviyoAndroid.ts            (klaviyo_sdk_plugin_version_override)
 *
 * Usage:
 *   node scripts/bump-version.js <new-version>
 *   node scripts/bump-version.js 0.4.0
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

function usage() {
  console.error('Usage: node scripts/bump-version.js <new-version>');
  console.error('Example: node scripts/bump-version.js 0.4.0');
  process.exit(1);
}

function validateSemver(version) {
  return /^\d+\.\d+\.\d+$/.test(version);
}

function bumpJson(filePath, version) {
  const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const old = content.version;
  content.version = version;
  fs.writeFileSync(filePath, JSON.stringify(content, null, 2) + '\n');
  console.log(`  ${path.relative(ROOT, filePath)}: ${old} -> ${version}`);
}

function bumpPlist(filePath, version) {
  let content = fs.readFileSync(filePath, 'utf8');
  const pattern = /(<key>klaviyo_sdk_plugin_version_override<\/key>\s*<string>)([^<]+)(<\/string>)/;
  const match = content.match(pattern);
  if (!match) {
    throw new Error(`Could not find klaviyo_sdk_plugin_version_override in ${filePath}`);
  }
  const old = match[2];
  content = content.replace(pattern, `$1${version}$3`);
  fs.writeFileSync(filePath, content);
  console.log(`  ${path.relative(ROOT, filePath)}: ${old} -> ${version}`);
}

function bumpAndroidTs(filePath, version) {
  let content = fs.readFileSync(filePath, 'utf8');
  const pattern = /(setStringResource\('klaviyo_sdk_plugin_version_override',\s*')[^']+(')/;
  const match = content.match(pattern);
  if (!match) {
    throw new Error(`Could not find klaviyo_sdk_plugin_version_override setStringResource call in ${filePath}`);
  }
  const old = content.match(/setStringResource\('klaviyo_sdk_plugin_version_override',\s*'([^']+)'\)/)?.[1];
  content = content.replace(pattern, `$1${version}$2`);
  fs.writeFileSync(filePath, content);
  console.log(`  ${path.relative(ROOT, filePath)}: ${old} -> ${version}`);
}

async function promptVersion() {
  const readline = require('readline');
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question('Enter new Expo plugin version: ', (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function main() {
  let newVersion = process.argv[2];
  if (!newVersion) {
    newVersion = await promptVersion();
    if (!newVersion) usage();
  }
  if (!validateSemver(newVersion)) {
    console.error(`Invalid version "${newVersion}". Must be semver (e.g. 0.4.0).`);
    process.exit(1);
  }

  console.log(`Bumping to version ${newVersion}...\n`);

  bumpJson(path.join(ROOT, 'package.json'), newVersion);
  bumpJson(path.join(ROOT, 'example', 'package.json'), newVersion);
  bumpPlist(path.join(ROOT, 'ios', 'klaviyo-plugin-configuration.plist'), newVersion);
  bumpAndroidTs(path.join(ROOT, 'plugin', 'withKlaviyoAndroid.ts'), newVersion);

  console.log('\nAll files updated. Run `npm install` and `cd example && npm install` to update lock files.');
}

main().catch((err) => { console.error(err); process.exit(1); });
