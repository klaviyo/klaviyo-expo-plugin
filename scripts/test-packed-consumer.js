#!/usr/bin/env node
/**
 * Installs the PACKED plugin into a throwaway Expo app and runs a real prebuild.
 *
 * Why this exists, when scripts/test-peer-dependencies.js already runs a matrix:
 * that script installs each Expo pairing into THIS repository, where the tree is
 * deliberately unlike a consumer's. package.json pins @expo/config-plugins exactly,
 * tests/setup.ts mocks most of @expo/config-plugins, and node_modules is hoisted our
 * way. Jest and tsc can therefore stay green while exercising our mocks rather than
 * the SDK graph a customer actually gets.
 *
 * Every consumer-facing defect found during the SDK 54 -> 57 upgrade was invisible to
 * the unit suite and caught by hand or in review: MIGRATION_GUIDE.md missing from the
 * `files` allowlist, an absolute machine-specific path in project.pbxproj, and the
 * matrix validating config-plugins 57 while claiming to test SDK 54. All three are
 * "what does a real install look like" questions, which is what this checks.
 *
 * Deliberately runs `expo prebuild --no-install`: CocoaPods needs macOS, and the point
 * here is the config plugin's output, not pod resolution.
 *
 * Usage:
 *   node scripts/test-packed-consumer.js            # every row in the matrix
 *   node scripts/test-packed-consumer.js --sdk 57   # one row
 */
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const matrix = require('./expo-sdk-matrix.json');
const REPO_ROOT = path.resolve(__dirname, '..');

function run(cmd, args, cwd) {
  return execFileSync(cmd, args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

/** Builds and packs the plugin once; every row installs the same tarball. */
function packPlugin(destDir) {
  // `npm pack` runs `prepare`, so dist/ is rebuilt from source here.
  run('npm', ['pack', '--pack-destination', destDir], REPO_ROOT);
  const tarball = fs.readdirSync(destDir).find((f) => f.endsWith('.tgz'));
  if (!tarball) throw new Error('npm pack produced no tarball');
  return path.join(destDir, tarball);
}

/** A minimal Expo app: just enough config for the plugin to have something to do. */
function scaffoldApp(dir, slug) {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, 'package.json'),
    JSON.stringify({ name: slug, version: '1.0.0', private: true, main: 'index.js' }, null, 2)
  );
  fs.writeFileSync(
    path.join(dir, 'app.json'),
    JSON.stringify(
      {
        expo: {
          name: slug,
          slug,
          version: '1.0.0',
          ios: { bundleIdentifier: `com.klaviyo.${slug}` },
          android: { package: `com.klaviyo.${slug}` },
          plugins: [
            [
              'klaviyo-expo-plugin',
              {
                android: { logLevel: 1, notificationColor: '#FF0000', formsEnabled: true },
                ios: {
                  badgeAutoclearing: true,
                  codeSigningStyle: 'Automatic',
                  devTeam: 'XXXXXXXXXX',
                  formsEnabled: true,
                  includeNotificationServiceExtension: true,
                },
              },
            ],
          ],
        },
      },
      null,
      2
    )
  );
}

const checks = [];
function check(label, condition, detail) {
  checks.push({ label, ok: Boolean(condition), detail });
}

function verifyAndroid(appDir) {
  const manifest = path.join(appDir, 'android/app/src/main/AndroidManifest.xml');
  const gradleProps = path.join(appDir, 'android/gradle.properties');
  const colors = path.join(appDir, 'android/app/src/main/res/values/colors.xml');

  const manifestText = fs.existsSync(manifest) ? fs.readFileSync(manifest, 'utf8') : '';
  check('android: KlaviyoPushService registered', manifestText.includes('KlaviyoPushService'));
  check('android: log level meta-data', manifestText.includes('com.klaviyo.core.log_level'));
  check(
    'android: gradle properties written',
    fs.existsSync(gradleProps) &&
      /klaviyoIncludeForms=/.test(fs.readFileSync(gradleProps, 'utf8'))
  );
  check(
    'android: notification colour resource',
    fs.existsSync(colors) &&
      fs.readFileSync(colors, 'utf8').includes('klaviyo_notification_color')
  );
}

