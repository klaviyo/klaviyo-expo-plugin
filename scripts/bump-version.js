#!/usr/bin/env node

/**
 * Bump the plugin version everywhere it needs to stay in sync:
 *   - package.json (root)
 *   - example/package.json
 *   - ios/klaviyo-plugin-configuration.plist  (klaviyo_sdk_plugin_version_override)
 *   - plugin/withKlaviyoAndroid.ts            (klaviyo_sdk_plugin_version_override)
 *   - example/app.config.js                    (version field)
 *   - tests/withKlaviyoAndroid.internal.test.ts (version assertions)
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

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function bumpTestVersionAssertions(filePath, oldVersion, newVersion) {
  let content = fs.readFileSync(filePath, 'utf8');
  let count = 0;

  // Match `_: 'X.Y.Z'` that immediately follows a klaviyo_sdk_plugin_version_override name line.
  // Targets toContainEqual assertions — not the 'old_version' input strings used as test data.
  const p1 = new RegExp(
    `(name:\\s*'klaviyo_sdk_plugin_version_override'\\s*\\}[^\\n]*\\n[^\\n]*_:\\s*')${escapeRegex(oldVersion)}(')`,
    'g'
  );
  content = content.replace(p1, (_, pre, post) => { count++; return `${pre}${newVersion}${post}`; });

  // Match expect(versionString._).toBe('X.Y.Z') assertions
  const p2 = new RegExp(`(versionString\\._\\)\\.toBe\\(')${escapeRegex(oldVersion)}(')`, 'g');
  content = content.replace(p2, (_, pre, post) => { count++; return `${pre}${newVersion}${post}`; });

  if (count === 0) {
    console.warn(`  WARNING: no version assertions found in ${path.relative(ROOT, filePath)} — update manually`);
    return;
  }
  fs.writeFileSync(filePath, content);
  console.log(`  ${path.relative(ROOT, filePath)}: ${oldVersion} -> ${newVersion} (${count} assertion(s))`);
}

function bumpAppConfigJs(filePath, version) {
  let content = fs.readFileSync(filePath, 'utf8');
  const pattern = /(version:\s*')[^']+(')/;
  const match = content.match(pattern);
  if (!match) {
    throw new Error(`Could not find version field in ${filePath}`);
  }
  const old = match[0].match(/'([^']+)'/)[1];
  content = content.replace(pattern, `$1${version}$2`);
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

  const rootPkg = path.join(ROOT, 'package.json');
  const oldVersion = JSON.parse(fs.readFileSync(rootPkg, 'utf8')).version;

  console.log(`Bumping to version ${newVersion}...\n`);

  bumpJson(rootPkg, newVersion);
  bumpJson(path.join(ROOT, 'example', 'package.json'), newVersion);
  bumpAppConfigJs(path.join(ROOT, 'example', 'app.config.js'), newVersion);
  bumpPlist(path.join(ROOT, 'ios', 'klaviyo-plugin-configuration.plist'), newVersion);
  bumpAndroidTs(path.join(ROOT, 'plugin', 'withKlaviyoAndroid.ts'), newVersion);
  bumpTestVersionAssertions(
    path.join(ROOT, 'tests', 'withKlaviyoAndroid.internal.test.ts'),
    oldVersion,
    newVersion
  );

  console.log('\nAll files updated. Run `npm install` and `cd example && npm install` to update lock files.');
}

main().catch((err) => { console.error(err); process.exit(1); });
