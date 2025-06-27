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
}));

jest.mock('glob', () => ({
  sync: jest.fn(() => ['MainActivity.java']),
}));

jest.mock('@expo/config-plugins/build/android/Paths', () => ({
  getMainActivityAsync: jest.fn(() => Promise.resolve('/test/path/MainActivity.java')),
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
      expect(typeof result).toBe('function');
    });

    it('should handle missing android package', () => {
      const config = global.testUtils.createMockConfig({ android: {} });
      const props = global.testUtils.createMockProps({ openTracking: true });
      
      const result = withMainActivityModifications(config, props);
      expect(typeof result).toBe('function');
    });

    it('should handle missing MainActivity', () => {
      const fs = require('fs');
      fs.existsSync.mockReturnValue(false);
      
      const config = global.testUtils.createMockConfig();
      const props = global.testUtils.createMockProps({ openTracking: true });
      
      const result = withMainActivityModifications(config, props);
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
      
      const config = global.testUtils.createMockConfig();
      const props = global.testUtils.createMockProps({ openTracking: true });
      
      const result = withMainActivityModifications(config, props);
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
      
      const config = global.testUtils.createMockConfig();
      const props = global.testUtils.createMockProps({ openTracking: true });
      
      const result = withMainActivityModifications(config, props);
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
      
      const config = global.testUtils.createMockConfig();
      const props = global.testUtils.createMockProps({ openTracking: true });
      
      const result = withMainActivityModifications(config, props);
      expect(typeof result).toBe('function');
    });

    it('should handle openTracking disabled', () => {
      const config = global.testUtils.createMockConfig();
      const props = global.testUtils.createMockProps({ openTracking: false });
      
      const result = withMainActivityModifications(config, props);
      expect(typeof result).toBe('function');
    });

    // Error condition tests
    describe('error conditions', () => {
      it('should handle missing android package in config', () => {
        const config = global.testUtils.createMockConfig({ android: undefined });
        const props = global.testUtils.createMockProps({ openTracking: true });
        
        const result = withMainActivityModifications(config, props);
        expect(typeof result).toBe('function');
      });

      it('should handle null android package in config', () => {
        const config = global.testUtils.createMockConfig({ android: null });
        const props = global.testUtils.createMockProps({ openTracking: true });
        
        const result = withMainActivityModifications(config, props);
        expect(typeof result).toBe('function');
      });

      it('should handle empty android object in config', () => {
        const config = global.testUtils.createMockConfig({ android: {} });
        const props = global.testUtils.createMockProps({ openTracking: true });
        
        const result = withMainActivityModifications(config, props);
        expect(typeof result).toBe('function');
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
        expect(typeof result).toBe('function');
      });

      it('should handle MainActivity file not existing', () => {
        const fs = require('fs');
        const { getMainActivityAsync } = require('@expo/config-plugins/build/android/Paths');
        
        // Mock that MainActivity is found but file doesn't exist
        getMainActivityAsync.mockResolvedValue('/test/path/MainActivity.java');
        fs.existsSync.mockImplementation((path: string) => {
          // Return true for directory checks, false for file checks
          return path.includes('java') && !path.includes('MainActivity');
        });
        
        const config = global.testUtils.createMockConfig();
        const props = global.testUtils.createMockProps({ openTracking: true });
        
        const result = withMainActivityModifications(config, props);
        expect(typeof result).toBe('function');
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
        expect(typeof result).toBe('function');
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
        expect(typeof result).toBe('function');
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
        expect(typeof result).toBe('function');
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
        expect(typeof result).toBe('function');
      });
    });
  });

  describe('withNotificationIcon', () => {
    it('should return a function', () => {
      const config = global.testUtils.createMockConfig();
      const props = global.testUtils.createMockProps({ notificationIconFilePath: './assets/icon.png' });
      
      const result = withNotificationIcon(config, props);
      expect(typeof result).toBe('function');
    });

    it('should handle missing notification icon file', () => {
      const fs = require('fs');
      fs.existsSync.mockReturnValue(false);
      
      const config = global.testUtils.createMockConfig();
      const props = global.testUtils.createMockProps({ notificationIconFilePath: './notfound.png' });
      
      const result = withNotificationIcon(config, props);
      expect(typeof result).toBe('function');
    });

    it('should handle file copy operations', () => {
      const config = global.testUtils.createMockConfig();
      const props = global.testUtils.createMockProps({ notificationIconFilePath: './assets/icon.png' });
      
      const result = withNotificationIcon(config, props);
      expect(typeof result).toBe('function');
    });

    it('should handle file copy errors', () => {
      const fs = require('fs');
      fs.existsSync.mockReturnValue(true);
      fs.copyFileSync.mockImplementation(() => {
        throw new Error('Copy failed');
      });
      
      const config = global.testUtils.createMockConfig();
      const props = global.testUtils.createMockProps({ notificationIconFilePath: './assets/icon.png' });
      
      const result = withNotificationIcon(config, props);
      expect(typeof result).toBe('function');
    });

    it('should handle missing notification icon path', () => {
      const config = global.testUtils.createMockConfig();
      const props = global.testUtils.createMockProps({ notificationIconFilePath: undefined });
      
      const result = withNotificationIcon(config, props);
      expect(typeof result).toBe('function');
    });

    it('should handle different icon file extensions', () => {
      const config = global.testUtils.createMockConfig();
      const extensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp'];
      
      extensions.forEach(ext => {
        const props = global.testUtils.createMockProps({ notificationIconFilePath: `./assets/icon${ext}` });
        const result = withNotificationIcon(config, props);
        expect(typeof result).toBe('function');
      });
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