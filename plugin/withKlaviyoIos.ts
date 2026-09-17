import { ConfigPlugin, IOSConfig, withPlugins, withDangerousMod, withEntitlementsPlist, withInfoPlist, withXcodeProject } from '@expo/config-plugins';
import { KlaviyoPluginIosProps } from './types';
import * as path from 'path';
import * as fs from 'fs';
import { FileManager } from './support/fileManager';
import { KlaviyoLog } from './support/logger';
import { getPluginRoot } from './support/pluginResolver';

/**
 * Version helpers come straight from @expo/config-plugins rather than being reimplemented here.
 * The notification service extension must report the same CFBundleShortVersionString as the host
 * app — App Store validation rejects a mismatch — and the host app's value is written by Expo's
 * own withVersion/withBuildNumber using exactly these functions.
 */
const getMarketingVersion = IOSConfig.Version.getVersion;
const getBuildNumber = IOSConfig.Version.getBuildNumber;

const withKlaviyoIos: ConfigPlugin<KlaviyoPluginIosProps> = (config, props) => {
  KlaviyoLog.log('Starting iOS plugin configuration...');
  KlaviyoLog.log('Plugin props:' + JSON.stringify(props));

  const plugins: Array<ConfigPlugin<any>> = [
    withKlaviyoPluginConfigurationPlist,
    withRemoteNotificationsPermissions,
    withGeofencingBackgroundMode,
    withKlaviyoPodfileEnvVars,
  ];

  if (props.includeNotificationServiceExtension) {
    plugins.push(withKlaviyoPodfile);
    plugins.push(withKlaviyoXcodeProject);
    plugins.push(withKlaviyoNSE);
    plugins.push(withKlaviyoAppGroup);
  }

  return withPlugins(config, plugins.map(plugin => [plugin, props]));
};

export default withKlaviyoIos;

/**
 * Adds klaviyo-plugin-configuration.plist to the iOS project and includes it in the app bundle.
 */
/** The slice of `xcode`'s pbxProject this file reads. The package ships no types. */
interface PbxProjectLike {
  pbxFileReferenceSection(): Record<string, { path?: string } | undefined>;
}

/**
 * Warns about a stale absolute reference to the config plist left by plugin 1.0.0.
 *
 * Detection only - nothing is removed. A false positive here costs a log line, whereas
 * deleting a reference we misidentified would remove a file registration the consumer owns.
 *
 * Returns the stale paths found.
 */
function findLegacyPlistReferences(
  xcodeProject: PbxProjectLike,
  relativePlistPath: string
): string[] {
  const unquote = (value: unknown) => String(value ?? '').replace(/^"|"$/g, '');
  const normalise = (value: string) => value.replace(/\\/g, '/');
  const legacySuffix = normalise(relativePlistPath);

  const fileRefs = xcodeProject.pbxFileReferenceSection();
  return Object.keys(fileRefs)
    .filter(key => !key.endsWith('_comment'))
    .map(key => unquote(fileRefs[key]?.path))
    .filter(stored => {
      // 1.0.0 always wrote an absolute path ending in <projectName>/<basename>. Requiring
      // both means a consumer's own file elsewhere is never mistaken for ours.
      const isAbsolute = path.isAbsolute(stored) || path.win32.isAbsolute(stored);
      return isAbsolute && normalise(stored).endsWith(legacySuffix);
    });
}

