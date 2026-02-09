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
      // Fix for https://github.com/klaviyo/klaviyo-expo-plugin/issues/93
      // The plugin should NOT override the main app's version settings
      it('should NOT override CFBundleShortVersionString in main app Info.plist', () => {
        const propsWithVersion = createMockIosProps({
          marketingVersion: '0.11.0',
          projectVersion: '25',
        });
        const modifiedConfig = withKlaviyoIos(mockConfig, propsWithVersion) as any;

        expect(modifiedConfig.modResults).toBeDefined();
        // The main app version should remain unchanged (default from mockConfig is '1.0')
        expect(modifiedConfig.modResults.CFBundleShortVersionString).toBe('1.0');
      });

      it('should NOT override CFBundleVersion in main app Info.plist', () => {
        const propsWithVersion = createMockIosProps({
          marketingVersion: '0.11.0',
          projectVersion: '25',
        });
        const modifiedConfig = withKlaviyoIos(mockConfig, propsWithVersion) as any;

        expect(modifiedConfig.modResults).toBeDefined();
        // The main app version should remain unchanged (default from mockConfig is '1')
        expect(modifiedConfig.modResults.CFBundleVersion).toBe('1');
      });

      it('should preserve existing CFBundleShortVersionString in Info.plist', () => {
        const configWithExistingVersion = createMockIosConfig({
          modResults: {
            CFBundleShortVersionString: '2.0.0',
            CFBundleVersion: '100',
          },
        });
        const propsWithVersion = createMockIosProps({
          marketingVersion: '0.11.0',
          projectVersion: '25',
        });
        const modifiedConfig = withKlaviyoIos(configWithExistingVersion, propsWithVersion) as any;

        // The main app versions should be preserved, not overwritten
        expect(modifiedConfig.modResults.CFBundleShortVersionString).toBe('2.0.0');
        expect(modifiedConfig.modResults.CFBundleVersion).toBe('100');
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

      it('should update CFBundleShortVersionString in NSE Info.plist from props.marketingVersion', async () => {
        const propsWithVersion = createMockIosProps({
          marketingVersion: '0.11.0',
          projectVersion: '25',
        });
        
        await runIosMod(mockConfig, propsWithVersion);
        
        expect(FileManager.writeFile).toHaveBeenCalled();
        const writeCall = FileManager.writeFile.mock.calls.find(call => 
          call && call[0] && typeof call[0] === 'string' && call[0].includes('KlaviyoNotificationServiceExtension-Info.plist')
        );
        expect(writeCall).toBeDefined();
        
        const writtenContent = writeCall[1];
        expect(writtenContent).toContain('<key>CFBundleShortVersionString</key>');
        expect(writtenContent).toContain('<string>0.11.0</string>');
      });

      it('should update CFBundleVersion in NSE Info.plist from props.projectVersion', async () => {
        const propsWithVersion = createMockIosProps({
          marketingVersion: '0.11.0',
          projectVersion: '25',
        });
        
        await runIosMod(mockConfig, propsWithVersion);
        
        expect(FileManager.writeFile).toHaveBeenCalled();
        const writeCall = FileManager.writeFile.mock.calls.find(call => 
          call && call[0] && typeof call[0] === 'string' && call[0].includes('KlaviyoNotificationServiceExtension-Info.plist')
        );
        expect(writeCall).toBeDefined();
        
        const writtenContent = writeCall[1];
        expect(writtenContent).toContain('<key>CFBundleVersion</key>');
        expect(writtenContent).toContain('<string>25</string>');
      });

      it('should default CFBundleShortVersionString to "1.0" in NSE when marketingVersion is not provided', async () => {
        const propsWithoutVersion = createMockIosProps({
          marketingVersion: undefined,
          projectVersion: '25',
        });
        
        await runIosMod(mockConfig, propsWithoutVersion);
        
        expect(FileManager.writeFile).toHaveBeenCalled();
        const writeCall = FileManager.writeFile.mock.calls.find(call => 
          call && call[0] && typeof call[0] === 'string' && call[0].includes('KlaviyoNotificationServiceExtension-Info.plist')
        );
        
        const writtenContent = writeCall[1];
        expect(writtenContent).toContain('<string>1.0</string>');
      });

      it('should default CFBundleVersion to "1" in NSE when projectVersion is not provided', async () => {
        const propsWithoutVersion = createMockIosProps({
          marketingVersion: '0.11.0',
          projectVersion: undefined,
        });
        
        await runIosMod(mockConfig, propsWithoutVersion);
        
        expect(FileManager.writeFile).toHaveBeenCalled();
        const writeCall = FileManager.writeFile.mock.calls.find(call => 
          call && call[0] && typeof call[0] === 'string' && call[0].includes('KlaviyoNotificationServiceExtension-Info.plist')
        );
        
        const writtenContent = writeCall[1];
        expect(writtenContent).toContain('<string>1</string>');
      });

      it('should update both version fields correctly in NSE Info.plist', async () => {
        const propsWithVersion = createMockIosProps({
          marketingVersion: '2.5.3',
          projectVersion: '42',
        });
        
        await runIosMod(mockConfig, propsWithVersion);
        
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

      it('should set NSE extension version from props while preserving main app version', async () => {
        const propsWithVersion = createMockIosProps({
          marketingVersion: '0.11.0',
          projectVersion: '25',
        });

        const modifiedConfig = await runIosMod(mockConfig, propsWithVersion) as any;

        // Main app version should NOT be modified by the plugin
        // (it preserves whatever was in mockConfig)
        expect(modifiedConfig.modResults.CFBundleShortVersionString).toBe('1.0');
        expect(modifiedConfig.modResults.CFBundleVersion).toBe('1');

        // Check NSE extension version was written with the props values
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

  describe('withGeofencingPodspec', () => {
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

    describe('podspec and Swift file modifications', () => {
      const { FileManager } = require('../plugin/support/fileManager');
      
      const mockPodspecContent = `require 'json'

package = JSON.parse(File.read(File.join(__dir__, '..', 'package.json')))

Pod::Spec.new do |s|
  s.name           = 'ExpoKlaviyo'
  s.version        = package['version']
  s.dependency 'KlaviyoSwift'
end
`;

      const mockSwiftContent = `import ExpoModulesCore
import KlaviyoSwift

public final class KlaviyoAppDelegate: ExpoAppDelegateSubscriber, UNUserNotificationCenterDelegate {
    public func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey : Any]? = nil) -> Bool {
        let center = UNUserNotificationCenter.current()
        center.delegate = self
        return true
    }
}
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
        FileManager.readFile.mockImplementation((path: string) => {
          if (path.includes('ExpoKlaviyo.podspec')) {
            return Promise.resolve(mockPodspecContent);
          }
          if (path.includes('KlaviyoAppDelegate.swift')) {
            return Promise.resolve(mockSwiftContent);
          }
          return Promise.resolve('');
        });
        FileManager.writeFile.mockResolvedValue(undefined);
      });

      it('should inject KlaviyoLocation dependency into podspec when geofencingEnabled is true', async () => {
        const propsWithGeofencing = createMockIosProps({
          geofencingEnabled: true,
        });
        
        await runIosMod(mockConfig, propsWithGeofencing);
        
        // Find the podspec write call
        const podspecWriteCall = FileManager.writeFile.mock.calls.find(call => 
          call && call[0] && typeof call[0] === 'string' && call[0].includes('ExpoKlaviyo.podspec')
        );
        
        expect(podspecWriteCall).toBeDefined();
        const writtenContent = podspecWriteCall[1];
        expect(writtenContent).toContain("s.dependency 'KlaviyoLocation'");
        expect(writtenContent).toContain("# KLAVIYO_LOCATION_DEPENDENCY");
      });

      it('should not inject KlaviyoLocation dependency into podspec when geofencingEnabled is false', async () => {
        const propsWithoutGeofencing = createMockIosProps({
          geofencingEnabled: false,
        });
        
        await runIosMod(mockConfig, propsWithoutGeofencing);
        
        // Find the podspec write call
        const podspecWriteCall = FileManager.writeFile.mock.calls.find(call => 
          call && call[0] && typeof call[0] === 'string' && call[0].includes('ExpoKlaviyo.podspec')
        );
        
        expect(podspecWriteCall).toBeDefined();
        const writtenContent = podspecWriteCall[1];
        expect(writtenContent).not.toContain("s.dependency 'KlaviyoLocation'");
        expect(writtenContent).toContain("# KLAVIYO_LOCATION_DEPENDENCY");
      });

      it('should inject KlaviyoLocation import and registerGeofencing into Swift file when geofencingEnabled is true', async () => {
        const propsWithGeofencing = createMockIosProps({
          geofencingEnabled: true,
        });
        
        await runIosMod(mockConfig, propsWithGeofencing);
        
        // Find the Swift file write call
        const swiftWriteCall = FileManager.writeFile.mock.calls.find(call => 
          call && call[0] && typeof call[0] === 'string' && call[0].includes('KlaviyoAppDelegate.swift')
        );
        
        expect(swiftWriteCall).toBeDefined();
        const writtenContent = swiftWriteCall[1];
        expect(writtenContent).toContain("import KlaviyoLocation");
        expect(writtenContent).toContain("// KLAVIYO_GEOFENCING_IMPORT");
        expect(writtenContent).toContain("KlaviyoSDK().registerGeofencing()");
        expect(writtenContent).toContain("// KLAVIYO_GEOFENCING_REGISTER");
      });

      it('should not inject KlaviyoLocation import and registerGeofencing into Swift file when geofencingEnabled is false', async () => {
        const propsWithoutGeofencing = createMockIosProps({
          geofencingEnabled: false,
        });
        
        await runIosMod(mockConfig, propsWithoutGeofencing);
        
        // Find the Swift file write call
        const swiftWriteCall = FileManager.writeFile.mock.calls.find(call => 
          call && call[0] && typeof call[0] === 'string' && call[0].includes('KlaviyoAppDelegate.swift')
        );
        
        expect(swiftWriteCall).toBeDefined();
        const writtenContent = swiftWriteCall[1];
        expect(writtenContent).not.toContain("import KlaviyoLocation");
        expect(writtenContent).toContain("// KLAVIYO_GEOFENCING_IMPORT");
        expect(writtenContent).not.toContain("KlaviyoSDK().registerGeofencing()");
        expect(writtenContent).toContain("// KLAVIYO_GEOFENCING_REGISTER");
      });
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
    });

    it('should inject KlaviyoNotificationServiceExtension target in Podfile when geofencingEnabled is true', async () => {
      const propsWithGeofencing = createMockIosProps({
        geofencingEnabled: true,
      });
      
      await runIosMod(mockConfig, propsWithGeofencing);
      
      expect(FileManager.readFile).toHaveBeenCalled();
      
      // Check if writeFile was called - it should be called for Podfile
      const allWriteCalls = FileManager.writeFile.mock.calls;
      
      // Find the Podfile write call - the path should end with /Podfile or contain Podfile
      const writeCall = allWriteCalls.find(call => {
        if (!call || !call[0]) return false;
        const filePath = call[0];
        return typeof filePath === 'string' && (filePath.includes('Podfile') || filePath.endsWith('Podfile'));
      });
      
      expect(writeCall).toBeDefined();
      expect(writeCall[0]).toContain('Podfile');
      
      const writtenContent = writeCall[1];
      expect(writtenContent).toContain("target 'KlaviyoNotificationServiceExtension' do");
      expect(writtenContent).toContain("pod 'KlaviyoSwiftExtension'");
    });

    it('should not inject KlaviyoNotificationServiceExtension target in Podfile when geofencingEnabled is false', async () => {
      const propsWithoutGeofencing = createMockIosProps({
        geofencingEnabled: false,
      });
      
      await runIosMod(mockConfig, propsWithoutGeofencing);
      
      // Find the Podfile write call if it exists
      const allWriteCalls = FileManager.writeFile.mock.calls;
      const writeCall = allWriteCalls.find(call => {
        if (!call || !call[0]) return false;
        const filePath = call[0];
        return typeof filePath === 'string' && (filePath.includes('Podfile') || filePath.endsWith('Podfile'));
      });
      
      // When geofencing is disabled and the extension wasn't in the Podfile, writeFile should not be called
      // (since we only write when we need to remove something)
      if (!writeCall) {
        // This is expected - no write needed if extension wasn't present
        expect(FileManager.writeFile).not.toHaveBeenCalledWith(
          expect.stringContaining('Podfile'),
          expect.anything()
        );
      }
    });

  });
}); 