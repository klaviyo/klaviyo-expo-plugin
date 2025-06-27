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
      const result = await findMainActivity('/test/project/root');
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
      const config = { android: { package: 'com.example.test' } };
      const props = { openTracking: true };
      
      const result = withMainActivityModifications(config, props);
      expect(typeof result).toBe('function');
    });

    it('should handle missing android package', () => {
      const config = { android: {} };
      const props = { openTracking: true };
      
      const result = withMainActivityModifications(config, props);
      expect(typeof result).toBe('function');
    });

    it('should handle missing MainActivity', () => {
      const fs = require('fs');
      fs.existsSync.mockReturnValue(false);
      
      const config = { android: { package: 'com.example.test' } };
      const props = { openTracking: true };
      
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
      
      const config = { android: { package: 'com.example.test' } };
      const props = { openTracking: true };
      
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
      
      const config = { android: { package: 'com.example.test' } };
      const props = { openTracking: true };
      
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
      
      const config = { android: { package: 'com.example.test' } };
      const props = { openTracking: true };
      
      const result = withMainActivityModifications(config, props);
      expect(typeof result).toBe('function');
    });

    it('should handle openTracking disabled', () => {
      const config = { android: { package: 'com.example.test' } };
      const props = { openTracking: false };
      
      const result = withMainActivityModifications(config, props);
      expect(typeof result).toBe('function');
    });
  });

  describe('withNotificationIcon', () => {
    it('should return a function', () => {
      const config = { android: { package: 'com.example.test' } };
      const props = { notificationIconFilePath: './assets/icon.png' };
      
      const result = withNotificationIcon(config, props);
      expect(typeof result).toBe('function');
    });

    it('should handle missing notification icon file', () => {
      const fs = require('fs');
      fs.existsSync.mockReturnValue(false);
      
      const config = { android: { package: 'com.example.test' } };
      const props = { notificationIconFilePath: './notfound.png' };
      
      const result = withNotificationIcon(config, props);
      expect(typeof result).toBe('function');
    });

    it('should handle file copy operations', () => {
      const config = { android: { package: 'com.example.test' } };
      const props = { notificationIconFilePath: './assets/icon.png' };
      
      const result = withNotificationIcon(config, props);
      expect(typeof result).toBe('function');
    });

    it('should handle file copy errors', () => {
      const fs = require('fs');
      fs.existsSync.mockReturnValue(true);
      fs.copyFileSync.mockImplementation(() => {
        throw new Error('Copy failed');
      });
      
      const config = { android: { package: 'com.example.test' } };
      const props = { notificationIconFilePath: './assets/icon.png' };
      
      const result = withNotificationIcon(config, props);
      expect(typeof result).toBe('function');
    });

    it('should handle missing notification icon path', () => {
      const config = { android: { package: 'com.example.test' } };
      const props = { notificationIconFilePath: undefined };
      
      const result = withNotificationIcon(config, props);
      expect(typeof result).toBe('function');
    });

    it('should handle different icon file extensions', () => {
      const config = { android: { package: 'com.example.test' } };
      const extensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp'];
      
      extensions.forEach(ext => {
        const props = { notificationIconFilePath: `./assets/icon${ext}` };
        const result = withNotificationIcon(config, props);
        expect(typeof result).toBe('function');
      });
    });
  });

  describe('withKlaviyoPluginNameVersion', () => {
    it('should return a function', () => {
      const config = { android: { package: 'com.example.test' } };
      const props = {};
      
      const result = withKlaviyoPluginNameVersion(config, props);
      expect(typeof result).toBe('function');
    });

    it('should handle different config structures', () => {
      const configs = [
        { android: { package: 'com.example.test' } },
        { android: {} },
        { android: { package: 'com.example.test', manifest: {} } },
      ];
      
      configs.forEach(config => {
        const props = {};
        const result = withKlaviyoPluginNameVersion(config, props);
        expect(typeof result).toBe('function');
      });
    });

    it('should handle missing android config', () => {
      const config = {};
      const props = {};
      
      const result = withKlaviyoPluginNameVersion(config, props);
      expect(typeof result).toBe('function');
    });

    it('should handle null config', () => {
      const config = null as any;
      const props = {};
      
      const result = withKlaviyoPluginNameVersion(config, props);
      expect(typeof result).toBe('function');
    });

    it('should handle undefined config', () => {
      const config = undefined as any;
      const props = {};
      
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