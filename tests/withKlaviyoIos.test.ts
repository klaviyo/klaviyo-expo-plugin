import * as fs from 'fs';
import * as path from 'path';
import withKlaviyoIos from '../plugin/withKlaviyoIos';
import { KlaviyoPluginIosProps } from '../plugin/types';

// Mock the logger to avoid console output during tests
jest.mock('../plugin/support/logger', () => ({
  KlaviyoLog: {
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

// Mock the file manager
jest.mock('../plugin/support/fileManager', () => ({
  FileManager: {
    readFile: jest.fn(),
    writeFile: jest.fn(),
    copyFile: jest.fn(),
    dirExists: jest.fn(),
  },
}));

describe('withKlaviyoIos', () => {
  let mockConfig: any;
  let mockProps: KlaviyoPluginIosProps;

  beforeEach(() => {
    jest.clearAllMocks();
    mockConfig = global.testUtils.createMockIosConfig();
    mockProps = global.testUtils.createMockIosProps();
  });

  describe('withRemoteNotificationsPermissions', () => {
    it('should add klaviyo_app_group and klaviyo_badge_autoclearing to existing Info.plist', () => {
      const modifiedConfig = withKlaviyoIos(mockConfig, mockProps) as any;
      expect(modifiedConfig.modResults).toBeDefined();
      expect(modifiedConfig.modResults.klaviyo_app_group).toBe('group.com.test.app.KlaviyoNotificationServiceExtension.shared');
      expect(modifiedConfig.modResults.klaviyo_badge_autoclearing).toBe(true);
    });

    it('should add flags to Info.plist with badgeAutoclearing set to false', () => {
      const propsWithBadgeClearingDisabled = global.testUtils.createMockIosProps({
        badgeAutoclearing: false,
      });
      const modifiedConfig = withKlaviyoIos(mockConfig, propsWithBadgeClearingDisabled) as any;
      expect(modifiedConfig.modResults).toBeDefined();
      expect(modifiedConfig.modResults.klaviyo_app_group).toBe('group.com.test.app.KlaviyoNotificationServiceExtension.shared');
      expect(modifiedConfig.modResults.klaviyo_badge_autoclearing).toBe(false);
    });

    it('should add flags to Info.plist with minimal existing content', () => {
      const minimalConfig = global.testUtils.createMockIosConfig({
        modResults: {
          CFBundleIdentifier: 'com.test.app',
        },
      });
      const modifiedConfig = withKlaviyoIos(minimalConfig, mockProps) as any;
      expect(modifiedConfig.modResults).toBeDefined();
      expect(modifiedConfig.modResults.klaviyo_app_group).toBe('group.com.test.app.KlaviyoNotificationServiceExtension.shared');
      expect(modifiedConfig.modResults.klaviyo_badge_autoclearing).toBe(true);
      expect(modifiedConfig.modResults.CFBundleIdentifier).toBe('com.test.app');
    });

    it('should update existing klaviyo flags if they already exist', () => {
      const configWithExistingFlags = global.testUtils.createMockIosConfig({
        modResults: {
          ...mockConfig.modResults,
          klaviyo_app_group: 'group.existing.app.shared',
          klaviyo_badge_autoclearing: false,
        },
      });
      const modifiedConfig = withKlaviyoIos(configWithExistingFlags, mockProps) as any;
      expect(modifiedConfig.modResults).toBeDefined();
      expect(modifiedConfig.modResults.klaviyo_app_group).toBe('group.com.test.app.KlaviyoNotificationServiceExtension.shared');
      expect(modifiedConfig.modResults.klaviyo_badge_autoclearing).toBe(true);
    });

    it('should handle config without ios bundleIdentifier', () => {
      const configWithoutBundleId = global.testUtils.createMockIosConfig({
        ios: {},
      });
      expect(() => withKlaviyoIos(configWithoutBundleId, mockProps)).toThrow('iOS bundle identifier is required for app group configuration');
    });

    it('should handle empty modResults', () => {
      const configWithEmptyResults = global.testUtils.createMockIosConfig({
        modResults: {},
      });
      const modifiedConfig = withKlaviyoIos(configWithEmptyResults, mockProps) as any;
      expect(modifiedConfig.modResults).toBeDefined();
      expect(modifiedConfig.modResults.klaviyo_app_group).toBe('group.com.test.app.KlaviyoNotificationServiceExtension.shared');
      expect(modifiedConfig.modResults.klaviyo_badge_autoclearing).toBe(true);
    });
  });



  describe('plugin integration', () => {
    it('should apply all plugins in the correct order', () => {
      const modifiedConfig = withKlaviyoIos(mockConfig, mockProps) as any;
      expect(modifiedConfig.modResults).toBeDefined();
      expect(modifiedConfig.modResults.klaviyo_app_group).toBe('group.com.test.app.KlaviyoNotificationServiceExtension.shared');
      expect(modifiedConfig.modResults.klaviyo_badge_autoclearing).toBe(true);
    });

    it('should handle missing project name gracefully', () => {
      const configWithoutProjectName = global.testUtils.createMockIosConfig({
        modRequest: {
          ...mockConfig.modRequest,
          projectName: undefined,
        },
      });
      const modifiedConfig = withKlaviyoIos(configWithoutProjectName, mockProps) as any;
      expect(modifiedConfig.modResults).toBeDefined();
      expect(modifiedConfig.modResults.klaviyo_app_group).toBe('group.com.test.app.KlaviyoNotificationServiceExtension.shared');
      expect(modifiedConfig.modResults.klaviyo_badge_autoclearing).toBe(true);
    });
  });
}); 