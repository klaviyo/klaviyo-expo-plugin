import { ConfigPlugin, withPlugins, withDangerousMod, withEntitlementsPlist, withInfoPlist, withXcodeProject } from '@expo/config-plugins';
import { KlaviyoPluginIosProps } from './types';
import * as path from 'path';
import * as fs from 'fs';
import { FileManager } from './support/fileManager';
import { KlaviyoLog } from './support/logger';

const withKlaviyoIos: ConfigPlugin<KlaviyoPluginIosProps> = (config, props) => {
  KlaviyoLog.log('Starting iOS plugin configuration...');
  KlaviyoLog.log('Plugin props:' + JSON.stringify(props));

  return withPlugins(config, [
    withKlaviyoPluginConfigurationPlist,
    withRemoteNotificationsPermissions,
    withKlaviyoPodfile,
    withKlaviyoXcodeProject,
    withKlaviyoNSE,
  ].map(plugin => [plugin, props]));
};

export default withKlaviyoIos;

/**
 * Adds klaviyo-plugin-configuration.plist to the iOS project and includes it in the app bundle.
 */
const withKlaviyoPluginConfigurationPlist: ConfigPlugin = config => {
  return withXcodeProject(config, async (config) => {
    const xcodeProject = config.modResults;
    const projectName = config.modRequest.projectName || config.name;
    if (!projectName) {
      throw new Error('Could not determine project name for iOS build');
    }

    // Get the plugin's root directory, accounting for the dist folder
    const pluginRoot = path.resolve(__dirname, '../..');
    const srcPlistPath = path.join(pluginRoot, 'ios', 'klaviyo-plugin-configuration.plist');
    const destPlistPath = path.join(
      config.modRequest.platformProjectRoot,
      projectName,
      'klaviyo-plugin-configuration.plist'
    );

    if (fs.existsSync(srcPlistPath)) {
      // Copy the file
      fs.copyFileSync(srcPlistPath, destPlistPath);
      KlaviyoLog.log(`Copied klaviyo-plugin-configuration.plist to ${destPlistPath}`);

      // Get the main group
      const mainGroupId = xcodeProject.findPBXGroupKey({ name: projectName });
      
      if (!mainGroupId) {
        KlaviyoLog.log(`Could not find main group for project ${projectName}, skipping Xcode project modification`);
        return config;
      }

      // Add the file to the Xcode project
      const fileRef = xcodeProject.addFile(
        destPlistPath,
        mainGroupId,
        { target: xcodeProject.getFirstTarget().uuid }
      );

      if (!fileRef) {
        KlaviyoLog.log('Failed to add file to Xcode project');
        return config;
      }

      // Add the file to the "Copy Bundle Resources" build phase
      const target = xcodeProject.getFirstTarget();
      if (!target) {
        KlaviyoLog.log('Could not find target, skipping build phase modification');
        return config;
      }

      // Find or create the Copy Bundle Resources build phase
      let buildPhase = xcodeProject.buildPhaseObject(
        target.uuid,
        'PBXResourcesBuildPhase'
      );

      if (!buildPhase) {
        // Create the build phase if it doesn't exist
        buildPhase = xcodeProject.addBuildPhase(
          [],
          'PBXResourcesBuildPhase',
          'Copy Bundle Resources',
          target.uuid
        );
        KlaviyoLog.log('Created Copy Bundle Resources build phase');
      }

      if (buildPhase) {
        // Add the file as a resource
        xcodeProject.addResourceFile(destPlistPath, { target: target.uuid });
        KlaviyoLog.log('Added klaviyo-plugin-configuration.plist to Xcode project');

        // Ensure the file is included in the build phase
        const buildPhaseFiles = buildPhase.files || [];
        const fileRefId = fileRef.fileRef;
        
        // Check if the file is already in the build phase
        const fileAlreadyInBuildPhase = buildPhaseFiles.some(
          (file: any) => file.fileRef === fileRefId
        );

        if (!fileAlreadyInBuildPhase) {
          // Add the file to the build phase
          xcodeProject.addToPbxBuildFileSection(fileRef);
          xcodeProject.addToPbxResourcesBuildPhase(fileRef);
          KlaviyoLog.log('Added klaviyo-plugin-configuration.plist to Copy Bundle Resources build phase');
        }
      } else {
        KlaviyoLog.log('Failed to create or find Copy Bundle Resources build phase');
      }
    } else {
      KlaviyoLog.log(`Source plist not found at ${srcPlistPath}`);
    }

    return config;
  });
};

