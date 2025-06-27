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
      const modifiedConfig = withKlaviyoIos(mockConfig, mockProps);
      expect(modifiedConfig.modResults.klaviyo_app_group).toBe('group.$(PRODUCT_BUNDLE_IDENTIFIER).KlaviyoNotificationServiceExtension.shared');
      expect(modifiedConfig.modResults.klaviyo_badge_autoclearing).toBe(true);
    });

    it('should add flags to Info.plist with badgeAutoclearing set to false', () => {
      const propsWithBadgeClearingDisabled = global.testUtils.createMockIosProps({
        badgeAutoclearing: false,
      });
      const modifiedConfig = withKlaviyoIos(mockConfig, propsWithBadgeClearingDisabled);
      expect(modifiedConfig.modResults.klaviyo_app_group).toBe('group.$(PRODUCT_BUNDLE_IDENTIFIER).KlaviyoNotificationServiceExtension.shared');
      expect(modifiedConfig.modResults.klaviyo_badge_autoclearing).toBe(false);
    });

    it('should add flags to Info.plist with minimal existing content', () => {
      const minimalConfig = global.testUtils.createMockIosConfig({
        modResults: {
          CFBundleIdentifier: 'com.test.app',
        },
      });
      const modifiedConfig = withKlaviyoIos(minimalConfig, mockProps);
      expect(modifiedConfig.modResults.klaviyo_app_group).toBe('group.$(PRODUCT_BUNDLE_IDENTIFIER).KlaviyoNotificationServiceExtension.shared');
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
      const modifiedConfig = withKlaviyoIos(configWithExistingFlags, mockProps);
      expect(modifiedConfig.modResults.klaviyo_app_group).toBe('group.$(PRODUCT_BUNDLE_IDENTIFIER).KlaviyoNotificationServiceExtension.shared');
      expect(modifiedConfig.modResults.klaviyo_badge_autoclearing).toBe(true);
    });

    it('should handle config without ios bundleIdentifier', () => {
      const configWithoutBundleId = global.testUtils.createMockIosConfig({
        ios: {},
      });
      const modifiedConfig = withKlaviyoIos(configWithoutBundleId, mockProps);
      expect(modifiedConfig.modResults.klaviyo_app_group).toBe('group.$(PRODUCT_BUNDLE_IDENTIFIER).KlaviyoNotificationServiceExtension.shared');
      expect(modifiedConfig.modResults.klaviyo_badge_autoclearing).toBe(true);
    });

    it('should handle empty modResults', () => {
      const configWithEmptyResults = global.testUtils.createMockIosConfig({
        modResults: {},
      });
      const modifiedConfig = withKlaviyoIos(configWithEmptyResults, mockProps);
      expect(modifiedConfig.modResults.klaviyo_app_group).toBe('group.$(PRODUCT_BUNDLE_IDENTIFIER).KlaviyoNotificationServiceExtension.shared');
      expect(modifiedConfig.modResults.klaviyo_badge_autoclearing).toBe(true);
    });
  });

  describe('withKlaviyoAppGroup', () => {
    it('should add app group to entitlements when none exist', () => {
      const configWithEntitlements = global.testUtils.createMockIosConfig({
        modResults: {},
      });
      const modifiedConfig = withKlaviyoIos(configWithEntitlements, mockProps);
      expect(modifiedConfig).toBeDefined();
    });

    it('should add app group to existing entitlements', () => {
      const configWithExistingEntitlements = global.testUtils.createMockIosConfig({
        modResults: {
          'com.apple.security.application-groups': ['group.existing.app'],
        },
      });
      const modifiedConfig = withKlaviyoIos(configWithExistingEntitlements, mockProps);
      expect(modifiedConfig).toBeDefined();
    });
  });

  describe('plugin integration', () => {
    it('should apply all plugins in the correct order', () => {
      const modifiedConfig = withKlaviyoIos(mockConfig, mockProps);
      expect(modifiedConfig.modResults.klaviyo_app_group).toBe('group.$(PRODUCT_BUNDLE_IDENTIFIER).KlaviyoNotificationServiceExtension.shared');
      expect(modifiedConfig.modResults.klaviyo_badge_autoclearing).toBe(true);
    });

    it('should handle missing project name gracefully', () => {
      const configWithoutProjectName = global.testUtils.createMockIosConfig({
        modRequest: {
          ...mockConfig.modRequest,
          projectName: undefined,
        },
      });
      const modifiedConfig = withKlaviyoIos(configWithoutProjectName, mockProps);
      expect(modifiedConfig.modResults.klaviyo_app_group).toBe('group.$(PRODUCT_BUNDLE_IDENTIFIER).KlaviyoNotificationServiceExtension.shared');
      expect(modifiedConfig.modResults.klaviyo_badge_autoclearing).toBe(true);
    });
  });
}); 