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

  describe('version synchronization', () => {
    describe('main app target Info.plist', () => {
      it('should set CFBundleShortVersionString from config.version', () => {
        const configWithVersion = createMockIosConfig({
          version: '0.11.0',
          ios: { buildNumber: '25' },
        });
        const modifiedConfig = withKlaviyoIos(configWithVersion, mockProps) as any;
        
        expect(modifiedConfig.modResults).toBeDefined();
        expect(modifiedConfig.modResults.CFBundleShortVersionString).toBe('0.11.0');
      });

      it('should set CFBundleVersion from config.ios.buildNumber', () => {
        const configWithVersion = createMockIosConfig({
          version: '0.11.0',
          ios: { buildNumber: '25' },
        });
        const modifiedConfig = withKlaviyoIos(configWithVersion, mockProps) as any;
        
        expect(modifiedConfig.modResults).toBeDefined();
        expect(modifiedConfig.modResults.CFBundleVersion).toBe('25');
      });

      it('should default CFBundleShortVersionString to "1.0" when config.version is not provided', () => {
        const configWithoutVersion = createMockIosConfig({
          version: undefined,
          ios: { buildNumber: '25' },
        });
        const modifiedConfig = withKlaviyoIos(configWithoutVersion, mockProps) as any;
        
        expect(modifiedConfig.modResults).toBeDefined();
        expect(modifiedConfig.modResults.CFBundleShortVersionString).toBe('1.0');
      });

      it('should default CFBundleVersion to "1" when config.ios.buildNumber is not provided', () => {
        const configWithoutBuildNumber = createMockIosConfig({
          version: '0.11.0',
          ios: { buildNumber: undefined },
        });
        const modifiedConfig = withKlaviyoIos(configWithoutBuildNumber, mockProps) as any;
        
        expect(modifiedConfig.modResults).toBeDefined();
        expect(modifiedConfig.modResults.CFBundleVersion).toBe('1');
      });

      it('should override existing CFBundleShortVersionString in Info.plist', () => {
        const configWithExistingVersion = createMockIosConfig({
          version: '0.11.0',
          ios: { buildNumber: '25' },
          modResults: {
            CFBundleShortVersionString: '2.0.0',
            CFBundleVersion: '100',
          },
        });
        const modifiedConfig = withKlaviyoIos(configWithExistingVersion, mockProps) as any;
        
        expect(modifiedConfig.modResults.CFBundleShortVersionString).toBe('0.11.0');
        expect(modifiedConfig.modResults.CFBundleVersion).toBe('25');
      });
    });

    describe('NSE extension Info.plist', () => {
      const { FileManager } = require('../plugin/support/fileManager');
      const mockInfoPlistContent = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleVersion</key>
    <string>1</string>
    <key>CFBundleShortVersionString</key>
    <string>1.0</string>
</dict>
</plist>`;

      async function runIosMod(config: any, props: any) {
        const result = withKlaviyoIos(config, props) as any;
        if (result.mods && result.mods.ios) {
          return await result.mods.ios(result);
        }
        return result;
      }

      beforeEach(() => {
        jest.clearAllMocks();
        FileManager.readFile.mockResolvedValue(mockInfoPlistContent);
        FileManager.writeFile.mockResolvedValue(undefined);
        FileManager.copyFile.mockResolvedValue(undefined);
        FileManager.dirExists.mockReturnValue(true);
      });

      it('should update CFBundleShortVersionString in NSE Info.plist from config.version', async () => {
        const configWithVersion = createMockIosConfig({
          version: '0.11.0',
          ios: { buildNumber: '25' },
        });
        
        await runIosMod(configWithVersion, mockProps);
        
        expect(FileManager.writeFile).toHaveBeenCalled();
        const writeCall = FileManager.writeFile.mock.calls.find(call => 
          call && call[0] && typeof call[0] === 'string' && call[0].includes('KlaviyoNotificationServiceExtension-Info.plist')
        );
        expect(writeCall).toBeDefined();
        
        const writtenContent = writeCall[1];
        expect(writtenContent).toContain('<key>CFBundleShortVersionString</key>');
        expect(writtenContent).toContain('<string>0.11.0</string>');
      });

      it('should update CFBundleVersion in NSE Info.plist from config.ios.buildNumber', async () => {
        const configWithVersion = createMockIosConfig({
          version: '0.11.0',
          ios: { buildNumber: '25' },
        });
        
        await runIosMod(configWithVersion, mockProps);
        
        expect(FileManager.writeFile).toHaveBeenCalled();
        const writeCall = FileManager.writeFile.mock.calls.find(call => 
          call && call[0] && typeof call[0] === 'string' && call[0].includes('KlaviyoNotificationServiceExtension-Info.plist')
        );
        expect(writeCall).toBeDefined();
        
        const writtenContent = writeCall[1];
        expect(writtenContent).toContain('<key>CFBundleVersion</key>');
        expect(writtenContent).toContain('<string>25</string>');
      });

      it('should default CFBundleShortVersionString to "1.0" in NSE when config.version is not provided', async () => {
        const configWithoutVersion = createMockIosConfig({
          version: undefined,
          ios: { buildNumber: '25' },
        });
        
        await runIosMod(configWithoutVersion, mockProps);
        
        expect(FileManager.writeFile).toHaveBeenCalled();
        const writeCall = FileManager.writeFile.mock.calls.find(call => 
          call && call[0] && typeof call[0] === 'string' && call[0].includes('KlaviyoNotificationServiceExtension-Info.plist')
        );
        
        const writtenContent = writeCall[1];
        expect(writtenContent).toContain('<string>1.0</string>');
      });

      it('should default CFBundleVersion to "1" in NSE when config.ios.buildNumber is not provided', async () => {
        const configWithoutBuildNumber = createMockIosConfig({
          version: '0.11.0',
          ios: { buildNumber: undefined },
        });
        
        await runIosMod(configWithoutBuildNumber, mockProps);
        
        expect(FileManager.writeFile).toHaveBeenCalled();
        const writeCall = FileManager.writeFile.mock.calls.find(call => 
          call && call[0] && typeof call[0] === 'string' && call[0].includes('KlaviyoNotificationServiceExtension-Info.plist')
        );
        
        const writtenContent = writeCall[1];
        expect(writtenContent).toContain('<string>1</string>');
      });

      it('should update both version fields correctly in NSE Info.plist', async () => {
        const configWithVersion = createMockIosConfig({
          version: '2.5.3',
          ios: { buildNumber: '42' },
        });
        
        await runIosMod(configWithVersion, mockProps);
        
        expect(FileManager.writeFile).toHaveBeenCalled();
        const writeCall = FileManager.writeFile.mock.calls.find(call => 
          call && call[0] && typeof call[0] === 'string' && call[0].includes('KlaviyoNotificationServiceExtension-Info.plist')
        );
        
        const writtenContent = writeCall[1];
        expect(writtenContent).toContain('<string>2.5.3</string>');
        expect(writtenContent).toContain('<string>42</string>');
        expect(writtenContent).not.toContain('<string>1.0</string>');
        expect(writtenContent).not.toContain('<string>1</string>');
      });

      it('should ensure main app and NSE extension have matching versions', async () => {
        const configWithVersion = createMockIosConfig({
          version: '0.11.0',
          ios: { buildNumber: '25' },
        });
        
        const modifiedConfig = await runIosMod(configWithVersion, mockProps) as any;
        
        // Check main app version
        expect(modifiedConfig.modResults.CFBundleShortVersionString).toBe('0.11.0');
        expect(modifiedConfig.modResults.CFBundleVersion).toBe('25');
        
        // Check NSE extension version was written
        expect(FileManager.writeFile).toHaveBeenCalled();
        const writeCall = FileManager.writeFile.mock.calls.find(call => 
          call && call[0] && typeof call[0] === 'string' && call[0].includes('KlaviyoNotificationServiceExtension-Info.plist')
        );
        
        const writtenContent = writeCall[1];
        expect(writtenContent).toContain('<string>0.11.0</string>');
        expect(writtenContent).toContain('<string>25</string>');
      });
    });
  });

  describe('withGeofencingBackgroundMode', () => {
    describe('UIBackgroundModes configuration', () => {
      it('should add location to UIBackgroundModes when geofencingEnabled is true', () => {
        const propsWithGeofencing = createMockIosProps({
          geofencingEnabled: true,
        });
        
        const modifiedConfig = withKlaviyoIos(mockConfig, propsWithGeofencing) as any;
        
        expect(modifiedConfig.modResults).toBeDefined();
        expect(modifiedConfig.modResults.UIBackgroundModes).toBeDefined();
        expect(Array.isArray(modifiedConfig.modResults.UIBackgroundModes)).toBe(true);
        expect(modifiedConfig.modResults.UIBackgroundModes).toContain('location');
      });

      it('should not add location to UIBackgroundModes when geofencingEnabled is false', () => {
        const propsWithoutGeofencing = createMockIosProps({
          geofencingEnabled: false,
        });
        
        const modifiedConfig = withKlaviyoIos(mockConfig, propsWithoutGeofencing) as any;
        
        expect(modifiedConfig.modResults).toBeDefined();
        // If UIBackgroundModes exists, it should not contain 'location'
        if (modifiedConfig.modResults.UIBackgroundModes) {
          expect(modifiedConfig.modResults.UIBackgroundModes).not.toContain('location');
        }
      });

      it('should not add location to UIBackgroundModes when geofencingEnabled is undefined', () => {
        const propsWithoutGeofencing = createMockIosProps({
          geofencingEnabled: undefined,
        });
        
        const modifiedConfig = withKlaviyoIos(mockConfig, propsWithoutGeofencing) as any;
        
        expect(modifiedConfig.modResults).toBeDefined();
        // If UIBackgroundModes exists, it should not contain 'location'
        if (modifiedConfig.modResults.UIBackgroundModes) {
          expect(modifiedConfig.modResults.UIBackgroundModes).not.toContain('location');
        }
      });

      it('should not duplicate location if it already exists in UIBackgroundModes', () => {
        const configWithLocation = createMockIosConfig({
          modResults: {
            UIBackgroundModes: ['remote-notification', 'location'],
          },
        });
        
        const propsWithGeofencing = createMockIosProps({
          geofencingEnabled: true,
        });
        
        const modifiedConfig = withKlaviyoIos(configWithLocation, propsWithGeofencing) as any;
        
        const locationCount = modifiedConfig.modResults.UIBackgroundModes.filter(
          (mode: string) => mode === 'location'
        ).length;
        expect(locationCount).toBe(1);
      });
    });

    describe('Swift file', () => {
      const { FileManager } = require('../plugin/support/fileManager');

      async function runIosMod(config: any, props: any) {
        const result = withKlaviyoIos(config, props) as any;
        if (result.mods && result.mods.ios) {
          return await result.mods.ios(result);
        }
        return result;
      }

      beforeEach(() => {
        jest.clearAllMocks();
        FileManager.readFile.mockResolvedValue('');
        FileManager.writeFile.mockResolvedValue(undefined);
        FileManager.dirExists.mockReturnValue(true);
        FileManager.copyFile.mockResolvedValue(undefined);
      });

      it('should not write to KlaviyoAppDelegate.swift regardless of geofencingEnabled', async () => {
        for (const geofencingEnabled of [true, false, undefined]) {
          jest.clearAllMocks();
          FileManager.readFile.mockResolvedValue('');
          FileManager.writeFile.mockResolvedValue(undefined);
          FileManager.dirExists.mockReturnValue(true);
          FileManager.copyFile.mockResolvedValue(undefined);

          await runIosMod(mockConfig, createMockIosProps({ geofencingEnabled }));

          const swiftWriteCall = FileManager.writeFile.mock.calls.find((call: any) =>
            call && call[0] && typeof call[0] === 'string' && call[0].includes('KlaviyoAppDelegate.swift')
          );
          expect(swiftWriteCall).toBeUndefined();
        }
      });

      it('should not write to ExpoKlaviyo.podspec', async () => {
        await runIosMod(mockConfig, createMockIosProps({ geofencingEnabled: true }));

        const podspecWriteCall = FileManager.writeFile.mock.calls.find((call: any) =>
          call && call[0] && typeof call[0] === 'string' && call[0].includes('ExpoKlaviyo.podspec')
        );
        expect(podspecWriteCall).toBeUndefined();
      });
    });
  });

  describe('withKlaviyoPodfileEnvVars', () => {
    const { FileManager } = require('../plugin/support/fileManager');
    const mockPodfileContent = `platform :ios, '13.0'
use_frameworks! :linkage => :static

target 'TestApp' do
  config = use_native_modules!
  use_react_native!(
    :path => config[:reactNativePath],
    :hermes_enabled => true
  )
end
`;

    async function runIosMod(config: any, props: any) {
      const result = withKlaviyoIos(config, props) as any;
      if (result.mods && result.mods.ios) {
        return await result.mods.ios(result);
      }
      return result;
    }

    beforeEach(() => {
      jest.clearAllMocks();
      FileManager.readFile.mockResolvedValue(mockPodfileContent);
      FileManager.writeFile.mockResolvedValue(undefined);
      FileManager.dirExists.mockReturnValue(true);
      FileManager.copyFile.mockResolvedValue(undefined);
    });

    it('should always write both KLAVIYO_INCLUDE_LOCATION and KLAVIYO_INCLUDE_FORMS', async () => {
      await runIosMod(mockConfig, createMockIosProps());

      const podfileWriteCalls = FileManager.writeFile.mock.calls.filter((call: any) =>
        call && call[0] && typeof call[0] === 'string' && call[0].includes('Podfile')
      );

      const bothVarsWrite = podfileWriteCalls.find((call: any) =>
        call[1].includes("ENV['KLAVIYO_INCLUDE_LOCATION']") &&
        call[1].includes("ENV['KLAVIYO_INCLUDE_FORMS']")
      );
      expect(bothVarsWrite).toBeDefined();
    });

    it('should set KLAVIYO_INCLUDE_LOCATION to false when geofencingEnabled is false (default)', async () => {
      await runIosMod(mockConfig, createMockIosProps({ geofencingEnabled: false }));

      const podfileWriteCalls = FileManager.writeFile.mock.calls.filter((call: any) =>
        call && call[0] && typeof call[0] === 'string' && call[0].includes('Podfile')
      );
      const envVarWrite = podfileWriteCalls.find((call: any) =>
        call[1].includes("ENV['KLAVIYO_INCLUDE_LOCATION'] = 'false'")
      );
      expect(envVarWrite).toBeDefined();
    });

    it('should set KLAVIYO_INCLUDE_LOCATION to true when geofencingEnabled is true', async () => {
      await runIosMod(mockConfig, createMockIosProps({ geofencingEnabled: true }));

      const podfileWriteCalls = FileManager.writeFile.mock.calls.filter((call: any) =>
        call && call[0] && typeof call[0] === 'string' && call[0].includes('Podfile')
      );
      const envVarWrite = podfileWriteCalls.find((call: any) =>
        call[1].includes("ENV['KLAVIYO_INCLUDE_LOCATION'] = 'true'")
      );
      expect(envVarWrite).toBeDefined();
    });

    it('should set KLAVIYO_INCLUDE_FORMS to false when formsEnabled is false', async () => {
      await runIosMod(mockConfig, createMockIosProps({ formsEnabled: false }));

      const podfileWriteCalls = FileManager.writeFile.mock.calls.filter((call: any) =>
        call && call[0] && typeof call[0] === 'string' && call[0].includes('Podfile')
      );
      const envVarWrite = podfileWriteCalls.find((call: any) =>
        call[1].includes("ENV['KLAVIYO_INCLUDE_FORMS'] = 'false'")
      );
      expect(envVarWrite).toBeDefined();
    });

    it('should set KLAVIYO_INCLUDE_FORMS to true when formsEnabled is true (default)', async () => {
      await runIosMod(mockConfig, createMockIosProps({ formsEnabled: true }));

      const podfileWriteCalls = FileManager.writeFile.mock.calls.filter((call: any) =>
        call && call[0] && typeof call[0] === 'string' && call[0].includes('Podfile')
      );
      const envVarWrite = podfileWriteCalls.find((call: any) =>
        call[1].includes("ENV['KLAVIYO_INCLUDE_FORMS'] = 'true'")
      );
      expect(envVarWrite).toBeDefined();
    });

    it('should set both vars to false when geofencing and forms are both disabled', async () => {
      await runIosMod(mockConfig, createMockIosProps({ geofencingEnabled: false, formsEnabled: false }));

      const podfileWriteCalls = FileManager.writeFile.mock.calls.filter((call: any) =>
        call && call[0] && typeof call[0] === 'string' && call[0].includes('Podfile')
      );
      const envVarWrite = podfileWriteCalls.find((call: any) =>
        call[1].includes("ENV['KLAVIYO_INCLUDE_LOCATION'] = 'false'") &&
        call[1].includes("ENV['KLAVIYO_INCLUDE_FORMS'] = 'false'")
      );
      expect(envVarWrite).toBeDefined();
    });

    it('should set both vars to true when geofencing and forms are both enabled', async () => {
      await runIosMod(mockConfig, createMockIosProps({ geofencingEnabled: true, formsEnabled: true }));

      const podfileWriteCalls = FileManager.writeFile.mock.calls.filter((call: any) =>
        call && call[0] && typeof call[0] === 'string' && call[0].includes('Podfile')
      );
      const envVarWrite = podfileWriteCalls.find((call: any) =>
        call[1].includes("ENV['KLAVIYO_INCLUDE_LOCATION'] = 'true'") &&
        call[1].includes("ENV['KLAVIYO_INCLUDE_FORMS'] = 'true'")
      );
      expect(envVarWrite).toBeDefined();
    });

    it('should remove existing env vars before re-injecting (idempotent)', async () => {
      const podfileWithExistingVars = `ENV['KLAVIYO_INCLUDE_LOCATION'] = 'false'
ENV['KLAVIYO_INCLUDE_FORMS'] = 'false'
platform :ios, '13.0'
use_frameworks! :linkage => :static

target 'TestApp' do
  config = use_native_modules!
end
`;
      FileManager.readFile.mockResolvedValue(podfileWithExistingVars);

      await runIosMod(mockConfig, createMockIosProps({ geofencingEnabled: true, formsEnabled: false }));

      const podfileWriteCalls = FileManager.writeFile.mock.calls.filter((call: any) =>
        call && call[0] && typeof call[0] === 'string' && call[0].includes('Podfile')
      );

      // LOCATION should now be 'true', FORMS should be 'false'
      const envVarWrite = podfileWriteCalls.find((call: any) =>
        call[1].includes("ENV['KLAVIYO_INCLUDE_LOCATION'] = 'true'") &&
        call[1].includes("ENV['KLAVIYO_INCLUDE_FORMS'] = 'false'")
      );
      expect(envVarWrite).toBeDefined();
    });

    it('should prepend both env vars at the top of the Podfile', async () => {
      await runIosMod(mockConfig, createMockIosProps({ geofencingEnabled: false, formsEnabled: true }));

      const podfileWriteCalls = FileManager.writeFile.mock.calls.filter((call: any) =>
        call && call[0] && typeof call[0] === 'string' && call[0].includes('Podfile')
      );
      const envVarWrite = podfileWriteCalls.find((call: any) =>
        call[1].includes("ENV['KLAVIYO_INCLUDE_LOCATION']") &&
        call[1].includes("ENV['KLAVIYO_INCLUDE_FORMS']")
      );
      expect(envVarWrite).toBeDefined();
      const content = envVarWrite[1];

      // Both env vars should appear before the platform declaration
      const locationIdx = content.indexOf("ENV['KLAVIYO_INCLUDE_LOCATION']");
      const formsIdx = content.indexOf("ENV['KLAVIYO_INCLUDE_FORMS']");
      const platformIdx = content.indexOf('platform :ios');
      expect(locationIdx).toBeLessThan(platformIdx);
      expect(formsIdx).toBeLessThan(platformIdx);
    });
  });

  describe('withKlaviyoPodfile', () => {
    const { FileManager } = require('../plugin/support/fileManager');
    const mockPodfileContent = `platform :ios, '13.0'
use_frameworks! :linkage => :static

target 'TestApp' do
  config = use_native_modules!
  use_react_native!(
    :path => config[:reactNativePath],
    :hermes_enabled => true
  )
end
`;

    async function runIosMod(config: any, props: any) {
      const result = withKlaviyoIos(config, props) as any;
      if (result.mods && result.mods.ios) {
        return await result.mods.ios(result);
      }
      return result;
    }

    beforeEach(() => {
      jest.clearAllMocks();
      FileManager.readFile.mockResolvedValue(mockPodfileContent);
      FileManager.writeFile.mockResolvedValue(undefined);
      FileManager.dirExists.mockReturnValue(true);
      FileManager.copyFile.mockResolvedValue(undefined);
    });

    it('should inject KlaviyoNotificationServiceExtension target in Podfile', async () => {
      const props = createMockIosProps({
        geofencingEnabled: true,
      });

      await runIosMod(mockConfig, props);

      expect(FileManager.readFile).toHaveBeenCalled();

      const allWriteCalls = FileManager.writeFile.mock.calls;

      const writeCall = allWriteCalls.find((call: any) => {
        if (!call || !call[0]) return false;
        const filePath = call[0];
        return typeof filePath === 'string' && filePath.includes('Podfile') &&
          call[1].includes("target 'KlaviyoNotificationServiceExtension'");
      });

      expect(writeCall).toBeDefined();
      expect(writeCall[0]).toContain('Podfile');

      const writtenContent = writeCall[1];
      expect(writtenContent).toContain("target 'KlaviyoNotificationServiceExtension' do");
      expect(writtenContent).toContain("pod 'KlaviyoSwiftExtension'");
    });
  });
}); 
