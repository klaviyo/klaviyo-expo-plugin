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

describe('withKlaviyoIos - Entitlements Generation', () => {
  let mockConfig: any;
  let mockProps: KlaviyoPluginIosProps;

  beforeEach(() => {
    jest.clearAllMocks();
    mockConfig = global.testUtils.createMockIosConfig();
    mockProps = global.testUtils.createMockIosProps();
  });

  describe('withKlaviyoAppGroup plugin', () => {
    it('should generate entitlements with correct app group identifier', () => {
      // Create a config that simulates the entitlements plist modification
      const configWithEntitlements = global.testUtils.createMockIosConfig({
        modResults: {
          // Simulate existing entitlements content
          'com.apple.security.application-groups': [],
        },
      });

      // Run the plugin
      const modifiedConfig = withKlaviyoIos(configWithEntitlements, mockProps) as any;

      // Verify the entitlements were modified correctly
      expect(modifiedConfig.modResults).toBeDefined();
      expect(modifiedConfig.modResults['com.apple.security.application-groups']).toBeDefined();
      expect(Array.isArray(modifiedConfig.modResults['com.apple.security.application-groups'])).toBe(true);
      
      // Verify the correct app group identifier is present
      const appGroups = modifiedConfig.modResults['com.apple.security.application-groups'];
      expect(appGroups).toContain('group.$(PRODUCT_BUNDLE_IDENTIFIER).KlaviyoNotificationServiceExtension.shared');
    });

    it('should add app group to existing entitlements without duplicates', () => {
      // Create a config with existing app groups
      const configWithExistingEntitlements = global.testUtils.createMockIosConfig({
        modResults: {
          'com.apple.security.application-groups': [
            'group.existing.app.shared',
            'group.another.app.shared'
          ],
        },
      });

      // Run the plugin
      const modifiedConfig = withKlaviyoIos(configWithExistingEntitlements, mockProps) as any;

      // Verify the entitlements were modified correctly
      expect(modifiedConfig.modResults).toBeDefined();
      expect(modifiedConfig.modResults['com.apple.security.application-groups']).toBeDefined();
      
      const appGroups = modifiedConfig.modResults['com.apple.security.application-groups'];
      
      // Verify existing groups are preserved
      expect(appGroups).toContain('group.existing.app.shared');
      expect(appGroups).toContain('group.another.app.shared');
      
      // Verify the Klaviyo app group is added
      expect(appGroups).toContain('group.$(PRODUCT_BUNDLE_IDENTIFIER).KlaviyoNotificationServiceExtension.shared');
      
      // Verify no duplicates
      expect(appGroups).toHaveLength(3);
    });

    it('should fail if the app group identifier is incorrect (simulating reverted line 7)', () => {
      // Create a config that simulates the entitlements plist modification
      const configWithEntitlements = global.testUtils.createMockIosConfig({
        modResults: {
          'com.apple.security.application-groups': [],
        },
      });

      // Run the plugin
      const modifiedConfig = withKlaviyoIos(configWithEntitlements, mockProps) as any;

      // Verify the entitlements were modified correctly
      expect(modifiedConfig.modResults).toBeDefined();
      const appGroups = modifiedConfig.modResults['com.apple.security.application-groups'];
      
      // This test will fail if the app group identifier is reverted to incorrect values
      expect(appGroups).not.toContain('group.$(PRODUCT_BUNDLE_IDENTIFIER).shared');
      expect(appGroups).not.toContain('group.com.klaviyo.shared');
      expect(appGroups).not.toContain('group.$(PRODUCT_BUNDLE_IDENTIFIER).shared');
      
      // Verify it contains the correct full identifier with KlaviyoNotificationServiceExtension
      expect(appGroups).toContain('group.$(PRODUCT_BUNDLE_IDENTIFIER).KlaviyoNotificationServiceExtension.shared');
    });

    it('should handle empty entitlements gracefully', () => {
      // Create a config with empty entitlements
      const configWithEmptyEntitlements = global.testUtils.createMockIosConfig({
        modResults: {},
      });

      // Run the plugin
      const modifiedConfig = withKlaviyoIos(configWithEmptyEntitlements, mockProps) as any;

      // Verify the entitlements were created correctly
      expect(modifiedConfig.modResults).toBeDefined();
      expect(modifiedConfig.modResults['com.apple.security.application-groups']).toBeDefined();
      
      const appGroups = modifiedConfig.modResults['com.apple.security.application-groups'];
      expect(Array.isArray(appGroups)).toBe(true);
      expect(appGroups).toContain('group.$(PRODUCT_BUNDLE_IDENTIFIER).KlaviyoNotificationServiceExtension.shared');
      expect(appGroups).toHaveLength(1);
    });

    it('should handle undefined entitlements gracefully', () => {
      // Create a config with undefined entitlements
      const configWithUndefinedEntitlements = global.testUtils.createMockIosConfig({
        modResults: {
          'com.apple.security.application-groups': undefined,
        },
      });

      // Run the plugin
      const modifiedConfig = withKlaviyoIos(configWithUndefinedEntitlements, mockProps) as any;

      // Verify the entitlements were created correctly
      expect(modifiedConfig.modResults).toBeDefined();
      expect(modifiedConfig.modResults['com.apple.security.application-groups']).toBeDefined();
      
      const appGroups = modifiedConfig.modResults['com.apple.security.application-groups'];
      expect(Array.isArray(appGroups)).toBe(true);
      expect(appGroups).toContain('group.$(PRODUCT_BUNDLE_IDENTIFIER).KlaviyoNotificationServiceExtension.shared');
      expect(appGroups).toHaveLength(1);
    });
  });

  describe('app group identifier format validation', () => {
    it('should use the correct app group identifier format', () => {
      const configWithEntitlements = global.testUtils.createMockIosConfig({
        modResults: {
          'com.apple.security.application-groups': [],
        },
      });

      const modifiedConfig = withKlaviyoIos(configWithEntitlements, mockProps) as any;
      const appGroups = modifiedConfig.modResults['com.apple.security.application-groups'];
      const klaviyoAppGroup = appGroups.find((group: string) => group.includes('KlaviyoNotificationServiceExtension'));

      // Verify the format is correct
      expect(klaviyoAppGroup).toBe('group.$(PRODUCT_BUNDLE_IDENTIFIER).KlaviyoNotificationServiceExtension.shared');
      
      // Verify it contains all required components
      expect(klaviyoAppGroup).toMatch(/^group\.\$\(PRODUCT_BUNDLE_IDENTIFIER\)\.KlaviyoNotificationServiceExtension\.shared$/);
    });

    it('should not contain any hardcoded bundle identifiers', () => {
      const configWithEntitlements = global.testUtils.createMockIosConfig({
        modResults: {
          'com.apple.security.application-groups': [],
        },
      });

      const modifiedConfig = withKlaviyoIos(configWithEntitlements, mockProps) as any;
      const appGroups = modifiedConfig.modResults['com.apple.security.application-groups'];
      const klaviyoAppGroup = appGroups.find((group: string) => group.includes('KlaviyoNotificationServiceExtension'));

      // Verify it uses the variable, not a hardcoded value
      expect(klaviyoAppGroup).toContain('$(PRODUCT_BUNDLE_IDENTIFIER)');
      expect(klaviyoAppGroup).not.toContain('com.klaviyo');
      expect(klaviyoAppGroup).not.toContain('com.example');
    });
  });
}); 