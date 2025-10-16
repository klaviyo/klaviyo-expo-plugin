// Mock xml2js module
jest.mock('xml2js', () => ({
  parseStringPromise: jest.fn().mockResolvedValue({
    resources: { color: [] }
  }),
  Builder: jest.fn().mockImplementation(() => ({
    buildObject: jest.fn().mockReturnValue('<resources><color name="klaviyo_notification_color">#FF0000</color></resources>')
  }))
}));

import { findMainActivity, withMainActivityModifications, withNotificationIcon, withKlaviyoPluginNameVersion, modifyMainActivity } from '../plugin/withKlaviyoAndroid';
import { executePlugin, createMockConfig, createMockProps, testPluginFunction } from './utils/testHelpers';

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
  describe('findMainActivity', () => {
    it('should find MainActivity using Expo detection', async () => {
      // Ensure the test config has a valid platformProjectRoot
      const config = createMockConfig({
        modRequest: { platformProjectRoot: '/test/project/root' }
      });

      const result = await findMainActivity(config.modRequest.platformProjectRoot);
      expect(result).toBeDefined();
      expect(result?.path).toBe('/test/path/MainActivity.java');
      expect(result?.isKotlin).toBe(false);
    });

    it('should return null when no MainActivity is found', async () => {
      const fs = require('fs');
      fs.existsSync.mockReturnValue(false);
      
      const result = await findMainActivity('/test/project/root');
      expect(result).toBeNull();
    });
  });

  describe('withMainActivityModifications', () => {
    it('should return a function', () => {
      const { result } = testPluginFunction(withMainActivityModifications, {}, { openTracking: true }, 'mods.android');
      expect(result).toHaveProperty('mods.android');
    });

    it('should handle missing android package', () => {
      const { result } = testPluginFunction(withMainActivityModifications, { android: {} }, { openTracking: true }, 'mods.android');
      expect(result).toHaveProperty('mods.android');
    });

    it('should handle missing MainActivity', () => {
      const fs = require('fs');
      fs.existsSync.mockReturnValue(false);
      
      const { result } = testPluginFunction(withMainActivityModifications, {}, { openTracking: true }, 'mods.android');
      expect(result).toHaveProperty('mods.android');
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
      
      const { result } = testPluginFunction(withMainActivityModifications, {}, { openTracking: true }, 'mods.android');
      expect(result).toHaveProperty('mods.android');
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
      
      const { result } = testPluginFunction(withMainActivityModifications, {}, { openTracking: true }, 'mods.android');
      expect(result).toHaveProperty('mods.android');
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
      
      const { result } = testPluginFunction(withMainActivityModifications, {}, { openTracking: true }, 'mods.android');
      expect(result).toHaveProperty('mods.android');
    });

    it('should handle openTracking disabled', () => {
      const { result } = testPluginFunction(withMainActivityModifications, {}, { openTracking: false }, 'mods.android');
      expect(result).toHaveProperty('mods.android');
    });

    // Error condition tests
    describe('error conditions', () => {
      it('should handle missing android package in config', () => {
        const { result } = testPluginFunction(withMainActivityModifications, { android: undefined }, { openTracking: true }, 'mods.android');
        expect(result).toHaveProperty('mods.android');
      });

      it('should handle null android package in config', () => {
        const { result } = testPluginFunction(withMainActivityModifications, { android: null as any }, { openTracking: true }, 'mods.android');
        expect(result).toHaveProperty('mods.android');
      });

      it('should handle empty android object in config', () => {
        const { result } = testPluginFunction(withMainActivityModifications, { android: {} }, { openTracking: true }, 'mods.android');
        expect(result).toHaveProperty('mods.android');
      });

      it('should handle missing MainActivity detection', () => {
        const fs = require('fs');
        const { getMainActivityAsync } = require('@expo/config-plugins/build/android/Paths');
        
        // Mock that no MainActivity is found
        getMainActivityAsync.mockRejectedValue(new Error('Not found'));
        fs.existsSync.mockReturnValue(false);
        
        const config = createMockConfig();
        const props = createMockProps({ openTracking: true });
        
        const result = withMainActivityModifications(config, props);
        expect(result).toHaveProperty('mods.android');
      });

      it('should handle MainActivity file not existing', () => {
        const fs = require('fs');
        const { getMainActivityAsync } = require('@expo/config-plugins/build/android/Paths');
        
        // Mock that MainActivity is found but file doesn't exist
        getMainActivityAsync.mockResolvedValue('/test/path/MainActivity.java');
        fs.existsSync.mockImplementation((path) => path && !path.includes('MainActivity'));
        
        const config = createMockConfig();
        const props = createMockProps({ openTracking: true });
        
        const result = withMainActivityModifications(config, props);
        expect(result).toHaveProperty('mods.android');
      });

      it('should handle MainActivity without package declaration', () => {
        const fs = require('fs');
        const { getMainActivityAsync } = require('@expo/config-plugins/build/android/Paths');
        
        // Mock that MainActivity is found and exists
        getMainActivityAsync.mockResolvedValue('/test/path/MainActivity.java');
        fs.existsSync.mockReturnValue(true);
        
        // Mock file content without package declaration
        fs.readFileSync.mockReturnValue(`
          import com.facebook.react.ReactActivity;
          
          public class MainActivity extends ReactActivity {
            @Override
            protected String getMainComponentName() {
              return "main";
            }
          }
        `);
        
        const config = createMockConfig();
        const props = createMockProps({ openTracking: true });
        
        const result = withMainActivityModifications(config, props);
        expect(result).toHaveProperty('mods.android');
      });

      it('should handle MainActivity without class declaration', () => {
        const fs = require('fs');
        const { getMainActivityAsync } = require('@expo/config-plugins/build/android/Paths');
        
        // Mock that MainActivity is found and exists
        getMainActivityAsync.mockResolvedValue('/test/path/MainActivity.java');
        fs.existsSync.mockReturnValue(true);
        
        // Mock file content with package but no class declaration
        fs.readFileSync.mockReturnValue(`
          package com.example.test;
          
          import com.facebook.react.ReactActivity;
          
          // No class declaration here
        `);
        
        const config = createMockConfig();
        const props = createMockProps({ openTracking: true });
        
        const result = withMainActivityModifications(config, props);
        expect(result).toHaveProperty('mods.android');
      });

      it('should handle MainActivity with different class name', () => {
        const fs = require('fs');
        const { getMainActivityAsync } = require('@expo/config-plugins/build/android/Paths');
        
        // Mock that MainActivity is found and exists
        getMainActivityAsync.mockResolvedValue('/test/path/MainActivity.java');
        fs.existsSync.mockReturnValue(true);
        
        // Mock file content with different class name
        fs.readFileSync.mockReturnValue(`
          package com.example.test;
          
          import com.facebook.react.ReactActivity;
          
          public class MyActivity extends ReactActivity {
            @Override
            protected String getMainComponentName() {
              return "main";
            }
          }
        `);
        
        const config = createMockConfig();
        const props = createMockProps({ openTracking: true });
        
        const result = withMainActivityModifications(config, props);
        expect(result).toHaveProperty('mods.android');
      });

      it('should handle MainActivity not extending ReactActivity', () => {
        const fs = require('fs');
        const { getMainActivityAsync } = require('@expo/config-plugins/build/android/Paths');
        
        // Mock that MainActivity is found and exists
        getMainActivityAsync.mockResolvedValue('/test/path/MainActivity.java');
        fs.existsSync.mockReturnValue(true);
        
        // Mock file content where MainActivity doesn't extend ReactActivity
        fs.readFileSync.mockReturnValue(`
          package com.example.test;
          
          import com.facebook.react.ReactActivity;
          
          public class MainActivity {
            // Does not extend ReactActivity
          }
        `);
        
        const config = createMockConfig();
        const props = createMockProps({ openTracking: true });
        
        const result = withMainActivityModifications(config, props);
        expect(result).toHaveProperty('mods.android');
      });
    });
  });

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

  describe('Additional test scenarios', () => {
    it('should handle different file naming conventions', async () => {
      const { getMainActivityAsync } = require('@expo/config-plugins/build/android/Paths');
      getMainActivityAsync.mockRejectedValue(new Error('Not found'));
      
      const fs = require('fs');
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue('class MainActivity extends ReactActivity {}');
      
      const glob = require('glob');
      const fileNames = ['MainActivity.java', 'MainActivity.kt', 'MainActivity.java', 'MainActivity.kt'];
      
      for (const fileName of fileNames) {
        glob.sync.mockReturnValue([fileName]);
        const result = await findMainActivity('/test/project/root');
        expect(result).toBeDefined();
      }
    });

    it('should handle MainActivity with different class declarations', async () => {
      const { getMainActivityAsync } = require('@expo/config-plugins/build/android/Paths');
      getMainActivityAsync.mockRejectedValue(new Error('Not found'));
      
      const fs = require('fs');
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue('public class MainActivity extends ReactActivity {}');
      
      const result = await findMainActivity('/test/project/root');
      expect(result).toBeDefined();
    });

    it('should handle MainActivity with additional attributes', async () => {
      const { getMainActivityAsync } = require('@expo/config-plugins/build/android/Paths');
      getMainActivityAsync.mockRejectedValue(new Error('Not found'));
      
      const fs = require('fs');
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(`
        @Override
        public class MainActivity extends ReactActivity {
          protected String getMainComponentName() {
            return "main";
          }
        }
      `);
      
      const result = await findMainActivity('/test/project/root');
      expect(result).toBeDefined();
    });
  });

  describe('modifyMainActivity error handling', () => {
    const fs = require('fs');
    const baseConfig = createMockConfig();
    const baseProps = createMockProps({ openTracking: true });

    beforeEach(() => {
      jest.clearAllMocks();
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(`package com.example.test;\npublic class MainActivity extends ReactActivity {}`);
    });

    it('throws if android.package is missing', async () => {
      const config = { ...baseConfig, android: undefined };
      await expect(modifyMainActivity(config, baseProps)).rejects.toThrow('Android package not found in app config');
    });

    it('throws if mainActivityInfo is null', async () => {
      const mockFindMainActivity = jest.fn().mockResolvedValue(null);
      const config = { ...baseConfig };
      await expect(modifyMainActivity(config, baseProps, mockFindMainActivity)).rejects.toThrow('Could not find main activity file. Please ensure your app has a valid ReactActivity.');
    });

    it('throws if MainActivity file does not exist', async () => {
      const mockFindMainActivity = jest.fn().mockResolvedValue({ path: '/test/path/MainActivity.java', isKotlin: false });
      fs.existsSync.mockReturnValue(false);
      await expect(modifyMainActivity(baseConfig, baseProps, mockFindMainActivity)).rejects.toThrow('MainActivity not found at path: /test/path/MainActivity.java');
    });

    it('throws if MainActivity has no package declaration', async () => {
      const mockFindMainActivity = jest.fn().mockResolvedValue({ path: '/test/path/MainActivity.java', isKotlin: false });
      fs.readFileSync.mockReturnValue(`public class MainActivity extends ReactActivity {}`);
      await expect(modifyMainActivity(baseConfig, baseProps, mockFindMainActivity)).rejects.toThrow('Could not find package declaration in MainActivity');
    });

    it('throws if MainActivity has no class declaration', async () => {
      const mockFindMainActivity = jest.fn().mockResolvedValue({ path: '/test/path/MainActivity.java', isKotlin: false });
      fs.readFileSync.mockReturnValue(`package com.example.test;\n// no class here`);
      await expect(modifyMainActivity(baseConfig, baseProps, mockFindMainActivity)).rejects.toThrow('Could not find MainActivity class declaration');
    });
  });

  describe('onCreate tracking functionality', () => {
    const fs = require('fs');
    const baseConfig = createMockConfig();
    const baseProps = createMockProps({ openTracking: true });

    beforeEach(() => {
      jest.clearAllMocks();
      fs.existsSync.mockReturnValue(true);
      fs.writeFileSync.mockClear();
    });

    describe('Java MainActivity', () => {
      it('adds onCreate when it does not exist in Java MainActivity', async () => {
        const javaMainActivity = `package com.example.test;

import com.facebook.react.ReactActivity;

public class MainActivity extends ReactActivity {
  @Override
  protected String getMainComponentName() {
    return "main";
  }
}`;

        const mockFindMainActivity = jest.fn().mockResolvedValue({ path: '/test/MainActivity.java', isKotlin: false });
        fs.readFileSync.mockReturnValue(javaMainActivity);

        await modifyMainActivity(baseConfig, baseProps, mockFindMainActivity);

        expect(fs.writeFileSync).toHaveBeenCalled();
        const writtenContent = fs.writeFileSync.mock.calls[0][1];

        // Check that onCreate was added
        expect(writtenContent).toContain('protected void onCreate');
        expect(writtenContent).toContain('super.onCreate(savedInstanceState);');
        expect(writtenContent).toContain('onNewIntent(getIntent());');
        expect(writtenContent).toContain('// Tracks when a system tray notification is opened while app is killed');
      });

      it('injects into existing onCreate in Java MainActivity', async () => {
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

        const mockFindMainActivity = jest.fn().mockResolvedValue({ path: '/test/MainActivity.java', isKotlin: false });
        fs.readFileSync.mockReturnValue(javaMainActivityWithOnCreate);

        await modifyMainActivity(baseConfig, baseProps, mockFindMainActivity);

        expect(fs.writeFileSync).toHaveBeenCalled();
        const writtenContent = fs.writeFileSync.mock.calls[0][1];

        // Check that onNewIntent was injected after super.onCreate
        expect(writtenContent).toContain('super.onCreate(savedInstanceState);');
        expect(writtenContent).toContain('onNewIntent(getIntent());');
        expect(writtenContent).toContain('// @generated begin klaviyo-onCreate');
        expect(writtenContent).toContain('// @generated end klaviyo-onCreate');

        // Verify order: super.onCreate should come before onNewIntent
        const superIndex = writtenContent.indexOf('super.onCreate(savedInstanceState);');
        const onNewIntentIndex = writtenContent.indexOf('onNewIntent(getIntent());');
        expect(superIndex).toBeLessThan(onNewIntentIndex);
      });

      it('adds onNewIntent method in Java MainActivity', async () => {
        const javaMainActivity = `package com.example.test;

import com.facebook.react.ReactActivity;

public class MainActivity extends ReactActivity {
  @Override
  protected String getMainComponentName() {
    return "main";
  }
}`;

        const mockFindMainActivity = jest.fn().mockResolvedValue({ path: '/test/MainActivity.java', isKotlin: false });
        fs.readFileSync.mockReturnValue(javaMainActivity);

        await modifyMainActivity(baseConfig, baseProps, mockFindMainActivity);

        expect(fs.writeFileSync).toHaveBeenCalled();
        const writtenContent = fs.writeFileSync.mock.calls[0][1];

        // Check that onNewIntent was added
        expect(writtenContent).toContain('@Override');
        expect(writtenContent).toContain('public void onNewIntent(Intent intent)');
        expect(writtenContent).toContain('super.onNewIntent(intent);');
        expect(writtenContent).toContain('Klaviyo.handlePush(intent);');
        expect(writtenContent).toContain('// Tracks when a system tray notification is opened');
      });

      it('adds required imports in Java MainActivity', async () => {
        const javaMainActivity = `package com.example.test;

import com.facebook.react.ReactActivity;

public class MainActivity extends ReactActivity {
  @Override
  protected String getMainComponentName() {
    return "main";
  }
}`;

        const mockFindMainActivity = jest.fn().mockResolvedValue({ path: '/test/MainActivity.java', isKotlin: false });
        fs.readFileSync.mockReturnValue(javaMainActivity);

        await modifyMainActivity(baseConfig, baseProps, mockFindMainActivity);

        expect(fs.writeFileSync).toHaveBeenCalled();
        const writtenContent = fs.writeFileSync.mock.calls[0][1];

        // Check that imports were added
        expect(writtenContent).toContain('import android.content.Intent;');
        expect(writtenContent).toContain('import com.klaviyo.analytics.Klaviyo;');
      });
    });

    describe('Kotlin MainActivity', () => {
      it('adds onCreate when it does not exist in Kotlin MainActivity', async () => {
        const kotlinMainActivity = `package com.example.test

import com.facebook.react.ReactActivity

class MainActivity : ReactActivity() {
    override fun getMainComponentName(): String {
        return "main"
    }
}`;

        const mockFindMainActivity = jest.fn().mockResolvedValue({ path: '/test/MainActivity.kt', isKotlin: true });
        fs.readFileSync.mockReturnValue(kotlinMainActivity);

        await modifyMainActivity(baseConfig, baseProps, mockFindMainActivity);

        expect(fs.writeFileSync).toHaveBeenCalled();
        const writtenContent = fs.writeFileSync.mock.calls[0][1];

        // Check that onCreate was added
        expect(writtenContent).toContain('override fun onCreate');
        expect(writtenContent).toContain('super.onCreate(savedInstanceState)');
        expect(writtenContent).toContain('onNewIntent(intent)');
        expect(writtenContent).toContain('// Tracks when a system tray notification is opened while app is killed');
      });

      it('injects into existing onCreate in Kotlin MainActivity', async () => {
        const kotlinMainActivityWithOnCreate = `package com.example.test

import com.facebook.react.ReactActivity
import android.os.Bundle

class MainActivity : ReactActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        setTheme(R.style.AppTheme);
        super.onCreate(null)
    }

    override fun getMainComponentName(): String {
        return "main"
    }
}`;

        const mockFindMainActivity = jest.fn().mockResolvedValue({ path: '/test/MainActivity.kt', isKotlin: true });
        fs.readFileSync.mockReturnValue(kotlinMainActivityWithOnCreate);

        await modifyMainActivity(baseConfig, baseProps, mockFindMainActivity);

        expect(fs.writeFileSync).toHaveBeenCalled();
        const writtenContent = fs.writeFileSync.mock.calls[0][1];

        // Check that onNewIntent was injected after super.onCreate
        expect(writtenContent).toContain('super.onCreate(null)');
        expect(writtenContent).toContain('// @generated begin klaviyo-onCreate');
        expect(writtenContent).toContain('// @generated end klaviyo-onCreate');

        // Verify order: super.onCreate should come before the onCreate injection block
        const superIndex = writtenContent.indexOf('super.onCreate(null)');
        const onCreateBlockIndex = writtenContent.indexOf('// @generated begin klaviyo-onCreate');
        expect(superIndex).toBeLessThan(onCreateBlockIndex);

        // Verify the injected call is in the onCreate block (not just in onNewIntent method signature)
        const onCreateBlock = writtenContent.substring(
          writtenContent.indexOf('// @generated begin klaviyo-onCreate'),
          writtenContent.indexOf('// @generated end klaviyo-onCreate')
        );
        expect(onCreateBlock).toContain('onNewIntent(intent)');
      });

      it('adds onNewIntent method in Kotlin MainActivity', async () => {
        const kotlinMainActivity = `package com.example.test

import com.facebook.react.ReactActivity

class MainActivity : ReactActivity() {
    override fun getMainComponentName(): String {
        return "main"
    }
}`;

        const mockFindMainActivity = jest.fn().mockResolvedValue({ path: '/test/MainActivity.kt', isKotlin: true });
        fs.readFileSync.mockReturnValue(kotlinMainActivity);

        await modifyMainActivity(baseConfig, baseProps, mockFindMainActivity);

        expect(fs.writeFileSync).toHaveBeenCalled();
        const writtenContent = fs.writeFileSync.mock.calls[0][1];

        // Check that onNewIntent was added
        expect(writtenContent).toContain('override fun onNewIntent(intent: Intent)');
        expect(writtenContent).toContain('super.onNewIntent(intent)');
        expect(writtenContent).toContain('Klaviyo.handlePush(intent)');
        expect(writtenContent).toContain('// Tracks when a system tray notification is opened');
      });

      it('adds required imports in Kotlin MainActivity', async () => {
        const kotlinMainActivity = `package com.example.test

import com.facebook.react.ReactActivity

class MainActivity : ReactActivity() {
    override fun getMainComponentName(): String {
        return "main"
    }
}`;

        const mockFindMainActivity = jest.fn().mockResolvedValue({ path: '/test/MainActivity.kt', isKotlin: true });
        fs.readFileSync.mockReturnValue(kotlinMainActivity);

        await modifyMainActivity(baseConfig, baseProps, mockFindMainActivity);

        expect(fs.writeFileSync).toHaveBeenCalled();
        const writtenContent = fs.writeFileSync.mock.calls[0][1];

        // Check that imports were added (Kotlin doesn't use semicolons)
        expect(writtenContent).toContain('import android.content.Intent');
        expect(writtenContent).toContain('import com.klaviyo.analytics.Klaviyo');
      });
    });

    describe('openTracking disabled', () => {
      it('removes onCreate injection when openTracking is disabled', async () => {
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
    onNewIntent(getIntent());
    // @generated end klaviyo-onCreate
  }
}`;

        const mockFindMainActivity = jest.fn().mockResolvedValue({ path: '/test/MainActivity.java', isKotlin: false });
        fs.readFileSync.mockReturnValue(javaMainActivityWithTracking);

        const disabledProps = createMockProps({ openTracking: false });
        await modifyMainActivity(baseConfig, disabledProps, mockFindMainActivity);

        expect(fs.writeFileSync).toHaveBeenCalled();
        const writtenContent = fs.writeFileSync.mock.calls[0][1];

        // Check that Klaviyo code was removed
        expect(writtenContent).not.toContain('import android.content.Intent');
        expect(writtenContent).not.toContain('import com.klaviyo.analytics.Klaviyo');
        expect(writtenContent).not.toContain('Klaviyo.handlePush');
        expect(writtenContent).not.toContain('onNewIntent(getIntent());');
        expect(writtenContent).not.toContain('// @generated begin klaviyo-');
      });
    });

    describe('idempotency', () => {
      it('does not duplicate onCreate injection on multiple runs', async () => {
        const javaMainActivityWithOnCreate = `package com.example.test;

import com.facebook.react.ReactActivity;

public class MainActivity extends ReactActivity {
  @Override
  protected void onCreate(android.os.Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
  }
}`;

        const mockFindMainActivity = jest.fn().mockResolvedValue({ path: '/test/MainActivity.java', isKotlin: false });
        fs.readFileSync.mockReturnValue(javaMainActivityWithOnCreate);

        // Run twice
        await modifyMainActivity(baseConfig, baseProps, mockFindMainActivity);
        const firstRunContent = fs.writeFileSync.mock.calls[0][1];

        // Simulate reading the modified content
        fs.readFileSync.mockReturnValue(firstRunContent);
        fs.writeFileSync.mockClear();

        await modifyMainActivity(baseConfig, baseProps, mockFindMainActivity);
        const secondRunContent = fs.writeFileSync.mock.calls[0][1];

        // Count occurrences of the injection
        const onNewIntentMatches = (secondRunContent.match(/onNewIntent\(getIntent\(\)\);/g) || []).length;
        expect(onNewIntentMatches).toBe(1); // Should only appear once
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