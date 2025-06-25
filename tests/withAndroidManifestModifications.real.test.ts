import * as tmp from 'tmp';
import * as fs from 'fs';
import * as path from 'path';
import withKlaviyoAndroid from '../plugin/withKlaviyoAndroid';

// Helper to write a minimal AndroidManifest.xml
function writeManifest(filePath: string) {
  const manifest = `
  <manifest xmlns:android="http://schemas.android.com/apk/res/android" package="com.example.test">
    <application android:name=".MainApplication"></application>
  </manifest>
  `;
  fs.writeFileSync(filePath, manifest.trim());
}

describe('withAndroidManifestModifications (real file)', () => {
  let tmpDir: tmp.DirResult;
  let manifestPath: string;

  beforeEach(() => {
    tmpDir = tmp.dirSync({ unsafeCleanup: true });
    manifestPath = path.join(tmpDir.name, 'AndroidManifest.xml');
    writeManifest(manifestPath);
  });

  afterEach(() => {
    tmpDir.removeCallback();
  });

  it('should add log level meta-data to manifest', () => {
    // Simulate the config structure expected by the plugin
    const config = {
      modResults: {
        manifest: {
          application: [{
            $: { 'android:name': '.MainApplication' },
            'meta-data': [],
          }],
        },
      },
    };
    const props = { logLevel: 2 };

    // Run the plugin
    const plugin = withKlaviyoAndroid(config, props);
    const modifiedConfig = plugin(config, props);

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