const withKlaviyoPluginConfigurationPlist: ConfigPlugin = config => {
  return withXcodeProject(config, async (config) => {
    const xcodeProject = config.modResults;
    const projectName = config.modRequest.projectName || config.name;
    if (!projectName) {
      throw new Error('Could not determine project name for iOS build');
    }

    // Get the plugin's root directory using a more generic approach
    const pluginRoot = getPluginRoot();
    const srcPlistPath = path.join(pluginRoot, 'ios', 'klaviyo-plugin-configuration.plist');
    // Xcode needs a path relative to platformProjectRoot; fs needs the absolute one.
    const relativePlistPath = path.join(projectName, 'klaviyo-plugin-configuration.plist');
    const destPlistPath = path.join(config.modRequest.platformProjectRoot, relativePlistPath);

    if (fs.existsSync(srcPlistPath)) {
      // Copy the file
      fs.copyFileSync(srcPlistPath, destPlistPath);
      KlaviyoLog.log(`Copied klaviyo-plugin-configuration.plist to ${destPlistPath}`);

      const mainGroupId = xcodeProject.findPBXGroupKey({ name: projectName });
      if (!mainGroupId) {
        KlaviyoLog.warn(
          `Could not find the Xcode group for ${projectName}. klaviyo-plugin-configuration.plist ` +
            'was not added to the app bundle, so the Klaviyo SDK cannot report the plugin version.'
        );
        return config;
      }

      // Checked before the hasFile guard, which returns early on an already-registered
      // plist and would otherwise skip this on exactly the projects that have a stale one.
      for (const stale of findLegacyPlistReferences(xcodeProject, relativePlistPath)) {
        KlaviyoLog.warn(
          `The Xcode project still references klaviyo-plugin-configuration.plist at an ` +
            `absolute path from an older plugin version: ${stale}. It is not in a build phase ` +
            'and is harmless, but remove it in Xcode, or run `expo prebuild --clean` once, to ' +
            'clear it.'
        );
      }

      // addFile returns null when the path is already registered, which is the normal
      // case on a non-clean prebuild. Treat that as a no-op rather than a failure —
      // warning there would fire on every incremental rebuild.
      if (xcodeProject.hasFile(relativePlistPath)) {
        KlaviyoLog.log('klaviyo-plugin-configuration.plist is already in the Xcode project');
        return config;
      }

      // getFirstTarget() throws on a target-less project, and returns a truthy object
      // whose `firstTarget` is undefined when targets[0] is not a PBXNativeTarget. Both
      // cases must degrade to "plist not added" rather than abort the prebuild.
      let firstTargetUuid: string | undefined;
      try {
        const first = xcodeProject.getFirstTarget();
        firstTargetUuid = first?.firstTarget ? first.uuid : undefined;
      } catch {
        firstTargetUuid = undefined;
      }

      if (!firstTargetUuid) {
        KlaviyoLog.warn(
          'Could not find a native target in the Xcode project. klaviyo-plugin-configuration.plist ' +
            'was not added to the app bundle, so the Klaviyo SDK cannot report the plugin version.'
        );
        return config;
      }

      const fileRef = xcodeProject.addFile(relativePlistPath, mainGroupId, {
        target: firstTargetUuid,
      });

      if (!fileRef) {
        KlaviyoLog.warn(
          'Could not add klaviyo-plugin-configuration.plist to the Xcode project. ' +
            'The Klaviyo SDK will not be able to report the Expo plugin version.'
        );
        return config;
      }

      // xcode's pbxFile constructor ignores addFile's `opt`, so both must be set here.
      // Without uuid, addToPbxBuildFileSection keys the entry as the string "undefined".
      // Without target, addToPbxResourcesBuildPhase appends to whichever Resources phase
      // the object hash yields first - this project has two, the app's and the NSE's.
      fileRef.uuid = xcodeProject.generateUuid();
      fileRef.target = firstTargetUuid;

      // addFile does not add to a build phase. addResourceFile cannot be used: it calls
      // correctForResourcesPath, which needs a 'Resources' group Expo projects lack.
      xcodeProject.addToPbxBuildFileSection(fileRef);
      xcodeProject.addToPbxResourcesBuildPhase(fileRef);
      KlaviyoLog.log('Added klaviyo-plugin-configuration.plist to Copy Bundle Resources');
    } else {
      KlaviyoLog.log(`Source plist not found at ${srcPlistPath}`);
    }

    return config;
  });
};

const NSE_POD_DECLARATION = "pod 'KlaviyoSwiftExtension'";

const NSE_TARGET_NAME = "KlaviyoNotificationServiceExtension";
const NSE_EXT_FILES = [
  "KlaviyoNotificationService.swift",
  `${NSE_TARGET_NAME}.entitlements`,
  `${NSE_TARGET_NAME}-Info.plist`
];

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
    const bundleIdentifier = config.ios?.bundleIdentifier;
    if (!bundleIdentifier) {
      throw new Error('iOS bundle identifier is required but not found in app configuration');
    }
    const actualAppGroupName = `group.${bundleIdentifier}.${NSE_TARGET_NAME}.shared`;
    infoPlist.klaviyo_app_group = actualAppGroupName;
    infoPlist.klaviyo_badge_autoclearing = props.badgeAutoclearing;
    // Deliberately NOT writing CFBundleShortVersionString / CFBundleVersion here. This mod runs
    // against the host app's Info.plist, and Expo's own withVersion/withBuildNumber already set
    // both keys with fuller precedence (config.ios.version first). Writing them here overwrote
    // the app author's `ios.version` with the top-level `version` on every prebuild.

    // Manage klaviyo_automatic_push_token_forwarding flag (opt-in; native iOS defaults to OFF).
    // Write only when true; remove the key when omitted so the native default applies.
    if (props.automaticPushTokenForwarding) {
      KlaviyoLog.log('Injecting klaviyo_automatic_push_token_forwarding=true into Info.plist (opt-in)');
      infoPlist.klaviyo_automatic_push_token_forwarding = true;
    } else {
      delete infoPlist.klaviyo_automatic_push_token_forwarding;
    }

    // No klaviyo_automatic_push_open_tracking prop on iOS: KlaviyoAppDelegate already tracks opens,
    // and the native SDK's proxy resolves willPresent before expo-notifications answers from JS,
    // which would override the app's setNotificationHandler options.

    return config;
  });
};

