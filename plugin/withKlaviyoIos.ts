import { ConfigPlugin, withDangerousMod, withEntitlementsPlist, withInfoPlist, withXcodeProject } from '@expo/config-plugins';
import { KlaviyoPluginIosConfig } from './types';
import * as path from 'path';
import * as fs from 'fs';
import { FileManager } from './support/fileManager';

const withKlaviyoIos: ConfigPlugin<KlaviyoPluginIosConfig> = (config, props) => {
  config = withRemoteNotificationsPermissions(config, props);
  config = withKlaviyoPodfile(config, props);
  config = withKlaviyoXcodeProject(config, props);
  config = withKlaviyoNSE(config, props);
  config = withKlaviyoAppGroup(config, props);
  return config;
};
export default withKlaviyoIos;

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