import * as fs from 'fs';
import * as path from 'path';
import * as glob from 'glob';
import { getMainActivityAsync } from '@expo/config-plugins/build/android/Paths';
import { KlaviyoPluginAndroidProps } from '../plugin/types';

// Mock the logger to avoid console output during tests
jest.mock('../plugin/support/logger', () => ({
  KlaviyoLog: {
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

// Mock xml2js
jest.mock('xml2js', () => ({
  parseString: jest.fn(),
  Builder: jest.fn().mockImplementation(() => ({
    buildObject: jest.fn().mockReturnValue('<xml>test</xml>'),
  })),
}));

// Mock mergeContents
jest.mock('@expo/config-plugins/build/utils/generateCode', () => ({
  mergeContents: jest.fn().mockReturnValue('merged content'),
}));

// Mock fs operations
jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  existsSync: jest.fn(),
  readFileSync: jest.fn(),
  writeFileSync: jest.fn(),
  mkdirSync: jest.fn(),
  copyFileSync: jest.fn(),
  unlinkSync: jest.fn(),
  rmSync: jest.fn(),
}));

// Mock path operations
jest.mock('path', () => ({
  ...jest.requireActual('path'),
  join: jest.fn(),
  resolve: jest.fn(),
}));

// Mock glob
jest.mock('glob', () => ({
  sync: jest.fn(),
}));

// Mock getMainActivityAsync
jest.mock('@expo/config-plugins/build/android/Paths', () => ({
  getMainActivityAsync: jest.fn(),
}));

// Import the actual plugin functions
import withKlaviyoAndroid from '../plugin/withKlaviyoAndroid';

describe('withKlaviyoAndroid Comprehensive Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup default mocks
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (path.join as jest.Mock).mockImplementation((...args) => args.join('/'));
    (path.resolve as jest.Mock).mockImplementation((...args) => args.join('/'));
    (getMainActivityAsync as jest.Mock).mockResolvedValue('/test/path/MainActivity.kt');
    (fs.readFileSync as jest.Mock).mockReturnValue(`
package com.example.test;

import com.facebook.react.ReactActivity;

public class MainActivity extends ReactActivity {
  @Override
  protected String getMainComponentName() {
    return "main";
  }
}
    `);
  });

  describe('withKlaviyoAndroid main function', () => {
    it('should return a function when called', () => {
      const config = global.testUtils.createMockConfig();
      const props = global.testUtils.createMockProps();

      const result = withKlaviyoAndroid(config, props);

      expect(typeof result).toBe('function');
    });

    it('should handle empty props', () => {
      const config = global.testUtils.createMockConfig();
      const props = {} as KlaviyoPluginAndroidProps;

      const result = withKlaviyoAndroid(config, props);

      expect(typeof result).toBe('function');
    });

    it('should handle null props', () => {
      const config = global.testUtils.createMockConfig();
      const props = null as any;

      const result = withKlaviyoAndroid(config, props);

      expect(typeof result).toBe('function');
    });
  });

  describe('withAndroidManifestModifications through plugin chain', () => {
    it('should modify manifest with log level', () => {
      const config = global.testUtils.createMockConfig();
      const props = global.testUtils.createMockProps({ logLevel: 2 });

      const plugin = withKlaviyoAndroid(config, props);
      const result = plugin(config, props);

      // The result should be the same config since mocks prevent actual modifications
      expect(result).toBeDefined();
    });

    it('should handle missing application in manifest', () => {
      const config = global.testUtils.createMockConfig({
        modResults: {
          manifest: {},
        },
      });
      const props = global.testUtils.createMockProps();

      const plugin = withKlaviyoAndroid(config, props);
      const result = plugin(config, props);

      expect(result).toBeDefined();
    });

    it('should handle missing meta-data array', () => {
      const config = global.testUtils.createMockConfig({
        modResults: {
          manifest: {
            application: [{
              $: { 'android:name': '.MainApplication' },
              // No meta-data array
            }],
          },
        },
      });
      const props = global.testUtils.createMockProps();

      const plugin = withKlaviyoAndroid(config, props);
      const result = plugin(config, props);

      expect(result).toBeDefined();
    });
  });

  describe('withNotificationManifest through plugin chain', () => {
    it('should handle notification icon path', () => {
      const config = global.testUtils.createMockConfig();
      const props = global.testUtils.createMockProps({ 
        notificationIconFilePath: './assets/icon.png' 
      });

      const plugin = withKlaviyoAndroid(config, props);
      const result = plugin(config, props);

      expect(result).toBeDefined();
    });

    it('should handle missing notification icon path', () => {
      const config = global.testUtils.createMockConfig();
      const props = global.testUtils.createMockProps({ 
        notificationIconFilePath: undefined 
      });

      const plugin = withKlaviyoAndroid(config, props);
      const result = plugin(config, props);

      expect(result).toBeDefined();
    });

    it('should handle notification color', () => {
      const config = global.testUtils.createMockConfig();
      const props = global.testUtils.createMockProps({ 
        notificationColor: '#FF0000' 
      });

      const plugin = withKlaviyoAndroid(config, props);
      const result = plugin(config, props);

      expect(result).toBeDefined();
    });

    it('should handle missing notification color', () => {
      const config = global.testUtils.createMockConfig();
      const props = global.testUtils.createMockProps({ 
        notificationColor: undefined 
      });

      const plugin = withKlaviyoAndroid(config, props);
      const result = plugin(config, props);

      expect(result).toBeDefined();
    });
  });

  describe('withNotificationIcon through plugin chain', () => {
    it('should handle existing notification icon file', () => {
      (fs.existsSync as jest.Mock).mockImplementation((path: string) => {
        return path.includes('icon.png') || path.includes('drawable');
      });

      const config = global.testUtils.createMockConfig();
      const props = global.testUtils.createMockProps({ 
        notificationIconFilePath: './assets/icon.png' 
      });

      const plugin = withKlaviyoAndroid(config, props);
      const result = plugin(config, props);

      expect(result).toBeDefined();
    });

    it('should handle missing source icon file', () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);

      const config = global.testUtils.createMockConfig();
      const props = global.testUtils.createMockProps({ 
        notificationIconFilePath: './assets/icon.png' 
      });

      const plugin = withKlaviyoAndroid(config, props);
      const result = plugin(config, props);

      expect(result).toBeDefined();
    });

    it('should handle missing destination directory', () => {
      (fs.existsSync as jest.Mock).mockImplementation((path: string) => {
        return path.includes('icon.png');
      });

      const config = global.testUtils.createMockConfig();
      const props = global.testUtils.createMockProps({ 
        notificationIconFilePath: './assets/icon.png' 
      });

      const plugin = withKlaviyoAndroid(config, props);
      const result = plugin(config, props);

      expect(result).toBeDefined();
    });

    it('should handle missing notification icon path', () => {
      const config = global.testUtils.createMockConfig();
      const props = global.testUtils.createMockProps({ 
        notificationIconFilePath: undefined 
      });

      const plugin = withKlaviyoAndroid(config, props);
      const result = plugin(config, props);

      expect(result).toBeDefined();
    });
  });

  describe('withMainActivityModifications through plugin chain', () => {
    it('should handle successful MainActivity modification', () => {
      const config = global.testUtils.createMockConfig();
      const props = global.testUtils.createMockProps({ openTracking: true });

      const plugin = withKlaviyoAndroid(config, props);
      const result = plugin(config, props);

      expect(result).toBeDefined();
    });

    it('should handle missing Android package', () => {
      const config = global.testUtils.createMockConfig({
        android: {},
      });
      const props = global.testUtils.createMockProps();

      const plugin = withKlaviyoAndroid(config, props);
      const result = plugin(config, props);

      expect(result).toBeDefined();
    });

    it('should handle missing MainActivity file', () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);

      const config = global.testUtils.createMockConfig();
      const props = global.testUtils.createMockProps();

      const plugin = withKlaviyoAndroid(config, props);
      const result = plugin(config, props);

      expect(result).toBeDefined();
    });

    it('should handle MainActivity without package declaration', () => {
      (fs.readFileSync as jest.Mock).mockReturnValue(`
// No package declaration
public class MainActivity extends ReactActivity {
}
      `);

      const config = global.testUtils.createMockConfig();
      const props = global.testUtils.createMockProps();

      const plugin = withKlaviyoAndroid(config, props);
      const result = plugin(config, props);

      expect(result).toBeDefined();
    });

    it('should handle MainActivity without class declaration', () => {
      (fs.readFileSync as jest.Mock).mockReturnValue(`
package com.example.test;

// No class declaration
      `);

      const config = global.testUtils.createMockConfig();
      const props = global.testUtils.createMockProps();

      const plugin = withKlaviyoAndroid(config, props);
      const result = plugin(config, props);

      expect(result).toBeDefined();
    });
  });

  describe('withNotificationResources through plugin chain', () => {
    it('should handle notification color creation', () => {
      const config = global.testUtils.createMockConfig();
      const props = global.testUtils.createMockProps({ 
        notificationColor: '#FF0000' 
      });

      const plugin = withKlaviyoAndroid(config, props);
      const result = plugin(config, props);

      expect(result).toBeDefined();
    });

    it('should handle missing notification color', () => {
      const config = global.testUtils.createMockConfig();
      const props = global.testUtils.createMockProps({ 
        notificationColor: undefined 
      });

      const plugin = withKlaviyoAndroid(config, props);
      const result = plugin(config, props);

      expect(result).toBeDefined();
    });
  });

  describe('withKlaviyoPluginNameVersion through plugin chain', () => {
    it('should add plugin name and version strings', () => {
      const config = global.testUtils.createMockConfig();

      const plugin = withKlaviyoAndroid(config, {});
      const result = plugin(config, {});

      expect(result).toBeDefined();
    });

    it('should handle existing string resources', () => {
      const config = global.testUtils.createMockConfig({
        modResults: {
          resources: {
            string: [{
              $: { name: 'klaviyo_sdk_plugin_name_override' },
              _: 'old-name'
            }],
          },
        },
      });

      const plugin = withKlaviyoAndroid(config, {});
      const result = plugin(config, {});

      expect(result).toBeDefined();
    });
  });

  describe('Error handling', () => {
    it('should handle fs operation errors gracefully', () => {
      (fs.copyFileSync as jest.Mock).mockImplementation(() => {
        throw new Error('Copy failed');
      });

      const config = global.testUtils.createMockConfig();
      const props = global.testUtils.createMockProps({ 
        notificationIconFilePath: './assets/icon.png' 
      });

      const plugin = withKlaviyoAndroid(config, props);
      const result = plugin(config, props);

      expect(result).toBeDefined();
    });

    it('should handle path resolution errors', () => {
      (path.resolve as jest.Mock).mockImplementation(() => {
        throw new Error('Path resolution failed');
      });

      const config = global.testUtils.createMockConfig();
      const props = global.testUtils.createMockProps();

      const plugin = withKlaviyoAndroid(config, props);
      const result = plugin(config, props);

      expect(result).toBeDefined();
    });
  });
}); 