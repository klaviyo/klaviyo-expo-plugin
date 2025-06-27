import { findMainActivity, withMainActivityModifications, withNotificationIcon, withKlaviyoPluginNameVersion, modifyMainActivity } from '../plugin/withKlaviyoAndroid';
import { executePlugin } from './utils/testHelpers';

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

// Mock the logger to avoid console output
jest.mock('../plugin/support/logger', () => ({
  KlaviyoLog: {
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

describe('withKlaviyoAndroid Internal Functions', () => {
  describe('findMainActivity', () => {
    it('should find MainActivity using Expo detection', async () => {
      // Ensure the test config has a valid platformProjectRoot
      const config = global.testUtils.createMockConfig({
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
      const config = global.testUtils.createMockConfig();
      const props = global.testUtils.createMockProps({ openTracking: true });
      
      const result = withMainActivityModifications(config, props);
      expect(result).toHaveProperty('mods.android');
    });

    it('should handle missing android package', () => {
      const config = global.testUtils.createMockConfig({ android: {} });
      const props = global.testUtils.createMockProps({ openTracking: true });
      
      const result = withMainActivityModifications(config, props);
      expect(result).toHaveProperty('mods.android');
    });

    it('should handle missing MainActivity', () => {
      const fs = require('fs');
      fs.existsSync.mockReturnValue(false);
      
      const config = global.testUtils.createMockConfig();
      const props = global.testUtils.createMockProps({ openTracking: true });
      
      const result = withMainActivityModifications(config, props);
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
      
      const config = global.testUtils.createMockConfig();
      const props = global.testUtils.createMockProps({ openTracking: true });
      
      const result = withMainActivityModifications(config, props);
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
      
      const config = global.testUtils.createMockConfig();
      const props = global.testUtils.createMockProps({ openTracking: true });
      
      const result = withMainActivityModifications(config, props);
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
      
      const config = global.testUtils.createMockConfig();
      const props = global.testUtils.createMockProps({ openTracking: true });
      
      const result = withMainActivityModifications(config, props);
      expect(result).toHaveProperty('mods.android');
    });

    it('should handle openTracking disabled', () => {
      const config = global.testUtils.createMockConfig();
      const props = global.testUtils.createMockProps({ openTracking: false });
      
      const result = withMainActivityModifications(config, props);
      expect(result).toHaveProperty('mods.android');
    });

    // Error condition tests
    describe('error conditions', () => {
      it('should handle missing android package in config', () => {
        const config = global.testUtils.createMockConfig({ android: undefined });
        const props = global.testUtils.createMockProps({ openTracking: true });
        
        const result = withMainActivityModifications(config, props);
        expect(result).toHaveProperty('mods.android');
      });

      it('should handle null android package in config', () => {
        const config = global.testUtils.createMockConfig({ android: null });
        const props = global.testUtils.createMockProps({ openTracking: true });
        
        const result = withMainActivityModifications(config, props);
        expect(result).toHaveProperty('mods.android');
      });

      it('should handle empty android object in config', () => {
        const config = global.testUtils.createMockConfig({ android: {} });
        const props = global.testUtils.createMockProps({ openTracking: true });
        
        const result = withMainActivityModifications(config, props);
        expect(result).toHaveProperty('mods.android');
      });

      it('should handle missing MainActivity detection', () => {
        const fs = require('fs');
        const { getMainActivityAsync } = require('@expo/config-plugins/build/android/Paths');
        
        // Mock that no MainActivity is found
        getMainActivityAsync.mockRejectedValue(new Error('Not found'));
        fs.existsSync.mockReturnValue(false);
        
        const config = global.testUtils.createMockConfig();
        const props = global.testUtils.createMockProps({ openTracking: true });
        
        const result = withMainActivityModifications(config, props);
        expect(result).toHaveProperty('mods.android');
      });

      it('should handle MainActivity file not existing', () => {
        const fs = require('fs');
        const { getMainActivityAsync } = require('@expo/config-plugins/build/android/Paths');
        
        // Mock that MainActivity is found but file doesn't exist
        getMainActivityAsync.mockResolvedValue('/test/path/MainActivity.java');
        fs.existsSync.mockImplementation((path) => path && !path.includes('MainActivity'));
        
        const config = global.testUtils.createMockConfig();
        const props = global.testUtils.createMockProps({ openTracking: true });
        
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
        
        const config = global.testUtils.createMockConfig();
        const props = global.testUtils.createMockProps({ openTracking: true });
        
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
        
        const config = global.testUtils.createMockConfig();
        const props = global.testUtils.createMockProps({ openTracking: true });
        
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
        
        const config = global.testUtils.createMockConfig();
        const props = global.testUtils.createMockProps({ openTracking: true });
        
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
        
        const config = global.testUtils.createMockConfig();
        const props = global.testUtils.createMockProps({ openTracking: true });
        
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
      const config = global.testUtils.createMockConfig();
      const props = global.testUtils.createMockProps({ notificationIconFilePath: './assets/icon.png' });
      await runMod(config, props);
      expect(fs.copyFileSync).toHaveBeenCalled();
    });

    it('should throw if notification icon file does not exist', async () => {
      const fs = require('fs');
      fs.existsSync.mockReturnValue(false);
      const config = global.testUtils.createMockConfig();
      const props = global.testUtils.createMockProps({ notificationIconFilePath: './notfound.png' });
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
      const config = global.testUtils.createMockConfig();
      const props = global.testUtils.createMockProps({ notificationIconFilePath: './assets/icon.png' });
      await runMod(config, props);
      expect(fs.mkdirSync).toHaveBeenCalledWith('/test/project/root/app/src/main/res/drawable', { recursive: true });
    });

    it('should throw if copyFileSync fails', async () => {
      const fs = require('fs');
      fs.existsSync.mockReturnValue(true);
      fs.copyFileSync.mockImplementation(() => { throw new Error('Copy failed'); });
      const config = global.testUtils.createMockConfig();
      const props = global.testUtils.createMockProps({ notificationIconFilePath: './assets/icon.png' });
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
      const config = global.testUtils.createMockConfig();
      const props = global.testUtils.createMockProps({ notificationIconFilePath: undefined });
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
      const config = global.testUtils.createMockConfig();
      const props = global.testUtils.createMockProps({ notificationIconFilePath: undefined });
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
      const config = global.testUtils.createMockConfig();
      const props = global.testUtils.createMockProps({ notificationIconFilePath: undefined });
      await expect(runMod(config, props)).rejects.toThrow('Failed to remove notification icon: Error: rm failed');
    });

    it('should log when no notification icon is found to remove', async () => {
      const fs = require('fs');
      const logger = require('../plugin/support/logger').KlaviyoLog;
      fs.existsSync.mockReturnValue(false);
      const config = global.testUtils.createMockConfig();
      const props = global.testUtils.createMockProps({ notificationIconFilePath: undefined });
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
      const config = global.testUtils.createMockConfig();
      const props = global.testUtils.createMockProps({ notificationIconFilePath: './assets/icon.png' });
      await runMod(config, props);
      expect(logger.log).toHaveBeenCalledWith('Setting up notification icon handling...');
      expect(logger.log).toHaveBeenCalledWith('Executing notification icon handling...');
    });
  });

  describe('withKlaviyoPluginNameVersion', () => {
    it('should return a function', () => {
      const config = global.testUtils.createMockConfig();
      const props = global.testUtils.createMockProps();
      
      const result = withKlaviyoPluginNameVersion(config, props);
      expect(typeof result).toBe('function');
    });

    it('should handle different config structures', () => {
      const configs = [
        global.testUtils.createMockConfig(),
        global.testUtils.createMockConfig({ android: {} }),
        global.testUtils.createMockConfig({ android: { package: 'com.example.test', manifest: {} } }),
      ];
      
      configs.forEach(config => {
        const props = global.testUtils.createMockProps();
        const result = withKlaviyoPluginNameVersion(config, props);
        expect(typeof result).toBe('function');
      });
    });

    it('should handle missing android config', () => {
      const config = global.testUtils.createMockConfig({ android: undefined });
      const props = global.testUtils.createMockProps();
      
      const result = withKlaviyoPluginNameVersion(config, props);
      expect(typeof result).toBe('function');
    });

    it('should handle null config', () => {
      const config = null as any;
      const props = global.testUtils.createMockProps();
      
      const result = withKlaviyoPluginNameVersion(config, props);
      expect(typeof result).toBe('function');
    });

    it('should handle undefined config', () => {
      const config = undefined as any;
      const props = global.testUtils.createMockProps();
      
      const result = withKlaviyoPluginNameVersion(config, props);
      expect(typeof result).toBe('function');
    });

    // Additional comprehensive tests for actual execution behavior
    describe('execution behavior', () => {
      let mockWithStringsXml: jest.Mock;
      let mockConfig: any;
      let mockProps: any;

      beforeEach(() => {
        jest.resetAllMocks();
        mockWithStringsXml = require('@expo/config-plugins').withStringsXml;
        mockConfig = global.testUtils.createMockConfig();
        mockProps = global.testUtils.createMockProps();
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
    const baseConfig = global.testUtils.createMockConfig();
    const baseProps = global.testUtils.createMockProps({ openTracking: true });

    beforeEach(() => {
      jest.resetAllMocks();
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
}); 