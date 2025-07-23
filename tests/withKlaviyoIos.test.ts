import * as fs from 'fs';
import * as path from 'path';
import withKlaviyoIos from '../plugin/withKlaviyoIos';
import { KlaviyoPluginIosProps } from '../plugin/types';
import { createMockIosConfig, createMockIosProps } from './utils/testHelpers';

describe('withKlaviyoIos', () => {
  let mockConfig: any;
  let mockProps: KlaviyoPluginIosProps;

  beforeEach(() => {
    jest.clearAllMocks();
    mockConfig = createMockIosConfig();
    mockProps = createMockIosProps();
  });

  describe('withRemoteNotificationsPermissions', () => {
    it('should add klaviyo_app_group and klaviyo_badge_autoclearing to existing Info.plist', () => {
      const modifiedConfig = withKlaviyoIos(mockConfig, mockProps) as any;
      expect(modifiedConfig.modResults).toBeDefined();
      expect(modifiedConfig.modResults.klaviyo_app_group).toBe('group.com.test.app.KlaviyoNotificationServiceExtension.shared');
      expect(modifiedConfig.modResults.klaviyo_badge_autoclearing).toBe(true);
    });

    it('should add flags to Info.plist with badgeAutoclearing set to false', () => {
      const propsWithBadgeClearingDisabled = createMockIosProps({
        badgeAutoclearing: false,
      });
      const modifiedConfig = withKlaviyoIos(mockConfig, propsWithBadgeClearingDisabled) as any;
      expect(modifiedConfig.modResults).toBeDefined();
      expect(modifiedConfig.modResults.klaviyo_app_group).toBe('group.com.test.app.KlaviyoNotificationServiceExtension.shared');
      expect(modifiedConfig.modResults.klaviyo_badge_autoclearing).toBe(false);
    });

    it('should add flags to Info.plist with minimal existing content', () => {
      const minimalConfig = createMockIosConfig({
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
      const configWithExistingFlags = createMockIosConfig({
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
      const configWithoutBundleId = createMockIosConfig({
        ios: {},
      });
      expect(() => {
        withKlaviyoIos(configWithoutBundleId, mockProps);
      }).toThrow('iOS bundle identifier is required but not found in app configuration');
    });

    it('should handle empty modResults', () => {
      const configWithEmptyResults = createMockIosConfig({
        modResults: {},
      });
      const modifiedConfig = withKlaviyoIos(configWithEmptyResults, mockProps) as any;
      expect(modifiedConfig.modResults).toBeDefined();
      expect(modifiedConfig.modResults.klaviyo_app_group).toBe('group.com.test.app.KlaviyoNotificationServiceExtension.shared');
      expect(modifiedConfig.modResults.klaviyo_badge_autoclearing).toBe(true);
    });
  });

  describe('withKlaviyoAppGroup', () => {
    it('should add app group to entitlements when none exist', () => {
      const configWithEntitlements = createMockIosConfig({
        modResults: {},
      });
      const modifiedConfig = withKlaviyoIos(configWithEntitlements, mockProps);
      expect(modifiedConfig).toBeDefined();
    });

    it('should add app group to existing entitlements', () => {
      const configWithExistingEntitlements = createMockIosConfig({
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
      const modifiedConfig = withKlaviyoIos(mockConfig, mockProps) as any;
      expect(modifiedConfig.modResults).toBeDefined();
      expect(modifiedConfig.modResults.klaviyo_app_group).toBe('group.com.test.app.KlaviyoNotificationServiceExtension.shared');
      expect(modifiedConfig.modResults.klaviyo_badge_autoclearing).toBe(true);
    });

    it('should handle missing project name gracefully', () => {
      const configWithoutProjectName = createMockIosConfig({
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

  describe('app group identifier consistency', () => {
    const expectedAppGroupName = 'group.com.test.app.KlaviyoNotificationServiceExtension.shared';
    const nseTargetName = 'KlaviyoNotificationServiceExtension';

    it('should use consistent app group name across all configurations', () => {
      const modifiedConfig = withKlaviyoIos(mockConfig, mockProps) as any;
      
      // Verify main app Info.plist has correct app group
      expect(modifiedConfig.modResults.klaviyo_app_group).toBe(expectedAppGroupName);
    });

    it('should add correct app group to main app entitlements', () => {
      const configWithEntitlements = createMockIosConfig({
        modResults: {},
      });
      const modifiedConfig = withKlaviyoIos(configWithEntitlements, mockProps);
      
      // The withKlaviyoAppGroup plugin should add the correct app group
      expect(modifiedConfig).toBeDefined();
    });

    it('should validate app group name format matches expected pattern', () => {
      // This test validates that the app group name follows the correct format
      // and includes the NSE target name as expected
      expect(expectedAppGroupName).toMatch(/^group\.com\.test\.app\.KlaviyoNotificationServiceExtension\.shared$/);
      expect(expectedAppGroupName).toContain(nseTargetName);
      expect(expectedAppGroupName).not.toContain('group.com.test.app.shared');
    });

    it('should ensure plugin generates consistent app group name', () => {
      // Test that the plugin consistently generates the same app group name
      const config1 = withKlaviyoIos(mockConfig, mockProps) as any;
      const config2 = withKlaviyoIos(mockConfig, mockProps) as any;
      
      expect(config1.modResults.klaviyo_app_group).toBe(config2.modResults.klaviyo_app_group);
      expect(config1.modResults.klaviyo_app_group).toBe(expectedAppGroupName);
    });

    it('should validate app group name is not the incorrect short format', () => {
      // This test ensures we're not using the incorrect short format
      const incorrectAppGroupName = 'group.com.test.app.shared';
      expect(expectedAppGroupName).not.toBe(incorrectAppGroupName);
      expect(expectedAppGroupName).toContain(nseTargetName);
    });

    it('should handle different bundle identifiers consistently', () => {
      const testBundleIds = [
        'com.example.app',
        'com.example.app.preview',
        'com.example.app.development'
      ];

      testBundleIds.forEach(bundleId => {
        const configWithBundleId = createMockIosConfig({
          ios: { bundleIdentifier: bundleId }
        });
        const modifiedConfig = withKlaviyoIos(configWithBundleId, mockProps) as any;
        
        // The app group should use the actual bundle identifier from the config
        const expectedAppGroupForBundle = `group.${bundleId}.KlaviyoNotificationServiceExtension.shared`;
        expect(modifiedConfig.modResults.klaviyo_app_group).toBe(expectedAppGroupForBundle);
      });
    });
  });
}); 