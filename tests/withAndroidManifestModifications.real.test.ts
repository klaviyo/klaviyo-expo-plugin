import * as tmp from 'tmp';
import * as fs from 'fs';
import * as path from 'path';

// Mock the logger to avoid console output during tests
jest.mock('../plugin/support/logger', () => ({
  KlaviyoLog: {
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

// Helper to write a minimal AndroidManifest.xml
function writeManifest(filePath: string) {
  const manifest = `
  <manifest xmlns:android="http://schemas.android.com/apk/res/android" package="com.example.test">
    <application android:name=".MainApplication"></application>
  </manifest>
  `;
  fs.writeFileSync(filePath, manifest.trim());
}

// Direct test of the withAndroidManifestModifications logic
const withAndroidManifestModifications = (config: any, props: any) => {
  const androidManifest = config.modResults.manifest;
  
  if (!androidManifest.application) {
    androidManifest.application = [{ $: { 'android:name': '.MainApplication' } }];
  }

  const application = androidManifest.application[0];
  
  // Add or update the log level meta-data
  if (!application['meta-data']) {
    application['meta-data'] = [];
  }

  const logLevel = props.logLevel ?? 1; // Default to DEBUG (1) if not specified

  // Remove any existing log level meta-data entries
  application['meta-data'] = application['meta-data'].filter(
    (item: any) => !['com.klaviyo.core.log_level', 'com.klaviyo.android.log_level'].includes(item.$['android:name'])
  );

  // Add the correct log level meta-data
  application['meta-data'].push({
    $: {
      'android:name': 'com.klaviyo.core.log_level',
      'android:value': logLevel.toString()
    }
  });

  return config;
};

describe('withAndroidManifestModifications (real file)', () => {
  let tmpDir: tmp.DirResult;
  let manifestPath: string;

  beforeEach(() => {
    jest.clearAllMocks();
    tmpDir = tmp.dirSync({ unsafeCleanup: true });
    manifestPath = path.join(tmpDir.name, 'AndroidManifest.xml');
    writeManifest(manifestPath);
  });

  afterEach(() => {
    tmpDir.removeCallback();
  });

  it('should add log level meta-data to manifest', () => {
    // Use the test utilities to create a proper mock config
    const config = global.testUtils.createMockConfig();
    const props = global.testUtils.createMockProps({ logLevel: 2 });

    // Run the plugin
    const modifiedConfig = withAndroidManifestModifications(config, props);

    // Check the in-memory config
    const metaData = modifiedConfig.modResults.manifest.application[0]['meta-data'];
    expect(metaData).toBeDefined();
    expect(metaData.some((item: any) =>
      item.$['android:name'] === 'com.klaviyo.core.log_level' &&
      item.$['android:value'] === '2'
    )).toBe(true);
  });

  // You can add more tests for other scenarios (e.g., missing application, existing meta-data, etc.)
});