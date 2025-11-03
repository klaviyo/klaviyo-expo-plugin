// Mock xml2js module
jest.mock('xml2js', () => ({
  parseStringPromise: jest.fn().mockResolvedValue({
    resources: { color: [] }
  }),
  Builder: jest.fn().mockImplementation(() => ({
    buildObject: jest.fn().mockReturnValue('<resources><color name="klaviyo_notification_color">#FF0000</color></resources>')
  }))
}));

import { withNotificationIcon, withKlaviyoPluginNameVersion, modifyMainActivity } from '../plugin/withKlaviyoAndroid';
import { createMockConfig, createMockProps, testPluginFunction } from './utils/testHelpers';

// Mock file system operations
jest.mock('fs', () => ({
  existsSync: jest.fn(() => true),
  readFileSync: jest.fn(() => 'class MainActivity extends ReactActivity {}'),
  writeFileSync: jest.fn(),
  mkdirSync: jest.fn(),
  copyFileSync: jest.fn(),
  unlinkSync: jest.fn(),
  rmSync: jest.fn(),
}));

jest.mock('glob', () => ({
  sync: jest.fn(() => ['MainActivity.java']),
}));

jest.mock('@expo/config-plugins/build/android/Paths', () => ({
  getMainActivityAsync: jest.fn(() => Promise.resolve('/test/path/MainActivity.java')),
}));

// Mock path module to return predictable paths
jest.mock('path', () => ({
  resolve: jest.fn((...args) => args.join('/')),
  join: jest.fn((...args) => args.join('/')),
}));

