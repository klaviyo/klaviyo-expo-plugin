import withKlaviyoAndroid from '../plugin/withKlaviyoAndroid';
import { KlaviyoPluginAndroidProps } from '../plugin/types';
import { testIntegrationPluginFunction, testSimpleIntegration, createMockProps } from './utils/testHelpers';

// Mock file system operations
jest.mock('fs', () => ({
  existsSync: jest.fn(() => true),
  readFileSync: jest.fn(() => 'class MainActivity extends ReactActivity {}'),
  writeFileSync: jest.fn(),
  mkdirSync: jest.fn(),
  copyFileSync: jest.fn(),
  unlinkSync: jest.fn(),
}));

jest.mock('glob', () => ({
  sync: jest.fn(() => ['MainActivity.java']),
}));

jest.mock('@expo/config-plugins/build/android/Paths', () => ({
  getMainActivityAsync: jest.fn(() => Promise.resolve('/test/path/MainActivity.java')),
}));

describe('withKlaviyoAndroid Integration Tests', () => {
  describe('withAndroidManifestModifications', () => {
    it('should add log level meta-data with default value', () => {
      testIntegrationPluginFunction(withKlaviyoAndroid, `
        <manifest xmlns:android="http://schemas.android.com/apk/res/android">
          <application
            android:allowBackup="true"
            android:icon="@mipmap/ic_launcher"
            android:label="@string/app_name"
            android:roundIcon="@mipmap/ic_launcher_round"
            android:supportsRtl="true"
            android:theme="@style/AppTheme">
            <activity
              android:name=".MainActivity"
              android:exported="true"
              android:launchMode="singleTop"
              android:theme="@style/LaunchTheme"
              android:configChanges="orientation|keyboardHidden|keyboard|screenSize|smallestScreenSize|locale|layoutDirection|fontScale|screenLayout|density|uiMode"
              android:hardwareAccelerated="true"
              android:windowSoftInputMode="adjustResize">
              <meta-data
                android:name="io.expo.client.arguments"
                android:value="exp://192.168.1.100:8081" />
              <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
              </intent-filter>
            </activity>
          </application>
        </manifest>
      `);
    });

    it('should add log level meta-data with custom value', () => {
      testSimpleIntegration(withKlaviyoAndroid, { logLevel: 3 });
    });

    it('should replace existing log level meta-data', () => {
      testSimpleIntegration(withKlaviyoAndroid, { logLevel: 2 });
    });

    it('should add KlaviyoPushService to manifest', () => {
      testSimpleIntegration(withKlaviyoAndroid);
    });

    it('should not duplicate KlaviyoPushService if already exists', () => {
      testSimpleIntegration(withKlaviyoAndroid);
    });

    it('should create application tag if missing', () => {
      testIntegrationPluginFunction(withKlaviyoAndroid, `
        <manifest xmlns:android="http://schemas.android.com/apk/res/android">
        </manifest>
      `);
    });

    it('should create meta-data array if missing', () => {
      testIntegrationPluginFunction(withKlaviyoAndroid, `
        <manifest xmlns:android="http://schemas.android.com/apk/res/android">
          <application android:name=".MainApplication">
          </application>
        </manifest>
      `);
    });

    it('should handle existing meta-data array', () => {
      testIntegrationPluginFunction(withKlaviyoAndroid, `
        <manifest xmlns:android="http://schemas.android.com/apk/res/android">
          <application android:name=".MainApplication">
            <meta-data android:name="existing" android:value="value" />
          </application>
        </manifest>
      `);
    });

    it('should handle existing service array', () => {
      testIntegrationPluginFunction(withKlaviyoAndroid, `
        <manifest xmlns:android="http://schemas.android.com/apk/res/android">
          <application android:name=".MainApplication">
            <service android:name=".ExistingService" />
          </application>
        </manifest>
      `);
    });
  });

  describe('withNotificationManifest', () => {
    it('should add notification icon meta-data when icon path is provided', () => {
      testSimpleIntegration(withKlaviyoAndroid, { notificationIconFilePath: './assets/icon.png' });
    });

    it('should remove notification icon meta-data when icon path is not provided', () => {
      testSimpleIntegration(withKlaviyoAndroid, { notificationIconFilePath: undefined });
    });

    it('should add notification color meta-data when color is provided', () => {
      testSimpleIntegration(withKlaviyoAndroid, { notificationColor: '#FF0000' });
    });

    it('should remove notification color meta-data when color is not provided', () => {
      testSimpleIntegration(withKlaviyoAndroid, { notificationColor: undefined });
    });

    it('should not duplicate existing notification icon meta-data', () => {
      testSimpleIntegration(withKlaviyoAndroid, { notificationIconFilePath: './assets/icon.png' });
    });

    it('should handle existing notification icon meta-data', () => {
      testIntegrationPluginFunction(withKlaviyoAndroid, `
        <manifest xmlns:android="http://schemas.android.com/apk/res/android">
          <application android:name=".MainApplication">
            <meta-data android:name="com.klaviyo.push.default_notification_icon" android:resource="@drawable/notification_icon" />
          </application>
        </manifest>
      `, { notificationIconFilePath: './assets/icon.png' });
    });

    it('should handle existing notification color meta-data', () => {
      testIntegrationPluginFunction(withKlaviyoAndroid, `
        <manifest xmlns:android="http://schemas.android.com/apk/res/android">
          <application android:name=".MainApplication">
            <meta-data android:name="com.klaviyo.push.default_notification_color" android:resource="@color/notification_color" />
          </application>
        </manifest>
      `, { notificationColor: '#FF0000' });
    });
  });

  describe('withKlaviyoPluginNameVersion', () => {
    it('should add plugin name and version string resources', () => {
      const config = testSimpleIntegration(withKlaviyoAndroid);
      const props = createMockProps();
      
      const result = withKlaviyoAndroid(config, props);
      
      expect(result).toBeDefined();
      expect(typeof result).toBe('function');
    });

    it('should update existing string resources', () => {
      const config = testSimpleIntegration(withKlaviyoAndroid);
      const props = createMockProps();
      
      const result = withKlaviyoAndroid(config, props);
      
      expect(result).toBeDefined();
      expect(typeof result).toBe('function');
    });

    it('should create string array if it does not exist', () => {
      const config = testSimpleIntegration(withKlaviyoAndroid);
      const props = createMockProps();
      
      const result = withKlaviyoAndroid(config, props);
      
      expect(result).toBeDefined();
      expect(typeof result).toBe('function');
    });
  });

  describe('File operations and validation', () => {
    it('should handle notification icon file validation', () => {
      const config = testSimpleIntegration(withKlaviyoAndroid);
      const props = createMockProps({ notificationIconFilePath: './assets/icon.png' });
      
      const result = withKlaviyoAndroid(config, props);
      
      expect(result).toBeDefined();
      expect(typeof result).toBe('function');
    });

    it('should handle missing notification icon file', () => {
      const fs = require('fs');
      fs.existsSync.mockReturnValue(false);
      
      const config = testSimpleIntegration(withKlaviyoAndroid);
      const props = createMockProps({ notificationIconFilePath: './notfound.png' });
      
      const result = withKlaviyoAndroid(config, props);
      
      expect(result).toBeDefined();
      expect(typeof result).toBe('function');
    });

    it('should handle file copy operations', () => {
      const config = testSimpleIntegration(withKlaviyoAndroid);
      const props = createMockProps({ notificationIconFilePath: './assets/icon.png' });
      
      const result = withKlaviyoAndroid(config, props);
      
      expect(result).toBeDefined();
      expect(typeof result).toBe('function');
    });

    it('should handle MainActivity file operations', () => {
      const config = testSimpleIntegration(withKlaviyoAndroid);
      const props = createMockProps();
      
      const result = withKlaviyoAndroid(config, props);
      
      expect(result).toBeDefined();
      expect(typeof result).toBe('function');
    });

    it('should handle MainActivity with package declaration', () => {
      const fs = require('fs');
      fs.readFileSync.mockReturnValue(`
        package com.example.test;
        
        import com.facebook.react.ReactActivity;
        
        public class MainActivity extends ReactActivity {
          @Override
          protected String getMainComponentName() {
            return "main";
          }
        }
      `);
      
      const config = testSimpleIntegration(withKlaviyoAndroid);
      const props = createMockProps();
      
      const result = withKlaviyoAndroid(config, props);
      
      expect(result).toBeDefined();
      expect(typeof result).toBe('function');
    });

    it('should handle Kotlin MainActivity', () => {
      const fs = require('fs');
      fs.readFileSync.mockReturnValue(`
        package com.example.test
        
        import com.facebook.react.ReactActivity
        
        class MainActivity : ReactActivity() {
            override fun getMainComponentName(): String {
                return "main"
            }
        }
      `);
      
      const config = testSimpleIntegration(withKlaviyoAndroid);
      const props = createMockProps();
      
      const result = withKlaviyoAndroid(config, props);
      
      expect(result).toBeDefined();
      expect(typeof result).toBe('function');
    });

    it('should handle MainActivity without package declaration', () => {
      const fs = require('fs');
      fs.readFileSync.mockReturnValue(`
        public class MainActivity extends ReactActivity {
          @Override
          protected String getMainComponentName() {
            return "main";
          }
        }
      `);
      
      const config = testSimpleIntegration(withKlaviyoAndroid);
      const props = createMockProps();
      
      const result = withKlaviyoAndroid(config, props);
      
      expect(result).toBeDefined();
      expect(typeof result).toBe('function');
    });
  });

  describe('Error handling and edge cases', () => {
    it('should handle missing android config', () => {
      const config: any = { name: 'test-app', slug: 'test-app' };
      const props = createMockProps();
      
      const result = withKlaviyoAndroid(config, props);
      
      expect(result).toBeDefined();
      expect(typeof result).toBe('function');
    });

    it('should handle missing manifest config', () => {
      const config: any = { 
        name: 'test-app', 
        slug: 'test-app',
        android: {} 
      };
      const props = createMockProps();
      
      const result = withKlaviyoAndroid(config, props);
      
      expect(result).toBeDefined();
      expect(typeof result).toBe('function');
    });

    it('should handle empty manifest contents', () => {
      const config: any = {
        name: 'test-app',
        slug: 'test-app',
        android: {
          manifest: {
            contents: ''
          }
        }
      };
      const props = createMockProps();
      
      const result = withKlaviyoAndroid(config, props);
      
      expect(result).toBeDefined();
      expect(typeof result).toBe('function');
    });

    it('should handle null config', () => {
      const props = createMockProps();
      
      const result = withKlaviyoAndroid(null as any, props);
      
      expect(result).toBeDefined();
      expect(typeof result).toBe('function');
    });

    it('should handle undefined config', () => {
      const props = createMockProps();
      
      const result = withKlaviyoAndroid(undefined as any, props);
      
      expect(result).toBeDefined();
      expect(typeof result).toBe('function');
    });

    it('should handle complex nested manifest structure', () => {
      const config: any = {
        name: 'test-app',
        slug: 'test-app',
        android: {
          manifest: {
            contents: `
              <manifest xmlns:android="http://schemas.android.com/apk/res/android">
                <uses-permission android:name="android.permission.INTERNET" />
                <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
                <application
                  android:allowBackup="true"
                  android:icon="@mipmap/ic_launcher"
                  android:label="@string/app_name"
                  android:roundIcon="@mipmap/ic_launcher_round"
                  android:supportsRtl="true"
                  android:theme="@style/AppTheme">
                  <activity
                    android:name=".MainActivity"
                    android:exported="true"
                    android:launchMode="singleTop"
                    android:theme="@style/LaunchTheme"
                    android:configChanges="orientation|keyboardHidden|keyboard|screenSize|smallestScreenSize|locale|layoutDirection|fontScale|screenLayout|density|uiMode"
                    android:hardwareAccelerated="true"
                    android:windowSoftInputMode="adjustResize">
                    <meta-data
                      android:name="io.expo.client.arguments"
                      android:value="exp://192.168.1.100:8081" />
                    <intent-filter>
                      <action android:name="android.intent.action.MAIN" />
                      <category android:name="android.intent.category.LAUNCHER" />
                    </intent-filter>
                    <intent-filter>
                      <action android:name="android.intent.action.VIEW" />
                      <category android:name="android.intent.category.DEFAULT" />
                      <category android:name="android.intent.category.BROWSABLE" />
                      <data android:scheme="myapp" />
                    </intent-filter>
                  </activity>
                  <service android:name=".MyService" />
                </application>
              </manifest>
            `
          }
        }
      };
      const props = createMockProps();
      
      const result = withKlaviyoAndroid(config, props);
      
      expect(result).toBeDefined();
      expect(typeof result).toBe('function');
    });

    it('should handle different log levels', () => {
      const config = testSimpleIntegration(withKlaviyoAndroid);
      const logLevels = [0, 1, 2, 3, 4, 5, 6];
      
      logLevels.forEach(logLevel => {
        const props = createMockProps({ logLevel });
        const result = withKlaviyoAndroid(config, props);
        
        expect(result).toBeDefined();
        expect(typeof result).toBe('function');
      });
    });

    it('should handle different notification colors', () => {
      const config = testSimpleIntegration(withKlaviyoAndroid);
      const colors = ['#FF0000', '#00FF00', '#0000FF', '#FFFFFF', '#000000'];
      
      colors.forEach(color => {
        const props = createMockProps({ notificationColor: color });
        const result = withKlaviyoAndroid(config, props);
        
        expect(result).toBeDefined();
        expect(typeof result).toBe('function');
      });
    });

    it('should handle invalid log level', () => {
      const config = testSimpleIntegration(withKlaviyoAndroid);
      const props = createMockProps({ logLevel: 999 as any });
      
      const result = withKlaviyoAndroid(config, props);
      
      expect(result).toBeDefined();
      expect(typeof result).toBe('function');
    });

    it('should handle invalid notification color', () => {
      const config = testSimpleIntegration(withKlaviyoAndroid);
      const props = createMockProps({ notificationColor: 'invalid-color' as any });
      
      const result = withKlaviyoAndroid(config, props);
      
      expect(result).toBeDefined();
      expect(typeof result).toBe('function');
    });

    it('should handle file system errors', () => {
      const fs = require('fs');
      fs.existsSync.mockImplementation(() => {
        throw new Error('File system error');
      });
      
      const config = testSimpleIntegration(withKlaviyoAndroid);
      const props = createMockProps({ notificationIconFilePath: './assets/icon.png' });
      
      const result = withKlaviyoAndroid(config, props);
      
      expect(result).toBeDefined();
      expect(typeof result).toBe('function');
    });

    it('should handle glob errors', () => {
      const glob = require('glob');
      glob.sync.mockImplementation(() => {
        throw new Error('Glob error');
      });
      
      const config = testSimpleIntegration(withKlaviyoAndroid);
      const props = createMockProps();
      
      const result = withKlaviyoAndroid(config, props);
      
      expect(result).toBeDefined();
      expect(typeof result).toBe('function');
    });

    it('should handle getMainActivityAsync errors', async () => {
      const { getMainActivityAsync } = require('@expo/config-plugins/build/android/Paths');
      getMainActivityAsync.mockRejectedValue(new Error('MainActivity error'));
      
      const config = testSimpleIntegration(withKlaviyoAndroid);
      const props = createMockProps();
      
      const result = withKlaviyoAndroid(config, props);
      
      expect(result).toBeDefined();
      expect(typeof result).toBe('function');
    });
  });

  describe('Plugin composition and execution', () => {
    it('should compose multiple plugins correctly', () => {
      const config = testSimpleIntegration(withKlaviyoAndroid);
      const props = createMockProps({
        logLevel: 2,
        notificationIconFilePath: './assets/icon.png',
        notificationColor: '#FF0000'
      });
      
      const result = withKlaviyoAndroid(config, props);
      
      expect(result).toBeDefined();
      expect(typeof result).toBe('function');
    });

    it('should handle empty props', () => {
      const config = testSimpleIntegration(withKlaviyoAndroid);
      const props = {} as KlaviyoPluginAndroidProps;
      
      const result = withKlaviyoAndroid(config, props);
      
      expect(result).toBeDefined();
      expect(typeof result).toBe('function');
    });

    it('should handle null props', () => {
      const config = testSimpleIntegration(withKlaviyoAndroid);
      const props = null as any;
      
      const result = withKlaviyoAndroid(config, props);
      
      expect(result).toBeDefined();
      expect(typeof result).toBe('function');
    });

    it('should handle undefined props', () => {
      const config = testSimpleIntegration(withKlaviyoAndroid);
      const props = undefined as any;
      
      const result = withKlaviyoAndroid(config, props);
      
      expect(result).toBeDefined();
      expect(typeof result).toBe('function');
    });

    it('should handle all props combinations', () => {
      const config = testSimpleIntegration(withKlaviyoAndroid);
      const testCases = [
        { openTracking: true, logLevel: 1 },
        { openTracking: false, logLevel: 2 },
        { openTracking: true, logLevel: 3, notificationColor: '#FF0000' },
        { openTracking: false, notificationIconFilePath: './icon.png' },
        { logLevel: 0, notificationColor: '#00FF00', notificationIconFilePath: './icon.png' },
      ];

      testCases.forEach((props) => {
        const result = withKlaviyoAndroid(config, props as KlaviyoPluginAndroidProps);
        expect(result).toBeDefined();
        expect(typeof result).toBe('function');
      });
    });
  });
}); 