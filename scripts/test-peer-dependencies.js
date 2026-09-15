#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Test matrix - same as CI.
// Each row is a real Expo SDK pairing from https://api.expo.dev/v2/versions/latest
// (facebookReactNativeVersion / facebookReactVersion). Do not hand-edit these to
// arbitrary versions: a combination Expo never shipped tests nothing a customer can hit.
// The supported range is documented in README.md; this matrix is a subset of it.
const testMatrix = [
  { react: "18.3.1", reactNative: "0.76.9",  expo: "~52.0.0" },
  { react: "19.0.0", reactNative: "0.79.6",  expo: "~53.0.0" },
  { react: "19.1.0", reactNative: "0.81.5",  expo: "~54.0.0" },
  { react: "19.2.0", reactNative: "0.83.10", expo: "~55.0.0" },
  { react: "19.2.3", reactNative: "0.85.3",  expo: "~56.0.0" },
  { react: "19.2.3", reactNative: "0.86.3",  expo: "~57.0.0" },
];

function runCommand(command, description) {
  console.log(`\n🔄 ${description}...`);
  try {
    execSync(command, { stdio: 'inherit' });
    console.log(`✅ ${description} completed successfully`);
    return true;
  } catch (error) {
    console.error(`❌ ${description} failed`);
    return false;
  }
}

function testWithVersions(reactVersion, reactNativeVersion, expoVersion) {
  console.log(`\n🧪 Testing with React ${reactVersion}, React Native ${reactNativeVersion}, Expo ${expoVersion}`);
  console.log('='.repeat(80));
  
  // Install specific versions
  // --no-package-lock is required: the committed lock pins the Expo 57 graph, and
  // installing an older pairing on top of it retains @expo/router-server@57, whose
  // optional peer on @expo/metro-runtime "^57.0.15" makes npm resolve that package
  // fresh (it is never itself in the lock). That package optionally peers
  // react-dom "*" -> react-dom@19.3.0 -> peer react@^19.3.0, which conflicts with
  // the older react in the pairing. Ignoring the lock drops the Expo 57 graph, so
  // nothing pulls either package in - the way a real consumer on that SDK resolves.
  const installCommand = `npm install --no-save --no-package-lock react@${reactVersion} react-native@${reactNativeVersion} expo@${expoVersion}`;
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
  console.log('🚀 Starting peer dependency compatibility tests...');
  console.log('This will test your plugin against multiple React and React Native versions');
  
  let passedTests = 0;
  let totalTests = testMatrix.length;
  
  for (const { react, reactNative, expo } of testMatrix) {
    if (testWithVersions(react, reactNative, expo)) {
      passedTests++;
    }
  }
  
  console.log('\n' + '='.repeat(80));
  console.log(`📊 Test Results: ${passedTests}/${totalTests} combinations passed`);
  
  if (passedTests === totalTests) {
    console.log('🎉 All peer dependency tests passed!');
    process.exit(0);
  } else {
    console.log('⚠️  Some peer dependency tests failed. Check the output above for details.');
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { testMatrix, testWithVersions }; 