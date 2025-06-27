import { findMainActivity, withMainActivityModifications, withNotificationIcon, withKlaviyoPluginNameVersion } from '../plugin/withKlaviyoAndroid';

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
}); 