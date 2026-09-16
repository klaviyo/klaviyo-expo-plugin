#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

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
  } catch (error) {
    console.error(`❌ ${description} failed`);
    return false;
  }
}

function testWithVersions(reactVersion, reactNativeVersion, expoVersion) {
  console.log(`\n🧪 Testing with React ${reactVersion}, React Native ${reactNativeVersion}, Expo ${expoVersion}`);
  console.log('='.repeat(80));
  
  // Install specific versions
  // --no-package-lock is required, and these runs are deliberately not reproducible.
  // The full reasoning lives in ONE place - the "Install dependencies with specific peer
  // dependency versions" step in .github/workflows/ci.yml. Do not restate it here; two
  // copies of that analysis will drift.
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