const NSE_TARGET_NAME = "KlaviyoNotificationServiceExtension";
const NSE_EXT_FILES = [
  "KlaviyoNotificationService.swift"
];
// Use the actual bundle identifier from config instead of build-time variable
const getAppGroupName = (config: any) => {
  const bundleId = config.ios?.bundleIdentifier;
  if (!bundleId) {
    throw new Error('iOS bundle identifier is required for app group configuration');
  }
  return `group.${bundleId}.${NSE_TARGET_NAME}.shared`;
};

/**
 * Adds remote notifications permissions and other associated values in the plist.
 */
const withRemoteNotificationsPermissions: ConfigPlugin<KlaviyoPluginIosProps> = (
  config,
  props
) => {
  KlaviyoLog.log('Setting up remote notifications permissions...');

  return withInfoPlist(config, (config) => {
    const infoPlist = config.modResults;
    infoPlist.klaviyo_badge_autoclearing = props.badgeAutoclearing;
    return config;
  });
};

/**
 * Adds necessary Klaviyo pods to the Podfile setup.
 */
const withKlaviyoPodfile: ConfigPlugin<KlaviyoPluginIosProps> = (config) => {
  return withDangerousMod(config, [
    'ios',
    async config => {
      const iosRoot = path.join(config.modRequest.projectRoot, "ios");
      try {
        const podfile = await FileManager.readFile(`${iosRoot}/Podfile`);
        // Check for both standard and linkage-specific use_frameworks!
        const usesFrameworks = podfile.includes('use_frameworks!');
        const usesFrameworksWithLinkage = podfile.includes('use_frameworks! :linkage');
        
        // Extract the linkage type if it exists
        let linkageType = '';
        if (usesFrameworksWithLinkage) {
          const linkageMatch = podfile.match(/use_frameworks!\s*:linkage\s*=>\s*([^,\n]+)/);
          if (linkageMatch) {
            linkageType = linkageMatch[1];
          }
        }
        
        const podInsertion = `
  target 'KlaviyoNotificationServiceExtension' do
    ${usesFrameworks ? `use_frameworks!${linkageType ? ` :linkage => ${linkageType}` : ''}` : ''}
    pod 'KlaviyoSwiftExtension'
  end
  `;
        if (!podfile.includes("pod 'KlaviyoSwiftExtension'")) {
          const updatedPodfile = `${podfile}\n${podInsertion}`;
          await FileManager.writeFile(`${iosRoot}/Podfile`, updatedPodfile);
        }
      } catch (err) {
        KlaviyoLog.log('Could not write Klaviyo changes to Podfile: ' + err);
      }
      
      return config;
    },
  ]);
};

/**
 * Adds the Notification Service Extension target and build phases.
 */
const withKlaviyoXcodeProject: ConfigPlugin<KlaviyoPluginIosProps> = (config, props) => {
  return withXcodeProject(config, async (config) => {
    const xcodeProject = config.modResults;
    if (!!xcodeProject.pbxGroupByName(NSE_TARGET_NAME)) {
      KlaviyoLog.log(`⚠️ ${NSE_TARGET_NAME} already exists in project. Skipping...`);
      return config;
    }

    // create the NSE group
    const extGroup = xcodeProject.addPbxGroup(
      NSE_EXT_FILES,
      NSE_TARGET_NAME, 
      NSE_TARGET_NAME
    );

    // add the group to the main group
    const groups = xcodeProject.hash.project.objects["PBXGroup"];
    Object.keys(groups).forEach(function(key) {
      if (typeof groups[key] === "object" && groups[key].name === undefined && groups[key].path === undefined) {
        xcodeProject.addToPbxGroup(extGroup.uuid, key);
      }
    });
    
    const projObjects = config.modResults.hash.project.objects;
    projObjects['PBXTargetDependency'] = projObjects['PBXTargetDependency'] || {};
    projObjects['PBXContainerItemProxy'] = projObjects['PBXTargetDependency'] || {};

    // add the NSE target
    const parentBundleId = config.ios?.bundleIdentifier;
    if (!parentBundleId) {
      throw new Error('⚠️ Parent app bundle identifier is required');
    }
    const nseBundleId = `${parentBundleId}.${NSE_TARGET_NAME}`;
    const nseTarget = xcodeProject.addTarget(
      NSE_TARGET_NAME,
      "app_extension", 
      NSE_TARGET_NAME, 
      nseBundleId
    );

    xcodeProject.addBuildPhase(
      ["KlaviyoNotificationService.swift"],
      "PBXSourcesBuildPhase",
      "Sources",
      nseTarget.uuid
    );
    xcodeProject.addBuildPhase(
      [], 
      "PBXResourcesBuildPhase", 
      "Resources", 
      nseTarget.uuid
    );

    xcodeProject.addBuildPhase(
      [],
      "PBXFrameworksBuildPhase",
      "Frameworks",
      nseTarget.uuid
    );
    
    const configurations = xcodeProject.pbxXCBuildConfigurationSection();
    for (const key in configurations) {
      if (typeof configurations[key].buildSettings !== "undefined") {
        const buildSettingsObj = configurations[key].buildSettings;
        buildSettingsObj.CODE_SIGN_STYLE = props.codeSigningStyle;
        buildSettingsObj.CURRENT_PROJECT_VERSION = props.projectVersion;
        buildSettingsObj.MARKETING_VERSION = props.marketingVersion;
        buildSettingsObj.SWIFT_VERSION = props.swiftVersion;
        if (props.devTeam != undefined) {
          buildSettingsObj.DEVELOPMENT_TEAM = props.devTeam;
          xcodeProject.addTargetAttribute("DevelopmentTeam", props.devTeam, nseTarget);
          xcodeProject.addTargetAttribute("DevelopmentTeam", props.devTeam);
        }
        
        if (configurations[key].buildSettings.PRODUCT_NAME == `"${NSE_TARGET_NAME}"`) {
          buildSettingsObj.CODE_SIGN_ENTITLEMENTS = `${NSE_TARGET_NAME}/${NSE_TARGET_NAME}.entitlements`;
        }
      }
    }

    return config;
  });
};

