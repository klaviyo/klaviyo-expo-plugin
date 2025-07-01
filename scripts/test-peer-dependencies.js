#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Test matrix - same as CI
const testMatrix = [
  // React 18.x with various React Native versions
  { react: "18.2.0", reactNative: "0.70.0", expo: "~48.0.0" },
  { react: "18.2.0", reactNative: "0.71.0", expo: "~49.0.0" },
  { react: "18.2.0", reactNative: "0.72.0", expo: "~50.0.0" },
  { react: "18.2.0", reactNative: "0.73.0", expo: "~51.0.0" },
  // React 19.x with various React Native versions
  { react: "19.0.0", reactNative: "0.79.0", expo: "~52.0.0" },
  { react: "19.0.0", reactNative: "0.80.0", expo: "~53.0.0" },
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
  const installCommand = `npm install --no-save react@${reactVersion} react-native@${reactNativeVersion} expo@${expoVersion}`;
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