/**
 * Adds location to UIBackgroundModes if geofencing is enabled.
 * The Swift source uses #if canImport(KlaviyoLocation) guards; no file mutation needed here.
 */
const withGeofencingBackgroundMode: ConfigPlugin<KlaviyoPluginIosProps> = (config, props) => {
  const geofencingEnabled = props.geofencingEnabled ?? false;

  if (!geofencingEnabled) {
    KlaviyoLog.log('Geofencing not enabled, skipping background mode configuration');
    return config;
  }

  return withInfoPlist(config, (config) => {
    const infoPlist = config.modResults;

    const existingFromModResults = infoPlist.UIBackgroundModes || [];
    const existingFromConfig = config.ios?.infoPlist?.UIBackgroundModes || [];
    const existingBackgroundModes = Array.isArray(existingFromModResults)
      ? existingFromModResults
      : Array.isArray(existingFromConfig)
        ? existingFromConfig
        : [];

    const updatedBackgroundModes = [...existingBackgroundModes];

    if (!updatedBackgroundModes.includes('location')) {
      updatedBackgroundModes.push('location');
      KlaviyoLog.log('Added location to UIBackgroundModes');
    }

    infoPlist.UIBackgroundModes = updatedBackgroundModes;
    KlaviyoLog.log(`Final UIBackgroundModes: ${JSON.stringify(updatedBackgroundModes)}`);

    return config;
  });
};

/**
 * Writes explicit ENV vars to the top of the Podfile so the podspec and the RN SDK
 * can conditionally include KlaviyoLocation and KlaviyoForms.
 *
 * - KLAVIYO_INCLUDE_LOCATION: 'true' when geofencingEnabled (default false, opt-in)
 * - KLAVIYO_INCLUDE_FORMS:    'true' when formsEnabled    (default true, opt-out)
 */