function verifyIos(appDir, slug) {
  const pbxprojDir = fs
    .readdirSync(path.join(appDir, 'ios'))
    .find((entry) => entry.endsWith('.xcodeproj'));
  const pbxproj = path.join(appDir, 'ios', pbxprojDir || '', 'project.pbxproj');
  const text = fs.existsSync(pbxproj) ? fs.readFileSync(pbxproj, 'utf8') : '';

  const stored = (text.match(/path = "?([^";]*klaviyo-plugin-configuration\.plist)"?/) || [])[1];
  check('ios: config plist registered', Boolean(stored), stored);
  // The regression a reviewer hit on an upgrade: an absolute path bakes one machine's
  // home directory into a file consumers are told to keep with --no-clean.
  check(
    'ios: plist path is relative, not absolute',
    Boolean(stored) && !path.isAbsolute(stored),
    stored
  );
  check(
    'ios: plist present on disk',
    fs.existsSync(path.join(appDir, 'ios', slug, 'klaviyo-plugin-configuration.plist'))
  );
  // A PBXBuildFile keyed on the literal string "undefined" is malformed and silently
  // collides with the next file added the same way.
  check('ios: no "undefined" pbxproj keys', !/\n\t\tundefined /.test(text));
  check('ios: NSE target created', text.includes('KlaviyoNotificationServiceExtension'));

  // The checks above pass if the reference merely EXISTS, which is not enough: a reference
  // in no build phase ships nothing. Parse the project properly and require the plist in
  // the first target's Resources phase.
  //
  // LIMITATION, measured rather than assumed: this cannot catch a missing `fileRef.target`.
  // In a freshly generated project the app's Resources phase is at position 0 and the
  // extension's is appended after it, so xcode's buildPhaseObject fallback picks the app's
  // phase anyway and the plist still lands correctly. The bug only surfaces once a project
  // has been through Xcode, which re-sorts each section by UUID. Verified: stubbing out
  // `fileRef.target` leaves every check here green. What does catch it is the inverted
  // fixture in tests/withKlaviyoIos.pluginConfigurationPlist.test.ts, which orders the
  // extension's phase first on purpose. Do not treat this check as covering that case.
  let inAppPhase = false;
  let inNsePhase = false;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const xcode = require(path.join(appDir, 'node_modules', 'xcode'));
    const project = xcode.project(pbxproj).parseSync();
    const firstTargetUuid = project.getFirstTarget().uuid;

    const phases = project.hash.project.objects['PBXResourcesBuildPhase'] || {};
    const appPhase = project.pbxResourcesBuildPhaseObj(firstTargetUuid);
    const holdsPlist = (phase) =>
      (phase?.files || []).some((f) =>
        String(f?.comment || '').includes('klaviyo-plugin-configuration.plist')
      );

    inAppPhase = holdsPlist(appPhase);
    inNsePhase = Object.keys(phases)
      .filter((k) => !k.endsWith('_comment'))
      .filter((k) => phases[k] !== appPhase)
      .some((k) => holdsPlist(phases[k]));
  } catch (err) {
    check('ios: could parse pbxproj to verify build phases', false, String(err).slice(0, 160));
  }

  check('ios: plist is in the HOST APP Resources phase', inAppPhase);
  check('ios: plist is NOT in the extension Resources phase', !inNsePhase);

  const podfile = path.join(appDir, 'ios/Podfile');
  check(
    'ios: NSE pod declared',
    fs.existsSync(podfile) &&
      /^[ \t]*pod 'KlaviyoSwiftExtension'/m.test(fs.readFileSync(podfile, 'utf8'))
  );
}

