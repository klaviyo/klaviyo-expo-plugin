import { ConfigPlugin, withDangerousMod, withInfoPlist, withXcodeProject } from '@expo/config-plugins';
import { KlaviyoPluginIosConfig, KlaviyoPluginProps } from './types';
import * as path from 'path';
import * as fs from 'fs';

const withKlaviyoPodfile: ConfigPlugin<KlaviyoPluginProps> = (config) => {
  return withDangerousMod(config, [
    'ios',
    async config => {
      const iosRoot = path.join(config.modRequest.projectRoot, "ios")
      updatePodfile(iosRoot).catch(err => { console.log(err) });
      return config;
    },
  ]);
}

const withRemoteNotificationsPermissions: ConfigPlugin<KlaviyoPluginProps> = (
  config
) => {
  return withInfoPlist(config, (config) => {
    const infoPlist = config.modResults;
    return config;
  });
};

export const NSE_TARGET_NAME = "NotificationServiceExtension";
export const NSE_EXT_FILES = [
  "NotificationService.swift",
  // `${NSE_TARGET_NAME}.entitlements`,
  `${NSE_TARGET_NAME}-Info.plist`
];

const withKlaviyoXcodeProject: ConfigPlugin<KlaviyoPluginProps> = (config, props) => {
  return withXcodeProject(config, async (config) => {
    const xcodeProject = config.modResults;

    // Skip if NSE already exists
    if (!!xcodeProject.pbxGroupByName(NSE_TARGET_NAME)) {
      console.log(NSE_TARGET_NAME + " already exists in project. Skipping...");
      return config;
    }

    // Get the main app target
    const mainTarget = xcodeProject.getFirstTarget();
    if (!mainTarget) {
      throw new Error('Could not find main app target');
    }

    // Create the NSE group
    const extGroup = xcodeProject.addPbxGroup(
      ["NotificationService.swift", "NotificationServiceExtension-Info.plist"], 
      NSE_TARGET_NAME, 
      NSE_TARGET_NAME
    );

    // Add the group to the main group
    const groups = xcodeProject.hash.project.objects["PBXGroup"];
    Object.keys(groups).forEach(function(key) {
      if (typeof groups[key] === "object" && groups[key].name === undefined && groups[key].path === undefined) {
        xcodeProject.addToPbxGroup(extGroup.uuid, key);
      }
    });
    // WORK AROUND for codeProject.addTarget BUG
    const projObjects = config.modResults.hash.project.objects;
    projObjects['PBXTargetDependency'] = projObjects['PBXTargetDependency'] || {};
    projObjects['PBXContainerItemProxy'] = projObjects['PBXTargetDependency'] || {};

    // Add the NSE target
    const parentBundleId = config.ios?.bundleIdentifier || props.ios?.bundleIdentifier;
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

    // Add build phases
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
    
     // Edit the Deployment info of the new Target, only IphoneOS and Targeted Device Family
    // However, can be more
    const configurations = xcodeProject.pbxXCBuildConfigurationSection();
    for (const key in configurations) {
      if (typeof configurations[key].buildSettings !== "undefined") {
        const buildSettingsObj = configurations[key].buildSettings;
        
        // Set versions for all targets
        buildSettingsObj.CURRENT_PROJECT_VERSION = "1";
        buildSettingsObj.MARKETING_VERSION = "1.0";
        
        // Additional settings for the extension target
        if (configurations[key].buildSettings.PRODUCT_NAME == `"${NSE_TARGET_NAME}"`) {
          // buildSettingsObj.CODE_SIGN_ENTITLEMENTS = `${NSE_TARGET_NAME}/${NSE_TARGET_NAME}.entitlements`;
          buildSettingsObj.SWIFT_VERSION = "5.0";
          buildSettingsObj.CODE_SIGN_STYLE = "Automatic";
        }
      }
    }

    return config;
  });
};

const withKlaviyoNSE: ConfigPlugin<KlaviyoPluginProps> = (config) => {
  return withDangerousMod(config, [
    'ios',
    async config => {
      const iosRoot = path.join(config.modRequest.projectRoot, "ios");
      const nsePath = path.join(iosRoot, NSE_TARGET_NAME);
      
      // Create NSE directory if it doesn't exist
      if (!FileManager.dirExists(nsePath)) {
        fs.mkdirSync(nsePath, { recursive: true });
      }

      // Copy NSE files from the plugin root directory
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

const withProperNSE: ConfigPlugin<KlaviyoPluginProps> = (config) => {
  return withDangerousMod(config, [
    'ios',
    async config => {
      const iosRoot = path.join(config.modRequest.projectRoot, "ios");
      const nsePath = path.join(iosRoot, NSE_TARGET_NAME);

      // Ensure NSE folder exists
      if (!FileManager.dirExists(nsePath)) {
        fs.mkdirSync(nsePath, { recursive: true });
      }

      const sourceDir = path.join(config.modRequest.projectRoot, "..", NSE_TARGET_NAME);

      const srcFile = path.join(sourceDir, "NotificationService.swift");
      const destFile = path.join(nsePath, "NotificationService copy.swift"); // overwrite the 'copy' version

      try {
        await FileManager.copyFile(srcFile, destFile);
        console.log(`Replaced NotificationService copy.swift with NotificationService.swift`);
      } catch (error) {
        console.error(`Failed to replace NotificationService.swift:`, error);
        throw error;
      }

      return config;
    },
  ]);
};


const withKlaviyoIos: ConfigPlugin<KlaviyoPluginProps> = (config, props) => {
  config = withRemoteNotificationsPermissions(config, props);
  config = withKlaviyoPodfile(config, props);
  config = withKlaviyoXcodeProject(config, props);
  config = withKlaviyoNSE(config, props);
  return config;
};

const podInsertion = 
`
target 'NotificationServiceExtension' do
   pod 'KlaviyoSwiftExtension'
end
`;

export async function updatePodfile(iosPath: string) {
  const podfile = await FileManager.readFile(`${iosPath}/Podfile`);

  // Check if the extension pod is already added
  if (podfile.includes("pod 'KlaviyoSwiftExtension'")) {
    return;
  }

  // Add the extension target configuration at the end of the Podfile
  const updatedPodfile = `${podfile}\n${podInsertion}`;

  await FileManager.writeFile(`${iosPath}/Podfile`, updatedPodfile);
}

export default withKlaviyoIos;

class FileManager {
  static async readFile(path: string): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      fs.readFile(path, 'utf8', (err, data) => {
        if (err || !data) {
          console.log("Couldn't read file:" + path);
          reject(err);
          return;
        }
        resolve(data);
      });
    });
  }

  static async writeFile(path: string, contents: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      fs.writeFile(path, contents, 'utf8', (err) => {
        if (err) {
          console.log("Couldn't write file:" + path);
          reject(err);
          return;
        }
        resolve();
      });
    });
  }

  static async copyFile(path1: string, path2: string): Promise<void> {
    const fileContents = await FileManager.readFile(path1);
    await FileManager.writeFile(path2, fileContents);
  }

  static dirExists(path: string): boolean {
    return fs.existsSync(path)
  }
}