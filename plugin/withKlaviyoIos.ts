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
    // Two forms, deliberately. fs needs an absolute path to copy to; Xcode must be given
    // a path RELATIVE to platformProjectRoot, because that is what every other entry in a
    // generated pbxproj uses (`path = <project>/Images.xcassets; sourceTree = "<group>"`).
    // Storing an absolute path here bakes one machine's directory into project.pbxproj -
    // harmless while prebuild regenerates ios/ each run, but this release's migration guide
    // recommends --no-clean, and a committed ios/ then breaks every other developer and CI
    // runner with an opaque Xcode "file not found". It also made hasFile() miss across
    // machines, which is what made the build-phase ambiguity reachable in the first place.
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

      // addFile returns null when the path is already registered, which is the normal
      // case on a non-clean prebuild. Treat that as a no-op rather than a failure —
      // warning there would fire on every incremental rebuild.
      if (xcodeProject.hasFile(relativePlistPath)) {
        KlaviyoLog.log('klaviyo-plugin-configuration.plist is already in the Xcode project');
        return config;
      }

      // getFirstTarget() does NOT return undefined on a target-less project - it reads
      // targets[0].value and throws, and otherwise always returns a {uuid, firstTarget}
      // object. So a truthiness check on the result cannot catch the failure it looks
      // like it catches; the throw has to be caught instead. Either way this mod should
      // degrade to "plist not added" and let the build continue, as it does for every
      // other failure here, rather than aborting the whole prebuild.
      let firstTargetUuid: string | undefined;
      try {
        const first = xcodeProject.getFirstTarget();
        // Check firstTarget, not just uuid. getFirstTarget() returns
        // { uuid, firstTarget: pbxNativeTargetSection()[uuid] }, and firstTarget is
        // undefined when targets[0] is not a PBXNativeTarget (an aggregate or legacy
        // target). Passing such a uuid on as fileRef.target makes buildPhase() throw
        // 'Invalid target', which - unlike the undefined case it short-circuits on -
        // would abort the whole prebuild from inside addToPbxResourcesBuildPhase.
        //
        // Defensive only, and UNTESTED: Expo templates never emit an aggregate first
        // target, and the test fixture cannot reach this branch, so removing this check
        // breaks no test. Treat it as belt-and-braces rather than a verified guarantee -
        // covering it needs a fixture whose targets[0] is a PBXAggregateTarget.
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

      // xcode's pbxFile constructor ignores BOTH of these, so addFile's `opt` does not do
      // what its shape suggests - they have to be assigned after the fact. xcode's own
      // addResourceFile assigns both explicitly for exactly this reason.
      //
      // uuid: addToPbxBuildFileSection keys the PBXBuildFile entry on file.uuid. Without
      // this the entry is written under the literal key "undefined" - malformed, and a
      // second file added this way would overwrite it and silently drop this one.
      //
      // target: addToPbxResourcesBuildPhase passes file.target to buildPhaseObject to pick
      // WHICH Resources phase to append to. Undefined means its `buildPhase && ...` skip
      // check never skips, so it appends to whichever Resources phase the object hash
      // happens to yield first. This project has two - the host app's and the NSE's, which
      // this plugin itself creates - so without this the plist can land in the extension's
      // Copy Bundle Resources instead of the app's, defeating the point of the mod, and
      // non-deterministically.
      fileRef.uuid = xcodeProject.generateUuid();
      fileRef.target = firstTargetUuid;

      // addFile creates the PBXFileReference but does not put the file in a build phase.
      // xcode's own addResourceFile cannot be used here: it calls correctForResourcesPath,
      // which dereferences a group named 'Resources' that Expo-generated projects do not have.
      // These two calls are what actually place the plist in Copy Bundle Resources, so that
      // it ships inside the built .app and the SDK can read the plugin version at runtime.
      xcodeProject.addToPbxBuildFileSection(fileRef);
      xcodeProject.addToPbxResourcesBuildPhase(fileRef);
      KlaviyoLog.log('Added klaviyo-plugin-configuration.plist to Copy Bundle Resources');
    } else {
      KlaviyoLog.log(`Source plist not found at ${srcPlistPath}`);
    }

    return config;
  });
};

const NSE_POD_DECLARATION = "pod 'KlaviyoSwiftExtension', '~> 5.0'";

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
        // Match the pod name with an optional version argument, so an existing
        // UNPINNED declaration written by an older plugin version gets upgraded to the
        // pinned one. A plain substring check would match both forms and silently
        // leave upgrading consumers on an unconstrained pod.
        // Anchored to the start of a line (capturing indentation) so a commented-out
        // `# pod 'KlaviyoSwiftExtension'` is not treated as an existing declaration and
        // rewritten in place, which would leave a pinned pod inside a comment.
        const nsePodDeclaration = /^([ \t]*)pod\s+'KlaviyoSwiftExtension'(?:\s*,\s*'[^']*')?/m;
        const existing = podfile.match(nsePodDeclaration);

        // Appending is gated on the TARGET block, not the pod line. Anchoring the pod
        // regex to a line start means a Podfile whose only occurrence is commented out
        // (`# pod 'KlaviyoSwiftExtension'`) produces no match - and appending then adds a
        // SECOND `target 'KlaviyoNotificationServiceExtension' do` block, which makes
        // `pod install` fail outright. Duplicating the target is worse than leaving the
        // pod unpinned, so only append when the target is genuinely absent.
        const hasNseTarget = podfile.includes(`target '${NSE_TARGET_NAME}'`);

        if (!existing && !hasNseTarget) {
          await FileManager.writeFile(`${iosRoot}/Podfile`, `${podfile}\n${podInsertion}`);
        } else if (!existing) {
          KlaviyoLog.warn(
            `The ${NSE_TARGET_NAME} target exists in the Podfile but declares no ` +
              `KlaviyoSwiftExtension pod. Add ${NSE_POD_DECLARATION} to it, or remove the ` +
              'target and re-run prebuild, so rich push notifications work.'
          );
        } else {
          const indent = existing[1];
          // Compare with whitespace collapsed: `pod  'X', '~> 5.0'` is the same declaration
          // as `pod 'X', '~> 5.0'`, and rewriting it every prebuild would only add log noise.
          const collapse = (value: string) => value.replace(/\s+/g, ' ').trim();
          const current = existing[0].slice(indent.length);

          if (collapse(current) !== collapse(NSE_POD_DECLARATION)) {
            KlaviyoLog.log(`Updating Podfile: ${current} -> ${NSE_POD_DECLARATION}`);
            await FileManager.writeFile(
              `${iosRoot}/Podfile`,
              podfile.replace(nsePodDeclaration, `${indent}${NSE_POD_DECLARATION}`)
            );
          }
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