describe('withKlaviyoAndroid Internal Functions', () => {
  describe('withNotificationIcon', () => {
    beforeEach(() => {
      const fs = require('fs');
      fs.rmSync = jest.fn(); // Ensure rmSync is always mocked
    });

    async function runMod(config, props) {
      const result = withNotificationIcon(config, props) as any;
      return await result.mods.android(result);
    }

    it('should copy the notification icon file', async () => {
      const fs = require('fs');
      fs.existsSync.mockReturnValue(true);
      const config = createMockConfig();
      const props = createMockProps({ notificationIconFilePath: './assets/icon.png' });
      await runMod(config, props);
      expect(fs.copyFileSync).toHaveBeenCalled();
    });

    it('should throw if notification icon file does not exist', async () => {
      const fs = require('fs');
      fs.existsSync.mockReturnValue(false);
      const config = createMockConfig();
      const props = createMockProps({ notificationIconFilePath: './notfound.png' });
      await expect(runMod(config, props)).rejects.toThrow('Notification icon file not found');
    });

    it('should create drawable directory if it does not exist', async () => {
      const fs = require('fs');
      // fs.existsSync returns true for the source path, false for drawable dir
      fs.existsSync.mockImplementation((path) => {
        if (!path) return false;
        if (path === '/test/project/./assets/icon.png') return true;
        if (path === '/test/project/root/app/src/main/res/drawable') return false;
        return false;
      });
      fs.mkdirSync.mockReset();
      fs.copyFileSync.mockReset();
      const config = createMockConfig();
      const props = createMockProps({ notificationIconFilePath: './assets/icon.png' });
      await runMod(config, props);
      expect(fs.mkdirSync).toHaveBeenCalledWith('/test/project/root/app/src/main/res/drawable', { recursive: true });
    });

    it('should throw if copyFileSync fails', async () => {
      const fs = require('fs');
      fs.existsSync.mockReturnValue(true);
      fs.copyFileSync.mockImplementation(() => { throw new Error('Copy failed'); });
      const config = createMockConfig();
      const props = createMockProps({ notificationIconFilePath: './assets/icon.png' });
      await expect(runMod(config, props)).rejects.toThrow('Failed to copy notification icon: Error: Copy failed');
    });

    it('should remove the notification icon file if no path is provided', async () => {
      const fs = require('fs');
      fs.existsSync.mockImplementation((path) => {
        if (!path) return false;
        if (path === '/test/project/root/app/src/main/res/drawable/notification_icon.png') return true;
        return false;
      });
      fs.unlinkSync.mockReset();
      const config = createMockConfig();
      const props = createMockProps({ notificationIconFilePath: undefined });
      await runMod(config, props);
      expect(fs.unlinkSync).toHaveBeenCalledWith('/test/project/root/app/src/main/res/drawable/notification_icon.png');
    });

    it('should call rmSync if file still exists after unlinkSync', async () => {
      const fs = require('fs');
      let exists = true;
      fs.existsSync.mockImplementation((path) => {
        if (!path) return false;
        if (path === '/test/project/root/app/src/main/res/drawable/notification_icon.png') return exists;
        return false;
      });
      fs.unlinkSync.mockImplementation(() => { exists = true; });
      fs.rmSync.mockImplementation(() => { exists = false; });
      const config = createMockConfig();
      const props = createMockProps({ notificationIconFilePath: undefined });
      await runMod(config, props);
      expect(fs.rmSync).toHaveBeenCalledWith('/test/project/root/app/src/main/res/drawable/notification_icon.png', { force: true });
    });

    it('should throw if both unlinkSync and rmSync fail', async () => {
      const fs = require('fs');
      fs.existsSync.mockImplementation((path) => {
        if (!path) return false;
        if (path === '/test/project/root/app/src/main/res/drawable/notification_icon.png') return true;
        return false;
      });
      fs.unlinkSync.mockImplementation(() => { throw new Error('unlink failed'); });
      fs.rmSync.mockImplementation(() => { throw new Error('rm failed'); });
      const config = createMockConfig();
      const props = createMockProps({ notificationIconFilePath: undefined });
      await expect(runMod(config, props)).rejects.toThrow('Failed to remove notification icon: Error: rm failed');
    });

    it('should log when no notification icon is found to remove', async () => {
      const fs = require('fs');
      const logger = require('../plugin/support/logger').KlaviyoLog;
      fs.existsSync.mockReturnValue(false);
      const config = createMockConfig();
      const props = createMockProps({ notificationIconFilePath: undefined });
      await runMod(config, props);
      expect(logger.log).toHaveBeenCalledWith('No notification icon found to remove');
    });

    it('should log expected messages', async () => {
      const logger = require('../plugin/support/logger').KlaviyoLog;
      logger.log.mockClear();
      const fs = require('fs');
      fs.existsSync.mockReturnValue(true);
      fs.copyFileSync.mockReset();
      fs.copyFileSync.mockImplementation(() => {}); // Ensure it does not throw
      fs.rmSync = jest.fn();
      const config = createMockConfig();
      const props = createMockProps({ notificationIconFilePath: './assets/icon.png' });
      await runMod(config, props);
      expect(logger.log).toHaveBeenCalledWith('Setting up notification icon handling...');
      expect(logger.log).toHaveBeenCalledWith('Executing notification icon handling...');
    });
  });

  describe('withKlaviyoPluginNameVersion', () => {
    it('should return a function', () => {
      const { result } = testPluginFunction(withKlaviyoPluginNameVersion);
      expect(typeof result).toBe('function');
    });

    it('should handle different config structures', () => {
      const configs = [
        createMockConfig(),
        createMockConfig({ android: {} }),
        createMockConfig({ android: { package: 'com.example.test' } as any }),
      ];
      
      configs.forEach(config => {
        const props = createMockProps();
        const result = withKlaviyoPluginNameVersion(config, props);
        expect(typeof result).toBe('function');
      });
    });

    it('should handle missing android config', () => {
      const { result } = testPluginFunction(withKlaviyoPluginNameVersion, { android: undefined });
      expect(typeof result).toBe('function');
    });

    it('should handle null config', () => {
      const config = null as any;
      const props = createMockProps();
      
      const result = withKlaviyoPluginNameVersion(config, props);
      expect(typeof result).toBe('function');
    });

    it('should handle undefined config', () => {
      const config = undefined as any;
      const props = createMockProps();
      
      const result = withKlaviyoPluginNameVersion(config, props);
      expect(typeof result).toBe('function');
    });

    // Additional comprehensive tests for actual execution behavior
    describe('execution behavior', () => {
      let mockWithStringsXml: jest.Mock;
      let mockConfig: any;
      let mockProps: any;

      beforeEach(() => {
        jest.clearAllMocks();
        mockWithStringsXml = require('@expo/config-plugins').withStringsXml;
        mockConfig = createMockConfig();
        mockProps = createMockProps();
      });

      it('should call withStringsXml with correct parameters', () => {
        withKlaviyoPluginNameVersion(mockConfig, mockProps);
        
        expect(mockWithStringsXml).toHaveBeenCalledWith(mockConfig, expect.any(Function));
      });

      it('should execute the withStringsXml modifier function', () => {
        const mockModifier = jest.fn();
        mockWithStringsXml.mockImplementation((config, modifier) => {
          mockModifier();
          return config;
        });

        withKlaviyoPluginNameVersion(mockConfig, mockProps);
        
        expect(mockModifier).toHaveBeenCalled();
      });

      it('should add klaviyo_sdk_plugin_name_override string resource', () => {
        const testConfig = {
          modResults: {
            resources: {
              string: []
            }
          }
        };

        mockWithStringsXml.mockImplementation((config, modifier) => {
          const result = modifier(testConfig);
          expect(result.modResults.resources.string).toContainEqual({
            $: { name: 'klaviyo_sdk_plugin_name_override' },
            _: 'klaviyo-expo'
          });
          return result;
        });

        withKlaviyoPluginNameVersion(mockConfig, mockProps);
      });

      it('should add klaviyo_sdk_plugin_version_override string resource', () => {
        const testConfig = {
          modResults: {
            resources: {
              string: []
            }
          }
        };

        mockWithStringsXml.mockImplementation((config, modifier) => {
          const result = modifier(testConfig);
          expect(result.modResults.resources.string).toContainEqual({
            $: { name: 'klaviyo_sdk_plugin_version_override' },
            _: '0.0.2'
          });
          return result;
        });

        withKlaviyoPluginNameVersion(mockConfig, mockProps);
      });

      it('should update existing string resources instead of adding duplicates', () => {
        const testConfig = {
          modResults: {
            resources: {
              string: [
                { $: { name: 'klaviyo_sdk_plugin_name_override' }, _: 'old_name' },
                { $: { name: 'klaviyo_sdk_plugin_version_override' }, _: 'old_version' }
              ]
            }
          }
        };

        mockWithStringsXml.mockImplementation((config, modifier) => {
          const result = modifier(testConfig);
          
          // Should update existing entries, not add new ones
          expect(result.modResults.resources.string).toHaveLength(2);
          expect(result.modResults.resources.string).toContainEqual({
            $: { name: 'klaviyo_sdk_plugin_name_override' },
            _: 'klaviyo-expo'
          });
          expect(result.modResults.resources.string).toContainEqual({
            $: { name: 'klaviyo_sdk_plugin_version_override' },
            _: '0.0.2'
          });
          
          return result;
        });

        withKlaviyoPluginNameVersion(mockConfig, mockProps);
      });

      it('should handle missing resources object', () => {
        const testConfig = {
          modResults: {}
        };

        mockWithStringsXml.mockImplementation((config, modifier) => {
          const result = modifier(testConfig);
          expect(result.modResults.resources.string).toBeDefined();
          expect(result.modResults.resources.string).toHaveLength(2);
          return result;
        });

        withKlaviyoPluginNameVersion(mockConfig, mockProps);
      });

      it('should handle missing string array', () => {
        const testConfig = {
          modResults: {
            resources: {}
          }
        };

        mockWithStringsXml.mockImplementation((config, modifier) => {
          const result = modifier(testConfig);
          expect(result.modResults.resources.string).toBeDefined();
          expect(result.modResults.resources.string).toHaveLength(2);
          return result;
        });

        withKlaviyoPluginNameVersion(mockConfig, mockProps);
      });

      it('should handle null string array', () => {
        const testConfig = {
          modResults: {
            resources: {
              string: null
            }
          }
        };

        mockWithStringsXml.mockImplementation((config, modifier) => {
          const result = modifier(testConfig);
          expect(result.modResults.resources.string).toBeDefined();
          expect(result.modResults.resources.string).toHaveLength(2);
          return result;
        });

        withKlaviyoPluginNameVersion(mockConfig, mockProps);
      });

      it('should handle undefined string array', () => {
        const testConfig = {
          modResults: {
            resources: {
              string: undefined
            }
          }
        };

        mockWithStringsXml.mockImplementation((config, modifier) => {
          const result = modifier(testConfig);
          expect(result.modResults.resources.string).toBeDefined();
          expect(result.modResults.resources.string).toHaveLength(2);
          return result;
        });

        withKlaviyoPluginNameVersion(mockConfig, mockProps);
      });

      it('should preserve existing string resources', () => {
        const testConfig = {
          modResults: {
            resources: {
              string: [
                { $: { name: 'existing_string' }, _: 'existing_value' },
                { $: { name: 'another_string' }, _: 'another_value' }
              ]
            }
          }
        };

        mockWithStringsXml.mockImplementation((config, modifier) => {
          const result = modifier(testConfig);
          
          // Should preserve existing strings and add the two Klaviyo strings
          expect(result.modResults.resources.string).toHaveLength(4);
          expect(result.modResults.resources.string).toContainEqual({
            $: { name: 'existing_string' },
            _: 'existing_value'
          });
          expect(result.modResults.resources.string).toContainEqual({
            $: { name: 'another_string' },
            _: 'another_value'
          });
          
          return result;
        });

        withKlaviyoPluginNameVersion(mockConfig, mockProps);
      });

      it('should handle malformed string resources gracefully', () => {
        const testConfig = {
          modResults: {
            resources: {
              string: [
                { $: { name: 'klaviyo_sdk_plugin_name_override' } }, // Missing _ property
                { name: 'malformed_string' }, // Missing $ property
                { $: { name: 'klaviyo_sdk_plugin_version_override' }, _: 'old_version' }
              ]
            }
          }
        };

        mockWithStringsXml.mockImplementation((config, modifier) => {
          const result = modifier(testConfig);
          
          // Should still add/update the Klaviyo strings correctly
          const nameString = result.modResults.resources.string.find(
            (s: any) => s.$?.name === 'klaviyo_sdk_plugin_name_override'
          );
          const versionString = result.modResults.resources.string.find(
            (s: any) => s.$?.name === 'klaviyo_sdk_plugin_version_override'
          );
          
          expect(nameString).toBeDefined();
          expect(nameString._).toBe('klaviyo-expo');
          expect(versionString).toBeDefined();
          expect(versionString._).toBe('0.0.2');
          
          return result;
        });

        withKlaviyoPluginNameVersion(mockConfig, mockProps);
      });

      it('should handle withStringsXml throwing an error', () => {
        mockWithStringsXml.mockImplementation(() => {
          throw new Error('withStringsXml error');
        });

        expect(() => {
          withKlaviyoPluginNameVersion(mockConfig, mockProps);
        }).toThrow('withStringsXml error');
      });

      it('should handle modifier function throwing an error', () => {
        mockWithStringsXml.mockImplementation((config, modifier) => {
          const testConfig = { modResults: { resources: { string: [] } } };
          modifier(testConfig); // This should not throw
          return config;
        });

        // Should not throw
        expect(() => {
          withKlaviyoPluginNameVersion(mockConfig, mockProps);
        }).not.toThrow();
      });
    });
  });

  describe('modifyMainActivity error handling', () => {
    const baseProps = createMockProps({ openTracking: true });

    it('throws if MainActivity has no package declaration', () => {
      const content = `public class MainActivity extends ReactActivity {}`;
      expect(() => modifyMainActivity('java', baseProps, content)).toThrow('Could not find package declaration in MainActivity');
    });

    it('throws if MainActivity has no class declaration', () => {
      const content = `package com.example.test;\n// no class here`;
      expect(() => modifyMainActivity('java', baseProps, content)).toThrow('Could not find MainActivity class declaration');
    });
  });

  describe('onCreate tracking functionality', () => {
    const baseProps = createMockProps({ openTracking: true });

    describe('Java MainActivity', () => {
      it('adds onCreate when it does not exist in Java MainActivity', () => {
        const javaMainActivity = `package com.example.test;

import com.facebook.react.ReactActivity;

public class MainActivity extends ReactActivity {
  @Override
  protected String getMainComponentName() {
    return "main";
  }
}`;

        const result = modifyMainActivity('java', baseProps, javaMainActivity);

        // Check that onCreate was added
        expect(result).toContain('protected void onCreate');
        expect(result).toContain('super.onCreate(savedInstanceState);');
        expect(result).toContain('Klaviyo.handlePush(getIntent());');
        expect(result).toContain('// Tracks when a system tray notification is opened while app is killed');
      });

      it('injects into existing onCreate in Java MainActivity', () => {
        const javaMainActivityWithOnCreate = `package com.example.test;

import com.facebook.react.ReactActivity;

public class MainActivity extends ReactActivity {
  @Override
  protected void onCreate(android.os.Bundle savedInstanceState) {
    setTheme(R.style.AppTheme);
    super.onCreate(savedInstanceState);
  }

  @Override
  protected String getMainComponentName() {
    return "main";
  }
}`;

        const result = modifyMainActivity('java', baseProps, javaMainActivityWithOnCreate);

        // Check that Klaviyo.handlePush was injected after super.onCreate
        expect(result).toContain('super.onCreate(savedInstanceState);');
        expect(result).toContain('Klaviyo.handlePush(getIntent());');
        expect(result).toContain('// @generated begin klaviyo-onCreate');
        expect(result).toContain('// @generated end klaviyo-onCreate');

        // Verify order: super.onCreate should come before Klaviyo.handlePush
        const superIndex = result.indexOf('super.onCreate(savedInstanceState);');
        const handlePushIndex = result.indexOf('Klaviyo.handlePush(getIntent());');
        expect(superIndex).toBeLessThan(handlePushIndex);
      });

      it('adds onNewIntent method in Java MainActivity', () => {
        const javaMainActivity = `package com.example.test;

import com.facebook.react.ReactActivity;

public class MainActivity extends ReactActivity {
  @Override
  protected String getMainComponentName() {
    return "main";
  }
}`;

        const result = modifyMainActivity('java', baseProps, javaMainActivity);

        // Check that onNewIntent was added
        expect(result).toContain('@Override');
        expect(result).toContain('public void onNewIntent(Intent intent)');
        expect(result).toContain('super.onNewIntent(intent);');
        expect(result).toContain('Klaviyo.handlePush(intent);');
        expect(result).toContain('// Tracks when a system tray notification is opened');
      });

      it('adds required imports in Java MainActivity', () => {
        const javaMainActivity = `package com.example.test;

import com.facebook.react.ReactActivity;

public class MainActivity extends ReactActivity {
  @Override
  protected String getMainComponentName() {
    return "main";
  }
}`;

        const result = modifyMainActivity('java', baseProps, javaMainActivity);

        // Check that imports were added
        expect(result).toContain('import android.content.Intent;');
        expect(result).toContain('import com.klaviyo.analytics.Klaviyo;');
      });
    });

    describe('Kotlin MainActivity', () => {
      it('adds onCreate when it does not exist in Kotlin MainActivity', () => {
        const kotlinMainActivity = `package com.example.test

import com.facebook.react.ReactActivity

class MainActivity : ReactActivity() {
    override fun getMainComponentName(): String {
        return "main"
    }
}`;

        const result = modifyMainActivity('kt', baseProps, kotlinMainActivity);

        // Check that onCreate was added
        expect(result).toContain('override fun onCreate');
        expect(result).toContain('super.onCreate(savedInstanceState)');
        expect(result).toContain('Klaviyo.handlePush(intent)');
        expect(result).toContain('// Tracks when a system tray notification is opened while app is killed');
      });

      it('injects into existing onCreate in Kotlin MainActivity', () => {
        const kotlinMainActivityWithOnCreate = `package com.example.test

import com.facebook.react.ReactActivity
import android.os.Bundle

class MainActivity : ReactActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        setTheme(R.style.AppTheme);
        super.onCreate(savedInstanceState)
    }

    override fun getMainComponentName(): String {
        return "main"
    }
}`;

        const result = modifyMainActivity('kt', baseProps, kotlinMainActivityWithOnCreate);

        // Check that Klaviyo.handlePush was injected after super.onCreate
        expect(result).toContain('super.onCreate(savedInstanceState)');
        expect(result).toContain('// @generated begin klaviyo-onCreate');
        expect(result).toContain('// @generated end klaviyo-onCreate');

        // Verify order: super.onCreate should come before the onCreate injection block
        const superIndex = result.indexOf('super.onCreate(savedInstanceState)');
        const onCreateBlockIndex = result.indexOf('// @generated begin klaviyo-onCreate');
        expect(superIndex).toBeLessThan(onCreateBlockIndex);

        // Verify the injected call is in the onCreate block (not just in onNewIntent method signature)
        const onCreateBlock = result.substring(
          result.indexOf('// @generated begin klaviyo-onCreate'),
          result.indexOf('// @generated end klaviyo-onCreate')
        );
        expect(onCreateBlock).toContain('Klaviyo.handlePush(intent)');
      });

      it('adds onNewIntent method in Kotlin MainActivity', () => {
        const kotlinMainActivity = `package com.example.test

import com.facebook.react.ReactActivity

class MainActivity : ReactActivity() {
    override fun getMainComponentName(): String {
        return "main"
    }
}`;

        const result = modifyMainActivity('kt', baseProps, kotlinMainActivity);

        // Check that onNewIntent was added
        expect(result).toContain('override fun onNewIntent(intent: Intent)');
        expect(result).toContain('super.onNewIntent(intent)');
        expect(result).toContain('Klaviyo.handlePush(intent)');
        expect(result).toContain('// Tracks when a system tray notification is opened');
      });

      it('adds required imports in Kotlin MainActivity', () => {
        const kotlinMainActivity = `package com.example.test

import com.facebook.react.ReactActivity

class MainActivity : ReactActivity() {
    override fun getMainComponentName(): String {
        return "main"
    }
}`;

        const result = modifyMainActivity('kt', baseProps, kotlinMainActivity);

        // Check that imports were added (Kotlin doesn't use semicolons)
        expect(result).toContain('import android.content.Intent');
        expect(result).toContain('import com.klaviyo.analytics.Klaviyo');
      });
    });

    describe('openTracking disabled', () => {
      it('removes onCreate injection when openTracking is disabled', () => {
        const javaMainActivityWithTracking = `package com.example.test;

import android.content.Intent;
import com.klaviyo.analytics.Klaviyo;
import com.facebook.react.ReactActivity;

public class MainActivity extends ReactActivity {
  // @generated begin klaviyo-imports - expo prebuild (DO NOT MODIFY) sync-hash
  // @generated end klaviyo-imports

  // @generated begin klaviyo-onNewIntent - expo prebuild (DO NOT MODIFY) sync-hash
  @Override
  public void onNewIntent(Intent intent) {
    super.onNewIntent(intent);
    Klaviyo.handlePush(intent);
  }
  // @generated end klaviyo-onNewIntent

  @Override
  protected void onCreate(android.os.Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    // @generated begin klaviyo-onCreate - expo prebuild (DO NOT MODIFY) sync-klaviyo-oncreate
    Klaviyo.handlePush(getIntent());
    // @generated end klaviyo-onCreate
  }
}`;

        const disabledProps = createMockProps({ openTracking: false });
        const result = modifyMainActivity('java', disabledProps, javaMainActivityWithTracking);

        // Check that Klaviyo code was removed
        expect(result).not.toContain('import android.content.Intent');
        expect(result).not.toContain('import com.klaviyo.analytics.Klaviyo');
        expect(result).not.toContain('Klaviyo.handlePush');
        expect(result).not.toContain('// @generated begin klaviyo-');
      });
    });

    describe('idempotency', () => {
      it('does not duplicate onCreate injection on multiple runs', () => {
        const javaMainActivityWithOnCreate = `package com.example.test;

import com.facebook.react.ReactActivity;

public class MainActivity extends ReactActivity {
  @Override
  protected void onCreate(android.os.Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
  }
}`;

        // Run twice
        const firstRunContent = modifyMainActivity('java', baseProps, javaMainActivityWithOnCreate);
        const secondRunContent = modifyMainActivity('java', baseProps, firstRunContent);

        // Count occurrences of the injection
        const handlePushMatches = (secondRunContent.match(/Klaviyo\.handlePush\(getIntent\(\)\);/g) || []).length;
        expect(handlePushMatches).toBe(1); // Should only appear once
      });
    });
  });

  describe('mutateNotificationManifest', () => {
    const { mutateNotificationManifest } = require('../plugin/withKlaviyoAndroid');
    const logger = require('../plugin/support/logger').KlaviyoLog;

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('adds notification icon meta-data when icon path is provided', () => {
      const config = createMockConfig({
        modResults: {
          manifest: {
            application: [{ $: { 'android:name': '.MainApplication' }, 'meta-data': [] }]
          }
        }
      });
      const props = createMockProps({ notificationIconFilePath: './icon.png', notificationColor: undefined });
      mutateNotificationManifest(config, props);
      const metaData = config.modResults.manifest.application[0]['meta-data'];
      expect(metaData.some(m => m.$['android:name'] === 'com.klaviyo.push.default_notification_icon')).toBe(true);
      expect(logger.log).toHaveBeenCalledWith('Adding notification icon meta-data: ./icon.png');
    });

    it('removes notification icon meta-data when icon path is not provided', () => {
      const config = createMockConfig({
        modResults: {
          manifest: {
            application: [{ $: { 'android:name': '.MainApplication' }, 'meta-data': [{ $: { 'android:name': 'com.klaviyo.push.default_notification_icon' } }] }]
          }
        }
      });
      const props = createMockProps({ notificationIconFilePath: undefined, notificationColor: undefined });
      mutateNotificationManifest(config, props);
      const metaData = config.modResults.manifest.application[0]['meta-data'];
      expect(metaData.some(m => m.$['android:name'] === 'com.klaviyo.push.default_notification_icon')).toBe(false);
      expect(logger.log).toHaveBeenCalledWith('Removing notification icon meta-data');
    });

    it('does not duplicate icon meta-data if already present', () => {
      const config = createMockConfig({
        modResults: {
          manifest: {
            application: [{ $: { 'android:name': '.MainApplication' }, 'meta-data': [{ $: { 'android:name': 'com.klaviyo.push.default_notification_icon' } }] }]
          }
        }
      });
      const props = createMockProps({ notificationIconFilePath: './icon.png', notificationColor: undefined });
      mutateNotificationManifest(config, props);
      const metaData = config.modResults.manifest.application[0]['meta-data'];
      expect(metaData.filter(m => m.$['android:name'] === 'com.klaviyo.push.default_notification_icon').length).toBe(1);
      expect(logger.log).toHaveBeenCalledWith('Icon meta-data already exists, skipping');
    });

    it('adds notification color meta-data when color is provided', () => {
      const config = createMockConfig({
        modResults: {
          manifest: {
            application: [{ $: { 'android:name': '.MainApplication' }, 'meta-data': [] }]
          }
        }
      });
      const props = createMockProps({ notificationIconFilePath: undefined, notificationColor: '#FF0000' });
      mutateNotificationManifest(config, props);
      const metaData = config.modResults.manifest.application[0]['meta-data'];
      expect(metaData.some(m => m.$['android:name'] === 'com.klaviyo.push.default_notification_color')).toBe(true);
      expect(logger.log).toHaveBeenCalledWith('Adding notification color meta-data: #FF0000');
    });

    it('removes notification color meta-data when color is not provided', () => {
      const config = createMockConfig({
        modResults: {
          manifest: {
            application: [{ $: { 'android:name': '.MainApplication' }, 'meta-data': [{ $: { 'android:name': 'com.klaviyo.push.default_notification_color' } }] }]
          }
        }
      });
      const props = createMockProps({ notificationIconFilePath: undefined, notificationColor: undefined });
      mutateNotificationManifest(config, props);
      const metaData = config.modResults.manifest.application[0]['meta-data'];
      expect(metaData.some(m => m.$['android:name'] === 'com.klaviyo.push.default_notification_color')).toBe(false);
      expect(logger.log).toHaveBeenCalledWith('Removing notification color meta-data');
    });

    it('does not duplicate color meta-data if already present', () => {
      const config = createMockConfig({
        modResults: {
          manifest: {
            application: [{ $: { 'android:name': '.MainApplication' }, 'meta-data': [{ $: { 'android:name': 'com.klaviyo.push.default_notification_color' } }] }]
          }
        }
      });
      const props = createMockProps({ notificationIconFilePath: undefined, notificationColor: '#FF0000' });
      mutateNotificationManifest(config, props);
      const metaData = config.modResults.manifest.application[0]['meta-data'];
      expect(metaData.filter(m => m.$['android:name'] === 'com.klaviyo.push.default_notification_color').length).toBe(1);
      expect(logger.log).toHaveBeenCalledWith('Color meta-data already exists, skipping');
    });

    it('creates application and meta-data if missing', () => {
      const config = createMockConfig({
        modResults: {
          manifest: {}
        }
      });
      const props = createMockProps({ notificationIconFilePath: './icon.png', notificationColor: '#FF0000' });
      mutateNotificationManifest(config, props);
      expect(config.modResults.manifest.application).toBeDefined();
      expect(config.modResults.manifest.application[0]['meta-data']).toBeDefined();
      expect(logger.log).toHaveBeenCalledWith('No application tag found, creating one...');
    });

    it('handles both icon and color meta-data together', () => {
      const config = createMockConfig({
        modResults: {
          manifest: {
            application: [{ $: { 'android:name': '.MainApplication' }, 'meta-data': [] }]
          }
        }
      });
      const props = createMockProps({ notificationIconFilePath: './icon.png', notificationColor: '#FF0000' });
      mutateNotificationManifest(config, props);
      const metaData = config.modResults.manifest.application[0]['meta-data'];
      expect(metaData.some(m => m.$['android:name'] === 'com.klaviyo.push.default_notification_icon')).toBe(true);
      expect(metaData.some(m => m.$['android:name'] === 'com.klaviyo.push.default_notification_color')).toBe(true);
      expect(metaData.length).toBe(2);
    });

    it('preserves existing meta-data when adding new ones', () => {
      const config = createMockConfig({
        modResults: {
          manifest: {
            application: [{ 
              $: { 'android:name': '.MainApplication' }, 
              'meta-data': [{ $: { 'android:name': 'existing_meta' } }] 
            }]
          }
        }
      });
      const props = createMockProps({ notificationIconFilePath: './icon.png', notificationColor: '#FF0000' });
      mutateNotificationManifest(config, props);
      const metaData = config.modResults.manifest.application[0]['meta-data'];
      expect(metaData.some(m => m.$['android:name'] === 'existing_meta')).toBe(true);
      expect(metaData.some(m => m.$['android:name'] === 'com.klaviyo.push.default_notification_icon')).toBe(true);
      expect(metaData.some(m => m.$['android:name'] === 'com.klaviyo.push.default_notification_color')).toBe(true);
      expect(metaData.length).toBe(3);
    });

    it('handles empty string values for icon path and color', () => {
      const config = createMockConfig({
        modResults: {
          manifest: {
            application: [{ 
              $: { 'android:name': '.MainApplication' }, 
              'meta-data': [
                { $: { 'android:name': 'com.klaviyo.push.default_notification_icon' } },
                { $: { 'android:name': 'com.klaviyo.push.default_notification_color' } }
              ] 
            }]
          }
        }
      });
      const props = createMockProps({ notificationIconFilePath: '', notificationColor: '' });
      mutateNotificationManifest(config, props);
      const metaData = config.modResults.manifest.application[0]['meta-data'];
      expect(metaData.some(m => m.$['android:name'] === 'com.klaviyo.push.default_notification_icon')).toBe(false);
      expect(metaData.some(m => m.$['android:name'] === 'com.klaviyo.push.default_notification_color')).toBe(false);
      expect(metaData.length).toBe(0);
    });
  });

  describe('mutateAndroidManifest', () => {
    const { mutateAndroidManifest } = require('../plugin/withKlaviyoAndroid');
    const logger = require('../plugin/support/logger').KlaviyoLog;

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('creates application tag if missing', () => {
      const config = createMockConfig({
        modResults: {
          manifest: {}
        }
      });
      const props = createMockProps({ logLevel: 2 });
      mutateAndroidManifest(config, props);
      expect(config.modResults.manifest.application).toBeDefined();
      expect(config.modResults.manifest.application[0].$['android:name']).toBe('.MainApplication');
      expect(logger.log).toHaveBeenCalledWith('Creating application tag in manifest');
    });

    it('creates meta-data array if missing', () => {
      const config = createMockConfig({
        modResults: {
          manifest: {
            application: [{ $: { 'android:name': '.MainApplication' } }]
          }
        }
      });
      const props = createMockProps({ logLevel: 2 });
      mutateAndroidManifest(config, props);
      expect(config.modResults.manifest.application[0]['meta-data']).toBeDefined();
      expect(logger.log).toHaveBeenCalledWith('No meta-data array found, creating one...');
    });

    it('sets log level with provided value', () => {
      const config = createMockConfig({
        modResults: {
          manifest: {
            application: [{ $: { 'android:name': '.MainApplication' }, 'meta-data': [] }]
          }
        }
      });
      const props = createMockProps({ logLevel: 3 });
      mutateAndroidManifest(config, props);
      const metaData = config.modResults.manifest.application[0]['meta-data'];
      expect(metaData.some(m => m.$['android:name'] === 'com.klaviyo.core.log_level' && m.$['android:value'] === '3')).toBe(true);
      expect(logger.log).toHaveBeenCalledWith('Setting Klaviyo log level to 3');
    });

    it('uses default log level when not provided', () => {
      const config = createMockConfig({
        modResults: {
          manifest: {
            application: [{ $: { 'android:name': '.MainApplication' }, 'meta-data': [] }]
          }
        }
      });
      const props = createMockProps({ logLevel: undefined });
      mutateAndroidManifest(config, props);
      const metaData = config.modResults.manifest.application[0]['meta-data'];
      expect(metaData.some(m => m.$['android:name'] === 'com.klaviyo.core.log_level' && m.$['android:value'] === '1')).toBe(true);
      expect(logger.log).toHaveBeenCalledWith('Setting Klaviyo log level to 1');
    });

    it('removes existing log level entries before adding new one', () => {
      const config = createMockConfig({
        modResults: {
          manifest: {
            application: [{ 
              $: { 'android:name': '.MainApplication' }, 
              'meta-data': [
                { $: { 'android:name': 'com.klaviyo.core.log_level', 'android:value': '2' } },
                { $: { 'android:name': 'com.klaviyo.android.log_level', 'android:value': '3' } },
                { $: { 'android:name': 'other_meta', 'android:value': 'other_value' } }
              ] 
            }]
          }
        }
      });
      const props = createMockProps({ logLevel: 4 });
      mutateAndroidManifest(config, props);
      const metaData = config.modResults.manifest.application[0]['meta-data'];
      expect(metaData.filter(m => m.$['android:name'] === 'com.klaviyo.core.log_level').length).toBe(1);
      expect(metaData.filter(m => m.$['android:name'] === 'com.klaviyo.android.log_level').length).toBe(0);
      expect(metaData.some(m => m.$['android:name'] === 'other_meta')).toBe(true);
    });

    it('creates service array if missing', () => {
      const config = createMockConfig({
        modResults: {
          manifest: {
            application: [{ $: { 'android:name': '.MainApplication' }, 'meta-data': [] }]
          }
        }
      });
      const props = createMockProps({ logLevel: 2 });
      mutateAndroidManifest(config, props);
      expect(config.modResults.manifest.application[0].service).toBeDefined();
    });

    it('adds KlaviyoPushService if not present', () => {
      const config = createMockConfig({
        modResults: {
          manifest: {
            application: [{ $: { 'android:name': '.MainApplication' }, 'meta-data': [], service: [] }]
          }
        }
      });
      const props = createMockProps({ logLevel: 2 });
      mutateAndroidManifest(config, props);
      const services = config.modResults.manifest.application[0].service;
      expect(services.some(s => s.$['android:name'] === 'com.klaviyo.pushFcm.KlaviyoPushService')).toBe(true);
      expect(logger.log).toHaveBeenCalledWith('Adding KlaviyoPushService to manifest');
    });

    it('does not duplicate KlaviyoPushService if already present', () => {
      const existingService = {
        $: {
          'android:name': 'com.klaviyo.pushFcm.KlaviyoPushService',
          'android:exported': 'false'
        },
        'intent-filter': [{
          action: [{
            $: {
              'android:name': 'com.google.firebase.MESSAGING_EVENT'
            }
          }]
        }]
      };
      const config = createMockConfig({
        modResults: {
          manifest: {
            application: [{ 
              $: { 'android:name': '.MainApplication' }, 
              'meta-data': [], 
              service: [existingService] 
            }]
          }
        }
      });
      const props = createMockProps({ logLevel: 2 });
      mutateAndroidManifest(config, props);
      const services = config.modResults.manifest.application[0].service;
      expect(services.filter(s => s.$['android:name'] === 'com.klaviyo.pushFcm.KlaviyoPushService').length).toBe(1);
    });

    it('preserves existing services when adding KlaviyoPushService', () => {
      const existingService = {
        $: {
          'android:name': 'com.example.OtherService',
          'android:exported': 'true'
        }
      };
      const config = createMockConfig({
        modResults: {
          manifest: {
            application: [{ 
              $: { 'android:name': '.MainApplication' }, 
              'meta-data': [], 
              service: [existingService] 
            }]
          }
        }
      });
      const props = createMockProps({ logLevel: 2 });
      mutateAndroidManifest(config, props);
      const services = config.modResults.manifest.application[0].service;
      expect(services.some(s => s.$['android:name'] === 'com.example.OtherService')).toBe(true);
      expect(services.some(s => s.$['android:name'] === 'com.klaviyo.pushFcm.KlaviyoPushService')).toBe(true);
      expect(services.length).toBe(2);
    });

    it('handles complete manifest modification with all features', () => {
      const config = createMockConfig({
        modResults: {
          manifest: {}
        }
      });
      const props = createMockProps({ logLevel: 5 });
      mutateAndroidManifest(config, props);
      
      const application = config.modResults.manifest.application[0];
      expect(application.$['android:name']).toBe('.MainApplication');
      expect(application['meta-data']).toBeDefined();
      expect(application.service).toBeDefined();
      
      const metaData = application['meta-data'];
      expect(metaData.some(m => m.$['android:name'] === 'com.klaviyo.core.log_level' && m.$['android:value'] === '5')).toBe(true);
      
      const services = application.service;
      expect(services.some(s => s.$['android:name'] === 'com.klaviyo.pushFcm.KlaviyoPushService')).toBe(true);
      
      expect(logger.log).toHaveBeenCalledWith('Modifying Android Manifest');
      expect(logger.log).toHaveBeenCalledWith('Creating application tag in manifest');
      expect(logger.log).toHaveBeenCalledWith('No meta-data array found, creating one...');
      expect(logger.log).toHaveBeenCalledWith('Setting Klaviyo log level to 5');
      expect(logger.log).toHaveBeenCalledWith('Adding KlaviyoPushService to manifest');
    });

    it('handles zero log level', () => {
      const config = createMockConfig({
        modResults: {
          manifest: {
            application: [{ $: { 'android:name': '.MainApplication' }, 'meta-data': [] }]
          }
        }
      });
      const props = createMockProps({ logLevel: 0 });
      mutateAndroidManifest(config, props);
      const metaData = config.modResults.manifest.application[0]['meta-data'];
      expect(metaData.some(m => m.$['android:name'] === 'com.klaviyo.core.log_level' && m.$['android:value'] === '0')).toBe(true);
      expect(logger.log).toHaveBeenCalledWith('Setting Klaviyo log level to 0');
    });

    it('handles null log level', () => {
      const config = createMockConfig({
        modResults: {
          manifest: {
            application: [{ $: { 'android:name': '.MainApplication' }, 'meta-data': [] }]
          }
        }
      });
      const props = createMockProps({ logLevel: null as any });
      mutateAndroidManifest(config, props);
      const metaData = config.modResults.manifest.application[0]['meta-data'];
      expect(metaData.some(m => m.$['android:name'] === 'com.klaviyo.core.log_level' && m.$['android:value'] === '1')).toBe(true);
      expect(logger.log).toHaveBeenCalledWith('Setting Klaviyo log level to 1');
    });
  });
}); 