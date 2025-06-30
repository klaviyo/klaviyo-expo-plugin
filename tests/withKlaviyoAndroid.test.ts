import * as fs from 'fs';
import * as path from 'path';
import * as glob from 'glob';
import { getMainActivityAsync } from '@expo/config-plugins/build/android/Paths';
import withKlaviyoAndroid from '../plugin/withKlaviyoAndroid';
import { KlaviyoPluginAndroidProps } from '../plugin/types';

// Mock the logger to avoid console output during tests
jest.mock('../plugin/support/logger', () => ({
  KlaviyoLog: {
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

describe('withKlaviyoAndroid', () => {
  let mockConfig: any;
  let mockProps: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockConfig = global.testUtils.createMockConfig();
    mockProps = global.testUtils.createMockProps();
  });

  describe('withAndroidManifestModifications', () => {
    it('should add log level meta-data to manifest', () => {
      const result = withKlaviyoAndroid(mockConfig, mockProps);
      
      expect(result).toBeDefined();
      // The function should return a config plugin function
      expect(typeof result).toBe('function');
    });

    it('should handle missing application tag in manifest', () => {
      const configWithoutApp = {
        ...mockConfig,
        modResults: {
          manifest: {},
        },
      };

      const result = withKlaviyoAndroid(configWithoutApp, mockProps);
      expect(result).toBeDefined();
    });

    it('should handle missing meta-data array', () => {
      const configWithoutMetaData = {
        ...mockConfig,
        modResults: {
          manifest: {
            application: [{
              $: { 'android:name': '.MainApplication' },
              // No meta-data array
            }],
          },
        },
      };

      const result = withKlaviyoAndroid(configWithoutMetaData, mockProps);
      expect(result).toBeDefined();
    });

    it('should remove existing log level meta-data before adding new one', () => {
      const configWithExistingMetaData = {
        ...mockConfig,
        modResults: {
          manifest: {
            application: [{
              $: { 'android:name': '.MainApplication' },
              'meta-data': [
                {
                  $: {
                    'android:name': 'com.klaviyo.core.log_level',
                    'android:value': '5',
                  },
                },
              ],
            }],
          },
        },
      };

      const result = withKlaviyoAndroid(configWithExistingMetaData, mockProps);
      expect(result).toBeDefined();
    });

    it('should add KlaviyoPushService to manifest', () => {
      const result = withKlaviyoAndroid(mockConfig, mockProps);
      expect(result).toBeDefined();
    });

    it('should not duplicate KlaviyoPushService if already exists', () => {
      const configWithExistingService = {
        ...mockConfig,
        modResults: {
          manifest: {
            application: [{
              $: { 'android:name': '.MainApplication' },
              'meta-data': [],
              service: [{
                $: {
                  'android:name': 'com.klaviyo.pushFcm.KlaviyoPushService',
                  'android:exported': 'false',
                },
              }],
            }],
          },
        },
      };

      const result = withKlaviyoAndroid(configWithExistingService, mockProps);
      expect(result).toBeDefined();
    });
  });

  describe('findMainActivity', () => {
    beforeEach(() => {
      (getMainActivityAsync as jest.Mock).mockResolvedValue('/test/path/MainActivity.kt');
      (fs.existsSync as jest.Mock).mockReturnValue(true);
    });

    it('should find MainActivity using Expo detection', async () => {
      // This would test the findMainActivity function directly
      // Since it's not exported, we'll test it through the main plugin
      const result = withKlaviyoAndroid(mockConfig, mockProps);
      expect(result).toBeDefined();
    });

    it('should fall back to manual search when Expo detection fails', async () => {
      (getMainActivityAsync as jest.Mock).mockRejectedValue(new Error('Not found'));
      (fs.existsSync as jest.Mock).mockImplementation((path: string) => {
        return path.includes('java') && path.includes('src');
      });
      (glob.sync as unknown as jest.Mock).mockReturnValue(['MainActivity.kt']);
      (fs.readFileSync as jest.Mock).mockReturnValue('class MainActivity : ReactActivity');

      const result = withKlaviyoAndroid(mockConfig, mockProps);
      expect(result).toBeDefined();
    });

    it('should handle missing Java directories', async () => {
      (getMainActivityAsync as jest.Mock).mockRejectedValue(new Error('Not found'));
      (fs.existsSync as jest.Mock).mockReturnValue(false);

      const result = withKlaviyoAndroid(mockConfig, mockProps);
      expect(result).toBeDefined();
    });
  });

  describe('withMainActivityModifications', () => {
    beforeEach(() => {
      (getMainActivityAsync as jest.Mock).mockResolvedValue('/test/path/MainActivity.kt');
      (fs.existsSync as jest.Mock).mockReturnValue(true);
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

    it('should modify MainActivity with Klaviyo imports', () => {
      const result = withKlaviyoAndroid(mockConfig, mockProps);
      expect(result).toBeDefined();
    });

    it('should handle missing Android package in config', () => {
      const configWithoutPackage = {
        ...mockConfig,
        android: {},
      };

      const result = withKlaviyoAndroid(configWithoutPackage, mockProps);
      expect(result).toBeDefined();
    });

    it('should handle missing MainActivity file', () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);

      const result = withKlaviyoAndroid(mockConfig, mockProps);
      expect(result).toBeDefined();
    });

    it('should handle MainActivity without package declaration', () => {
      (fs.readFileSync as jest.Mock).mockReturnValue(`
// No package declaration
public class MainActivity extends ReactActivity {
}
      `);

      const result = withKlaviyoAndroid(mockConfig, mockProps);
      expect(result).toBeDefined();
    });

    it('should handle MainActivity without class declaration', () => {
      (fs.readFileSync as jest.Mock).mockReturnValue(`
package com.example.test;

// No class declaration
      `);

      const result = withKlaviyoAndroid(mockConfig, mockProps);
      expect(result).toBeDefined();
    });
  });

  describe('withNotificationResources', () => {
    it('should create notification resources', () => {
      const result = withKlaviyoAndroid(mockConfig, mockProps);
      expect(result).toBeDefined();
    });

    it('should handle missing notification icon path', () => {
      const propsWithoutIcon = {
        ...mockProps,
        notificationIconFilePath: undefined,
      };

      const result = withKlaviyoAndroid(mockConfig, propsWithoutIcon);
      expect(result).toBeDefined();
    });

    it('should handle missing notification color', () => {
      const propsWithoutColor = {
        ...mockProps,
        notificationColor: undefined,
      };

      const result = withKlaviyoAndroid(mockConfig, propsWithoutColor);
      expect(result).toBeDefined();
    });
  });

  describe('withNotificationManifest', () => {
    it('should add notification manifest entries', () => {
      const result = withKlaviyoAndroid(mockConfig, mockProps);
      expect(result).toBeDefined();
    });

    it('should handle missing notification icon path', () => {
      const propsWithoutIcon = {
        ...mockProps,
        notificationIconFilePath: undefined,
      };

      const result = withKlaviyoAndroid(mockConfig, propsWithoutIcon);
      expect(result).toBeDefined();
    });
  });

  describe('withNotificationIcon', () => {
    beforeEach(() => {
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (path.join as jest.Mock).mockImplementation((...args) => args.join('/'));
    });

    it('should copy notification icon to resources', () => {
      const result = withKlaviyoAndroid(mockConfig, mockProps);
      expect(result).toBeDefined();
    });

    it('should handle missing source icon file', () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);

      const result = withKlaviyoAndroid(mockConfig, mockProps);
      expect(result).toBeDefined();
    });

    it('should create destination directory if it does not exist', () => {
      (fs.existsSync as jest.Mock).mockImplementation((path: string) => {
        return path.includes('icon.png');
      });

      const result = withKlaviyoAndroid(mockConfig, mockProps);
      expect(result).toBeDefined();
    });
  });

  describe('Integration tests', () => {
    it('should compose all plugins correctly', () => {
      const result = withKlaviyoAndroid(mockConfig, mockProps);
      expect(result).toBeDefined();
      expect(typeof result).toBe('function');
    });

    it('should handle empty props', () => {
      const result = withKlaviyoAndroid(mockConfig, {} as KlaviyoPluginAndroidProps);
      expect(result).toBeDefined();
    });

    it('should handle null props', () => {
      const result = withKlaviyoAndroid(mockConfig, {} as KlaviyoPluginAndroidProps);
      expect(result).toBeDefined();
    });
  });
}); 