/**
 * Adds the Klaviyo files to the NotificationServiceExtension target.
 */
const withKlaviyoNSE: ConfigPlugin<KlaviyoPluginIosProps> = (config) => {
  return withDangerousMod(config, [
    'ios',
    async config => {
      const iosRoot = path.join(config.modRequest.projectRoot, "ios");
      const nsePath = path.join(iosRoot, NSE_TARGET_NAME);
      
      if (!FileManager.dirExists(nsePath)) {
        fs.mkdirSync(nsePath, { recursive: true });
      }
      
      // Copy static files
      const sourceDir = path.join(config.modRequest.projectRoot, "/node_modules/klaviyo-expo-plugin/", NSE_TARGET_NAME);
      for (const file of NSE_EXT_FILES) {
        try {
          await FileManager.copyFile(
            path.join(sourceDir, file),
            path.join(nsePath, file)
          );
        } catch (error) {
          KlaviyoLog.error(`Failed to copy ${file}: ${error}`);
          throw error;
        }
      }

      // Generate entitlements file dynamically
      const appGroupName = getAppGroupName(config);
      const entitlementsContent = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>com.apple.security.application-groups</key>
    <array>
        <string>${appGroupName}</string>
    </array>
</dict>
</plist>`;

      try {
        await FileManager.writeFile(
          path.join(nsePath, `${NSE_TARGET_NAME}.entitlements`),
          entitlementsContent
        );
        KlaviyoLog.log(`Generated entitlements file with app group: ${appGroupName}`);
      } catch (error) {
        KlaviyoLog.error(`Failed to generate entitlements file: ${error}`);
        throw error;
      }

      // Generate Info.plist file dynamically
      const bundleId = config.ios?.bundleIdentifier;
      const nseBundleId = `${bundleId}.${NSE_TARGET_NAME}`;
      const infoPlistContent = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>NSExtension</key>
    <dict>
        <key>NSExtensionPointIdentifier</key>
        <string>com.apple.usernotifications.service</string>
        <key>NSExtensionPrincipalClass</key>
        <string>$(PRODUCT_MODULE_NAME).KlaviyoNotificationService</string>
    </dict>
    <key>klaviyo_app_group</key>
    <string>${appGroupName}</string>
    <key>CFBundleIdentifier</key>
    <string>${nseBundleId}</string>
    <key>CFBundleVersion</key>
    <string>1</string>
    <key>CFBundleShortVersionString</key>
    <string>1.0</string>
    <key>CFBundlePackageType</key>
    <string>XPC!</string>
    <key>CFBundleName</key>
    <string>$(PRODUCT_NAME)</string>
    <key>CFBundleInfoDictionaryVersion</key>
    <string>1.0</string>
    <key>CFBundleDevelopmentRegion</key>
    <string>$(DEVELOPMENT_LANGUAGE)</string>
    <key>CFBundleExecutable</key>
    <string>$(EXECUTABLE_NAME)</string>
</dict>
</plist>`;

      try {
        await FileManager.writeFile(
          path.join(nsePath, `${NSE_TARGET_NAME}-Info.plist`),
          infoPlistContent
        );
        KlaviyoLog.log(`Generated Info.plist file with bundle ID: ${nseBundleId}`);
      } catch (error) {
        KlaviyoLog.error(`Failed to generate Info.plist file: ${error}`);
        throw error;
      }

      return config;
    },
  ]);
};


