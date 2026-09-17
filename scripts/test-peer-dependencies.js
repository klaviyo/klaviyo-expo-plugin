#!/usr/bin/env node

const { execSync } = require('child_process');

// Sourced from the SAME file CI reads (see scripts/expo-sdk-matrix.md). Previously this
// list was a second hand-written copy of the ci.yml matrix with a "same as CI" comment
// and nothing enforcing it.
const testMatrix = require('./expo-sdk-matrix.json');

function runCommand(command, description) {
  console.log(`\n🔄 ${description}...`);
  try {
    execSync(command, { stdio: 'inherit' });
    console.log(`✅ ${description} completed successfully`);
    return true;
  } catch {
    console.error(`❌ ${description} failed`);
    return false;
  }
}

function testWithVersions(reactVersion, reactNativeVersion, expoVersion, configPluginsVersion) {
  console.log(`\n🧪 Testing with React ${reactVersion}, React Native ${reactNativeVersion}, Expo ${expoVersion}`);
  console.log('='.repeat(80));
  
  // Install specific versions
  // --no-package-lock is required, and these runs are deliberately not reproducible.
  // The full reasoning lives in ONE place - the "Install dependencies with specific peer
  // dependency versions" step in .github/workflows/ci.yml. Do not restate it here; two
  // copies of that analysis will drift.
  // @expo/config-plugins is installed explicitly. package.json pins it exactly as a
  // devDependency and that pin wins the root hoist, so installing expo alone leaves the
  // plugin resolving the newest config-plugins - meaning an SDK 54 run would validate the
  // wrong pairing. Versions come from expo-sdk-matrix.json; see expo-sdk-matrix.md.
  const installCommand =
    `npm install --no-save --no-package-lock react@${reactVersion} ` +
    `react-native@${reactNativeVersion} expo@${expoVersion} ` +
    `@expo/config-plugins@${configPluginsVersion}`;
  if (!runCommand(installCommand, `Installing React ${reactVersion}, React Native ${reactNativeVersion}, Expo ${expoVersion}`)) {
    return false;
  }
  
  // Run tests
  if (!runCommand('npm test', 'Running tests')) {
    return false;
  }
  
  // Build the project
  if (!runCommand('npm run build', 'Building project')) {
    return false;
  }
  
  return true;
}

function main() {
  // --sdk <major> runs one row, so `npm run test:peer-deps -- --sdk 54` replaces the old
  // per-SDK shortcuts. Those installed expo/react/react-native but not the matching
  // @expo/config-plugins, so they reported green while testing the wrong graph.
  const sdkArgIndex = process.argv.indexOf('--sdk');
  const only = sdkArgIndex !== -1 ? process.argv[sdkArgIndex + 1] : null;

  console.log('🚀 Starting peer dependency compatibility tests...');
  console.log('This will test your plugin against multiple React and React Native versions');
  
  // `supported` gates the exit code, exactly as it gates `continue-on-error` in the
  // test-peer-dependencies job in ci.yml. The matrix is deliberately wider than the
  // support statement (52 and 53 are tested but unsupported - see
  // scripts/expo-sdk-matrix.md), so a break on an SDK we explicitly disclaim must not
  // fail the run. Unsupported rows still RUN and still report; they just do not gate.
  // Without this, running this script locally was stricter than CI on the same matrix,
  // which is the one thing sourcing both from expo-sdk-matrix.json was meant to prevent.
  const rows = only ? testMatrix.filter((r) => r.sdk === only) : testMatrix;
  if (rows.length === 0) {
    console.error(`No matrix row for --sdk ${only}. Known: ${testMatrix.map((r) => r.sdk).join(', ')}`);
    process.exit(1);
  }

  const required = [];
  const optionalFailures = [];

  for (const { sdk, react, reactNative, expo, configPlugins, supported } of rows) {
    const passed = testWithVersions(react, reactNative, expo, configPlugins);
    if (supported) {
      required.push(passed);
    } else if (!passed) {
      // With --sdk the caller is asking about one row; do not swallow its failure.
      if (only) required.push(false);
      else optionalFailures.push(sdk);
    }
  }

  const passedTests = required.filter(Boolean).length;
  const totalTests = required.length;

  console.log('\n' + '='.repeat(80));
  console.log(`📊 Test Results: ${passedTests}/${totalTests} supported combinations passed`);

  if (optionalFailures.length) {
    console.log(
      `⚠️  Non-blocking: unsupported SDK ${optionalFailures.join(', ')} failed. ` +
        'See scripts/expo-sdk-matrix.md.'
    );
  }

  if (passedTests === totalTests) {
    console.log('🎉 All supported peer dependency tests passed!');
    process.exit(0);
  } else {
    console.log('⚠️  Some supported peer dependency tests failed. Check the output above for details.');
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { testMatrix, testWithVersions }; 