const withKlaviyoPodfileEnvVars: ConfigPlugin<KlaviyoPluginIosProps> = (config, props) => {
  return withDangerousMod(config, [
    'ios',
    async config => {
      const iosRoot = path.join(config.modRequest.projectRoot, 'ios');
      const podfilePath = path.join(iosRoot, 'Podfile');

      try {
        let podfileContent = await FileManager.readFile(podfilePath);

        // Remove any existing Klaviyo env vars (idempotent)
        podfileContent = podfileContent.replace(/ENV\['KLAVIYO_INCLUDE_(?:LOCATION|FORMS)'\]\s*=\s*'[^']*'\n?/g, '');

        const locationVal = (props.geofencingEnabled ?? false) ? 'true' : 'false';
        const formsVal = (props.formsEnabled ?? true) ? 'true' : 'false';

        const envVars = [
          `ENV['KLAVIYO_INCLUDE_LOCATION'] = '${locationVal}'`,
          `ENV['KLAVIYO_INCLUDE_FORMS'] = '${formsVal}'`,
        ];

        podfileContent = envVars.join('\n') + '\n' + podfileContent;
        KlaviyoLog.log(`Set Podfile ENV vars: KLAVIYO_INCLUDE_LOCATION=${locationVal}, KLAVIYO_INCLUDE_FORMS=${formsVal}`);

        await FileManager.writeFile(podfilePath, podfileContent);
      } catch (err) {
        KlaviyoLog.log('Could not write Klaviyo ENV vars to Podfile: ' + err);
      }

      return config;
    },
  ]);
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
    ${NSE_POD_DECLARATION}
  end
  `;
        // Scoped to the NSE block: a file-wide search lets an unrelated target's pod
        // suppress our warning. Both patterns anchor to their keyword at a line start,
        // so commented-out lines already fail to match.
        const nseBlock = podfile.match(
          new RegExp(`^([ \\t]*)target\\s+'${NSE_TARGET_NAME}'\\s+do\\b([\\s\\S]*?)^\\1end`, 'm')
        );

        if (!nseBlock) {
          await FileManager.writeFile(`${iosRoot}/Podfile`, `${podfile}\n${podInsertion}`);
        } else if (!/^[ \t]*pod\s+'KlaviyoSwiftExtension'/m.test(nseBlock[2])) {
          KlaviyoLog.warn(
            `The ${NSE_TARGET_NAME} target exists in the Podfile but declares no ` +
              `KlaviyoSwiftExtension pod. Add ${NSE_POD_DECLARATION} to it, or remove the ` +
              'target and re-run prebuild, so rich push notifications work.'
          );
        }
        // Declared already: left as written, including any version the consumer pinned.
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
    if (xcodeProject.pbxGroupByName(NSE_TARGET_NAME)) {
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
    const marketingVersion = getMarketingVersion(config);
    const buildNumber = getBuildNumber(config);
    for (const key in configurations) {
      if (typeof configurations[key].buildSettings !== "undefined") {
        const buildSettingsObj = configurations[key].buildSettings;
        buildSettingsObj.CODE_SIGN_STYLE = props.codeSigningStyle;
        buildSettingsObj.CURRENT_PROJECT_VERSION = buildNumber;
        buildSettingsObj.MARKETING_VERSION = marketingVersion;
        if (props.devTeam != undefined) {
          buildSettingsObj.DEVELOPMENT_TEAM = props.devTeam;
        }
        if (configurations[key].buildSettings.PRODUCT_NAME == `"${NSE_TARGET_NAME}"`) {
          buildSettingsObj.SWIFT_VERSION = "5.0";
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
const withKlaviyoNSE: ConfigPlugin<KlaviyoPluginIosProps> = (config, props) => {
  return withDangerousMod(config, [
    'ios',
    async config => {
      const iosRoot = path.join(config.modRequest.projectRoot, "ios");
      const nsePath = path.join(iosRoot, NSE_TARGET_NAME);
      
      if (!FileManager.dirExists(nsePath)) {
        fs.mkdirSync(nsePath, { recursive: true });
      }
      // Get the plugin's root directory using a more generic approach
      const pluginRoot = getPluginRoot();
      const sourceDir = path.join(pluginRoot, NSE_TARGET_NAME);
      for (const file of NSE_EXT_FILES) {
        try {
          await FileManager.copyFile(
            path.join(sourceDir, file),
            path.join(nsePath, file)
          );
          
          // If this is the entitlements file, replace the bundle identifier placeholder
          if (file === `${NSE_TARGET_NAME}.entitlements`) {
            const bundleIdentifier = config.ios?.bundleIdentifier;
            if (!bundleIdentifier) {
              throw new Error('iOS bundle identifier is required but not found in app configuration');
            }
            
            const entitlementsPath = path.join(nsePath, file);
            let entitlementsContent = await FileManager.readFile(entitlementsPath);
            
            // Replace the placeholder with the actual bundle identifier
            entitlementsContent = entitlementsContent.replace(
              /{{BUNDLE_IDENTIFIER}}/g,
              bundleIdentifier
            );
            
            await FileManager.writeFile(entitlementsPath, entitlementsContent);
            KlaviyoLog.log(`Updated entitlements file with bundle identifier: ${bundleIdentifier}`);
          }
          
          if (file === `${NSE_TARGET_NAME}-Info.plist`) {
            const marketingVersion = getMarketingVersion(config);
            const buildNumber = getBuildNumber(config);
            const infoPlistPath = path.join(nsePath, file);
            let infoPlistContent = await FileManager.readFile(infoPlistPath);
            infoPlistContent = infoPlistContent.replace(
              /(<key>CFBundleShortVersionString<\/key>\s*<string>)[^<]*(<\/string>)/,
              `$1${marketingVersion}$2`
            );
            infoPlistContent = infoPlistContent.replace(
              /(<key>CFBundleVersion<\/key>\s*<string>)[^<]*(<\/string>)/,
              `$1${buildNumber}$2`
            );
            
            await FileManager.writeFile(infoPlistPath, infoPlistContent);
            KlaviyoLog.log(`Updated Info.plist with version ${marketingVersion} (build ${buildNumber})`);
          }
        } catch (error) {
          KlaviyoLog.error(`Failed to copy ${file}: ${error}`);
          throw error;
        }
      }

      return config;
    },
  ]);
};

/**
 * Adds the app group to target entitlements.
 */
const withKlaviyoAppGroup: ConfigPlugin<KlaviyoPluginIosProps> = (config, props) => {
  return withEntitlementsPlist(config, (config) => {
    const appGroupsKey = 'com.apple.security.application-groups';
    const bundleIdentifier = config.ios?.bundleIdentifier;
    if (!bundleIdentifier) {
      throw new Error('iOS bundle identifier is required but not found in app configuration');
    }
    const actualAppGroupName = `group.${bundleIdentifier}.${NSE_TARGET_NAME}.shared`;
    const existingAppGroups = config.modResults[appGroupsKey];
    if (Array.isArray(existingAppGroups) && !existingAppGroups.includes(actualAppGroupName)) {
      config.modResults[appGroupsKey] = existingAppGroups.concat([actualAppGroupName]);
    } else {
      config.modResults[appGroupsKey] = [actualAppGroupName];
    }
    return config;
  });
};
