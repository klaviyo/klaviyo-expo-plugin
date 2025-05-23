import { ConfigPlugin, withDangerousMod, withEntitlementsPlist, withInfoPlist, withXcodeProject } from '@expo/config-plugins';
import { KlaviyoPluginIosConfig } from './types';
import * as path from 'path';
import * as fs from 'fs';
import { FileManager } from './support/fileManager';

const withKlaviyoIos: ConfigPlugin<KlaviyoPluginIosConfig> = (config, props) => {
  config = withKlaviyoPluginConfigurationPlist(config);
  config = withRemoteNotificationsPermissions(config, props);
  config = withKlaviyoPodfile(config, props);
  config = withKlaviyoXcodeProject(config, props);
  config = withKlaviyoNSE(config, props);
  config = withKlaviyoAppGroup(config, props);
  return config;
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
      console.log(`✅ Copied klaviyo-plugin-configuration.plist to ${destPlistPath}`);

      // Get the main group
      const mainGroup = xcodeProject.getFirstProject().firstProject.mainGroup;
      const mainGroupId = xcodeProject.findPBXGroupKey({ name: projectName });
      
      if (!mainGroupId) {
        console.warn(`⚠️ Could not find main group for project ${projectName}, skipping Xcode project modification`);
        return config;
      }

      // Add the file to the Xcode project
      const fileRef = xcodeProject.addFile(
        destPlistPath,
        mainGroupId,
        { target: xcodeProject.getFirstTarget().uuid }
      );

      if (!fileRef) {
        console.warn('⚠️ Failed to add file to Xcode project');
        return config;
      }

      // Add the file to the "Copy Bundle Resources" build phase
      const target = xcodeProject.getFirstTarget();
      if (!target) {
        console.warn('⚠️ Could not find target, skipping build phase modification');
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
        console.log('✅ Created Copy Bundle Resources build phase');
      }

      if (buildPhase) {
        // Add the file as a resource
        xcodeProject.addResourceFile(destPlistPath, { target: target.uuid });
        console.log('✅ Added klaviyo-plugin-configuration.plist to Xcode project');

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
          console.log('✅ Added klaviyo-plugin-configuration.plist to Copy Bundle Resources build phase');
        }
      } else {
        console.warn('⚠️ Failed to create or find Copy Bundle Resources build phase');
      }
    } else {
      console.warn(`⚠️ Source plist not found at ${srcPlistPath}`);
    }

    return config;
  });
};

const NSE_TARGET_NAME = "NotificationServiceExtension";
const NSE_EXT_FILES = [
  "NotificationService.swift",
  `${NSE_TARGET_NAME}.entitlements`,
  `${NSE_TARGET_NAME}-Info.plist`
];
const appGroupName = `group.$(PRODUCT_BUNDLE_IDENTIFIER).${NSE_TARGET_NAME}.shared`;

// plugin to enable remote notifications
const withRemoteNotificationsPermissions: ConfigPlugin<KlaviyoPluginIosConfig> = (
  config,
  props
) => {
  return withInfoPlist(config, (config) => {
    const infoPlist = config.modResults;
    infoPlist.klaviyo_app_group = appGroupName;
    infoPlist.klaviyo_badge_autoclearing = props.badgeAutoclearing ?? true;
    return config;
  });
};

// plugin to add the necessary Klaviyo pods to the Podfile setup
const withKlaviyoPodfile: ConfigPlugin<KlaviyoPluginIosConfig> = (config) => {
  return withDangerousMod(config, [
    'ios',
    async config => {
      const iosRoot = path.join(config.modRequest.projectRoot, "ios");
      const podInsertion = `
  target 'NotificationServiceExtension' do
    pod 'KlaviyoSwiftExtension'
  end
  `;
      try {
        const podfile = await FileManager.readFile(`${iosRoot}/Podfile`);
        if (!podfile.includes("pod 'KlaviyoSwiftExtension'")) {
          const updatedPodfile = `${podfile}\n${podInsertion}`;
          await FileManager.writeFile(`${iosRoot}/Podfile`, updatedPodfile);
        }
      } catch (err) {
        console.log(err);
      }
      
      return config;
    },
  ]);
}

// plugin to add the Notification Service Extension target
const withKlaviyoXcodeProject: ConfigPlugin<KlaviyoPluginIosConfig> = (config, props) => {
  return withXcodeProject(config, async (config) => {
    const xcodeProject = config.modResults;
    if (!!xcodeProject.pbxGroupByName(NSE_TARGET_NAME)) {
      console.log(NSE_TARGET_NAME + " already exists in project. Skipping...");
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
    const parentBundleId = config.ios?.bundleIdentifier || props.bundleIdentifier;
    if (!parentBundleId) {
      throw new Error('Parent app bundle identifier is required');
    }
    const nseBundleId = `${parentBundleId}.${NSE_TARGET_NAME}`;
    const nseTarget = xcodeProject.addTarget(
      NSE_TARGET_NAME,
      "app_extension", 
      NSE_TARGET_NAME, 
      nseBundleId
    );

    xcodeProject.addBuildPhase(
      ["NotificationService.swift"],
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
        buildSettingsObj.CODE_SIGN_STYLE = "Automatic";
        buildSettingsObj.CURRENT_PROJECT_VERSION = "1";
        buildSettingsObj.MARKETING_VERSION = "1.0";
        buildSettingsObj.SWIFT_VERSION = "5.0";
        
        if (configurations[key].buildSettings.PRODUCT_NAME == `"${NSE_TARGET_NAME}"`) {
          buildSettingsObj.CODE_SIGN_ENTITLEMENTS = `${NSE_TARGET_NAME}/${NSE_TARGET_NAME}.entitlements`;
        }
      }
    }

    return config;
  });
};

// plugin to setup NotificationServiceExtension with Klaviyo files
const withKlaviyoNSE: ConfigPlugin<KlaviyoPluginIosConfig> = (config) => {
  return withDangerousMod(config, [
    'ios',
    async config => {
      const iosRoot = path.join(config.modRequest.projectRoot, "ios");
      const nsePath = path.join(iosRoot, NSE_TARGET_NAME);
      
      if (!FileManager.dirExists(nsePath)) {
        fs.mkdirSync(nsePath, { recursive: true });
      }
      const sourceDir = path.join(config.modRequest.projectRoot, "..", NSE_TARGET_NAME);
      for (const file of NSE_EXT_FILES) {
        try {
          await FileManager.copyFile(
            path.join(sourceDir, file),
            path.join(nsePath, file)
          );
        } catch (error) {
          console.error(`Failed to copy ${file}:`, error);
          throw error;
        }
      }

      return config;
    },
  ]);
};

// plugin to add app group to target entitlements
const withKlaviyoAppGroup: ConfigPlugin<KlaviyoPluginIosConfig> = (config, props) => {
  return withEntitlementsPlist(config, (config) => {
    const appGroupsKey = 'com.apple.security.application-groups';
      const existingAppGroups = config.modResults[appGroupsKey];
      if (Array.isArray(existingAppGroups) && !existingAppGroups.includes(appGroupName)) {
        config.modResults[appGroupsKey] = existingAppGroups.concat([appGroupName]);
      } else {
        config.modResults[appGroupsKey] = [appGroupName];
      }
    return config;
  });
};