function testRow(row, tarball, workRoot) {
  const { sdk, expo, configPlugins } = row;
  const slug = `klaviyoconsumer${sdk}`;
  const appDir = path.join(workRoot, `sdk${sdk}`);

  console.log(`\n${'='.repeat(78)}\n🧪 SDK ${sdk}: packed plugin in a throwaway consumer\n${'='.repeat(78)}`);
  checks.length = 0;

  scaffoldApp(appDir, slug);

  try {
    run('npm', ['install', '--no-fund', '--no-audit', tarball, `expo@${expo}`], appDir);
  } catch (err) {
    console.error(`❌ install failed\n${err.stdout || ''}${err.stderr || ''}`);
    return false;
  }

  // Assert the graph is the one we claim to be testing. Expo brings its own
  // config-plugins here, rather than inheriting this repo's exact pin.
  const installed = (pkg) => {
    try {
      return require(path.join(appDir, 'node_modules', pkg, 'package.json')).version;
    } catch {
      return null;
    }
  };
  const expoVersion = installed('expo');
  const cpVersion = installed('@expo/config-plugins');
  const expectedMajor = String(sdk);
  check(`expo resolves to ${expectedMajor}.x`, expoVersion?.split('.')[0] === expectedMajor, expoVersion);
  check(
    `config-plugins matches ${configPlugins}`,
    Boolean(cpVersion) && cpVersion.split('.')[0] === configPlugins.replace(/^[~^]/, '').split('.')[0],
    cpVersion
  );
  check('packed plugin installed', Boolean(installed('klaviyo-expo-plugin')), installed('klaviyo-expo-plugin'));

  for (const platform of ['android', 'ios']) {
    try {
      run('npx', ['expo', 'prebuild', '--platform', platform, '--no-install'], appDir);
      check(`${platform}: prebuild succeeded`, true);
    } catch (err) {
      check(`${platform}: prebuild succeeded`, false, (err.stderr || err.stdout || '').slice(-400));
    }
  }

  if (fs.existsSync(path.join(appDir, 'android'))) verifyAndroid(appDir);
  if (fs.existsSync(path.join(appDir, 'ios'))) verifyIos(appDir, slug);

  let failed = 0;
  for (const { label, ok, detail } of checks) {
    console.log(`  ${ok ? '✅' : '❌'} ${label}${detail ? `  (${detail})` : ''}`);
    if (!ok) failed++;
  }
  return failed === 0;
}

function main() {
  const sdkArgIndex = process.argv.indexOf('--sdk');
  const only = sdkArgIndex !== -1 ? process.argv[sdkArgIndex + 1] : null;
  const rows = only ? matrix.filter((r) => r.sdk === only) : matrix;
  if (rows.length === 0) {
    console.error(`No matrix row for --sdk ${only}. Known: ${matrix.map((r) => r.sdk).join(', ')}`);
    process.exit(1);
  }

  const workRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'klaviyo-consumer-'));
  let blockingFailures = 0;
  const advisoryFailures = [];

  try {
    const tarball = packPlugin(workRoot);
    console.log(`📦 ${path.basename(tarball)}`);

    for (const row of rows) {
      const ok = testRow(row, tarball, workRoot);
      if (ok) continue;
      // Advisory gating applies only to a FULL-matrix run, which is the local
      // `npm run test:packed-consumer` case. With --sdk the caller is CI, where each job
      // runs one row and already carries `continue-on-error: ${!matrix.supported}` plus an
      // `if: failure()` summary step. Swallowing the failure here too would double-gate it:
      // the step would exit 0, failure() would stay false, and a packed-consumer regression
      // on SDK 52/53 would never reach the summary that exists to make it visible.
      if (row.supported || only) blockingFailures++;
      else advisoryFailures.push(row.sdk);
    }
  } finally {
    fs.rmSync(workRoot, { recursive: true, force: true });
  }

  console.log(`\n${'='.repeat(78)}`);
  if (advisoryFailures.length) {
    console.log(`⚠️  Non-blocking: unsupported SDK ${advisoryFailures.join(', ')} failed.`);
  }
  if (blockingFailures > 0) {
    console.log(`❌ ${blockingFailures} supported SDK row(s) failed.`);
    process.exit(1);
  }
  console.log('🎉 Packed-consumer prebuild passed for every supported SDK.');
}

main();
