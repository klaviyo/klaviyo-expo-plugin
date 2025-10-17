import { ConfigPlugin, withDangerousMod, withAndroidManifest, withStringsXml, withPlugins } from '@expo/config-plugins';
import * as fs from 'fs';
import * as path from 'path';
import { mergeContents } from '@expo/config-plugins/build/utils/generateCode';
import { getMainActivityAsync } from '@expo/config-plugins/build/android/Paths';
import * as glob from 'glob';
import {
  KlaviyoPluginAndroidProps,
  KlaviyoAndroidModResults
} from './types';
import * as xml2js from 'xml2js';
import { KlaviyoLog } from './support/logger';
import { ExportedConfigWithProps } from '@expo/config-plugins';
import {
  AndroidManifest,
  ManifestApplication,
  ManifestMetaData
} from '@expo/config-plugins/build/android/Manifest';

const mutateAndroidManifest = (config: ExportedConfigWithProps<AndroidManifest>, props: KlaviyoPluginAndroidProps) => {
  KlaviyoLog.log('Modifying Android Manifest');
  const androidManifest = config.modResults.manifest;
  
  if (!androidManifest.application) {
    KlaviyoLog.log('Creating application tag in manifest');
    androidManifest.application = [{ $: { 'android:name': '.MainApplication' } } as ManifestApplication];
  }

  const application = androidManifest.application[0] as ManifestApplication;
  
  // Add or update the log level meta-data
  if (!application['meta-data']) {
    KlaviyoLog.log('No meta-data array found, creating one...');
    application['meta-data'] = [];
  }

  const logLevel = props.logLevel ?? 1; // Default to DEBUG (1) if not specified
  KlaviyoLog.log(`Setting Klaviyo log level to ${logLevel}`);

  // Remove any existing log level meta-data entries
  application['meta-data'] = (application['meta-data'] || []).filter(
    (item: ManifestMetaData) => !['com.klaviyo.core.log_level', 'com.klaviyo.android.log_level'].includes(item.$['android:name'])
  );

  // Add the correct log level meta-data
  application['meta-data'].push({
    $: {
      'android:name': 'com.klaviyo.core.log_level',
      'android:value': logLevel.toString()
    }
  } as ManifestMetaData);

  // Add KlaviyoPushService to the manifest
  if (!application.service) {
    application.service = [];
  }

  interface ManifestService {
    $: Record<string, string>;
    'intent-filter'?: unknown[];
  }

  const pushServiceIndex = application.service.findIndex(
    (item: ManifestService) => item.$['android:name'] === 'com.klaviyo.pushFcm.KlaviyoPushService'
  );

  if (pushServiceIndex === -1) {
    KlaviyoLog.log('Adding KlaviyoPushService to manifest');
    application.service.push({
      $: {
        'android:name': 'com.klaviyo.pushFcm.KlaviyoPushService',
        'android:exported': 'false'
      },
      'intent-filter': [{
        action: [{
          $: {
            'android:name': 'com.google.firebase.MESSAGING_EVENT'
          }
        }]
      }]
    });
  }

  return config;
};

const withAndroidManifestModifications: ConfigPlugin<KlaviyoPluginAndroidProps> = (config, props) => {
  return withAndroidManifest(config, (config) => mutateAndroidManifest(config, props));
};

const findMainActivity = async (projectRoot: string): Promise<{ path: string; isKotlin: boolean } | null> => {
  KlaviyoLog.log(`Searching for MainActivity in: ${projectRoot}`);
  
  // First try Expo's built-in detection
  try {
    const expoMainActivity = await getMainActivityAsync(projectRoot);
    const mainActivityPath = expoMainActivity?.toString();
    if (mainActivityPath && fs.existsSync(mainActivityPath)) {
      KlaviyoLog.log(`Found MainActivity using Expo detection: ${mainActivityPath}`);
      return {
        path: mainActivityPath,
        isKotlin: mainActivityPath.endsWith('.kt')
      };
    }
  } catch (e: unknown) {
    KlaviyoLog.error('Could not find main activity using Expo detection: ' + (e instanceof Error ? e.message : String(e)));
  }

  // Fall back to searching for ReactActivity
  const possibleJavaDirs = [
    path.join(projectRoot, 'app', 'src', 'main', 'java'),
    path.join(projectRoot, 'src', 'main', 'java'),
    path.join(projectRoot, 'java')
  ];

  for (const javaDir of possibleJavaDirs) {
    KlaviyoLog.log(`Checking directory: ${javaDir}`);
    if (!fs.existsSync(javaDir)) {
      KlaviyoLog.log(`Directory does not exist: ${javaDir}`);
      continue;
    }

    // Search for both .kt and .java files
    const kotlinFiles = glob.sync('**/*.kt', { cwd: javaDir });
    const javaFiles = glob.sync('**/*.java', { cwd: javaDir });
    KlaviyoLog.log(`Found ${kotlinFiles.length} Kotlin files and ${javaFiles.length} Java files in ${javaDir}`);
    
    // Check Kotlin files first
    for (const file of kotlinFiles) {
      const filePath = path.join(javaDir, file);
      const content = fs.readFileSync(filePath, 'utf-8');
      if (content.includes('class') && (content.includes(': ReactActivity') || content.includes('extends ReactActivity'))) {
        KlaviyoLog.log(`Found ReactActivity in Kotlin file: ${filePath}`);
        return { path: filePath, isKotlin: true };
      }
    }

    // Then check Java files
    for (const file of javaFiles) {
      const filePath = path.join(javaDir, file);
      const content = fs.readFileSync(filePath, 'utf-8');
      if (content.includes('class') && content.includes('extends ReactActivity')) {
        KlaviyoLog.log(`Found ReactActivity in Java file: ${filePath}`);
        return { path: filePath, isKotlin: false };
      }
    }
  }

  KlaviyoLog.error('Could not find MainActivity in any of the expected locations');
  return null;
};

export async function modifyMainActivity(
  config: { android?: { package?: string }, modRequest: { platformProjectRoot: string } },
  props: KlaviyoPluginAndroidProps,
  findMainActivityImpl = findMainActivity
) {
  KlaviyoLog.log('Modifying MainActivity');
  KlaviyoLog.log(`OpenTracking setting: ${props.openTracking}`);
  
  if (!config.android?.package) {
    throw new Error('Android package not found in app config');
  }

  const mainActivityInfo = await findMainActivityImpl(config.modRequest.platformProjectRoot);

  if (!mainActivityInfo) {
    throw new Error('Could not find main activity file. Please ensure your app has a valid ReactActivity.');
  }

  const { path: mainActivityPath, isKotlin } = mainActivityInfo;
  KlaviyoLog.log(`MainActivity path: ${mainActivityPath}`);
  KlaviyoLog.log(`MainActivity language: ${isKotlin ? 'Kotlin' : 'Java'}`);

  if (!fs.existsSync(mainActivityPath)) {
    throw new Error(`MainActivity not found at path: ${mainActivityPath}`);
  }

  // Read the current content
  const mainActivityContent = fs.readFileSync(mainActivityPath, 'utf-8');
  KlaviyoLog.log(`Found MainActivity, current size: ${mainActivityContent.length} bytes`);

  // Find the package declaration line to use as our anchor
  const packageMatch = mainActivityContent.match(/^package .+$/m);
  if (!packageMatch) {
    throw new Error('Could not find package declaration in MainActivity');
  }

  // Find the class declaration line to use as our anchor
  const classMatch = mainActivityContent.match(/^(?:public\s+)?class\s+MainActivity\s+(?:extends|:)\s+ReactActivity\s*(?:\(\))?\s*\{/m);
  if (!classMatch) {
    throw new Error('Could not find MainActivity class declaration');
  }

  // Split the content into lines for more precise manipulation
  const lines = mainActivityContent.split('\n');

  // Remove Klaviyo-related imports and generated blocks
  const newLines: string[] = [];
  let skipLines = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Skip Klaviyo-related imports
    if (line.trim().startsWith('import') && 
        (line.includes('android.content.Intent') || 
         line.includes('com.klaviyo.analytics.Klaviyo'))) {
      continue;
    }

    // Handle generated blocks
    if (line.includes('// @generated begin klaviyo-')) {
      skipLines = true;
      continue;
    }
    if (line.includes('// @generated end klaviyo-')) {
      skipLines = false;
      continue;
    }
    if (!skipLines) {
      newLines.push(line);
    }
  }

  // Clean up multiple empty lines
  const cleanedContent = newLines.join('\n').replace(/\n{3,}/g, '\n\n');

  // Only add the code if openTracking is enabled
  if (props.openTracking) {
    KlaviyoLog.log('Adding push tracking code to MainActivity...');
    
    // First, remove any existing generated content
    const contentWithoutGenerated = cleanedContent.replace(
      /\/\/ @generated begin klaviyo-[\s\S]*?\/\/ @generated end klaviyo-/g,
      ''
    ).trim();

    // Add imports right after the package declaration
    const importContents = mergeContents({
      tag: 'klaviyo-imports',
      src: contentWithoutGenerated,
      newSrc: isKotlin ? 
        `import android.content.Intent\nimport com.klaviyo.analytics.Klaviyo` :
        `import android.content.Intent;\nimport com.klaviyo.analytics.Klaviyo;`,
      anchor: /^package .+$/m,
      offset: 1,
      comment: '//',
    });

    // Add the onNewIntent override right after the class declaration
    const methodContents = mergeContents({
      tag: 'klaviyo-onNewIntent',
      src: importContents.contents,
      newSrc: isKotlin ?
        `\n    override fun onNewIntent(intent: Intent) {\n        super.onNewIntent(intent)\n\n        // Tracks when a system tray notification is opened\n        Klaviyo.handlePush(intent)\n    }` :
        `\n    @Override\n    public void onNewIntent(Intent intent) {\n        super.onNewIntent(intent);\n\n        // Tracks when a system tray notification is opened\n        Klaviyo.handlePush(intent);\n    }`,
      anchor: isKotlin ?
        /^class MainActivity : ReactActivity\(\) \{$/m :
        /^(?:public\s+)?class\s+MainActivity\s+(?:extends|:)\s+ReactActivity\s*(?:\(\))?\s*\{/m,
      offset: 1,
      comment: '//',
    });

    // Check if onCreate already exists
    const hasOnCreate = isKotlin ?
      /override fun onCreate\(/m.test(methodContents.contents) :
      /@Override[\s\S]*?protected void onCreate\(/m.test(methodContents.contents);

    let finalContents = methodContents.contents;

    if (hasOnCreate) {
      // If onCreate exists, inject the Klaviyo.handlePush call after super.onCreate
      KlaviyoLog.log('Found existing onCreate, injecting Klaviyo.handlePush call...');
      const onCreateInjection = isKotlin ?
        'super.onCreate(null)\n        // @generated begin klaviyo-onCreate - expo prebuild (DO NOT MODIFY) sync-klaviyo-oncreate\n        Klaviyo.handlePush(intent)\n        // @generated end klaviyo-onCreate' :
        'super.onCreate(savedInstanceState);\n        // @generated begin klaviyo-onCreate - expo prebuild (DO NOT MODIFY) sync-klaviyo-oncreate\n        Klaviyo.handlePush(getIntent());\n        // @generated end klaviyo-onCreate';

      const onCreateReplacement = isKotlin ?
        /super\.onCreate\(null\)/m :
        /super\.onCreate\(savedInstanceState\);/m;

      // Remove any existing onCreate injection first
      finalContents = finalContents.replace(
        /\/\/ @generated begin klaviyo-onCreate[\s\S]*?\/\/ @generated end klaviyo-onCreate\n?\s*/g,
        ''
      );

      finalContents = finalContents.replace(onCreateReplacement, onCreateInjection);
    } else {
      // If onCreate doesn't exist, add it after onNewIntent
      KlaviyoLog.log('No onCreate found, adding new onCreate method...');
      const onCreateContents = mergeContents({
        tag: 'klaviyo-onCreate',
        src: methodContents.contents,
        newSrc: isKotlin ?
          `\n    override fun onCreate(savedInstanceState: android.os.Bundle?) {\n        super.onCreate(savedInstanceState)\n\n        // Tracks when a system tray notification is opened while app is killed\n        Klaviyo.handlePush(intent)\n    }` :
          `\n    @Override\n    protected void onCreate(android.os.Bundle savedInstanceState) {\n        super.onCreate(savedInstanceState);\n\n        // Tracks when a system tray notification is opened while app is killed\n        Klaviyo.handlePush(getIntent());\n    }`,
        anchor: isKotlin ?
          /override fun onNewIntent\(intent: Intent\) \{[\s\S]*?\n {4}\}/m :
          /@Override\s+public void onNewIntent\(Intent intent\) \{[\s\S]*?\n {4}\}/m,
        offset: 1,
        comment: '//',
      });
      finalContents = onCreateContents.contents;
    }

    // Write the modified content back to the file
    fs.writeFileSync(mainActivityPath, finalContents);
  } else {
    KlaviyoLog.log('Removing push tracking code from MainActivity...');
    // Write the cleaned content back
    fs.writeFileSync(mainActivityPath, cleanedContent);
  }
}

const withMainActivityModifications: ConfigPlugin<KlaviyoPluginAndroidProps> = (config, props) => {
  return withDangerousMod(config, [
    'android',
    async (config) => {
      await modifyMainActivity(config, props);
      return config;
    },
  ]);
};

interface ColorResourceConfig {
  modRequest: { platformProjectRoot: string };
}

const createColorResource = async (
  config: ColorResourceConfig,
  color: string | undefined
) => {
  KlaviyoLog.log(`Creating color resource for: ${color}`);
  const colorsDir = path.join(config.modRequest.platformProjectRoot, 'app', 'src', 'main', 'res', 'values');
  if (!fs.existsSync(colorsDir)) {
    fs.mkdirSync(colorsDir, { recursive: true });
  }

  const colorsXmlPath = path.join(colorsDir, 'colors.xml');
  let colorsObj: { resources: { color: { $: { name: string }, _: string }[] } } = { resources: { color: [] } };

  if (fs.existsSync(colorsXmlPath)) {
    const xml = fs.readFileSync(colorsXmlPath, 'utf-8');
    const parsed = await xml2js.parseStringPromise(xml);
    colorsObj = parsed;
  }

  // Remove any existing klaviyo_notification_color
  colorsObj.resources.color = (colorsObj.resources.color || []).filter(
    (c) => c.$.name !== 'klaviyo_notification_color'
  );

  // Only add the new color if it's truthy
  if (color) {
    colorsObj.resources.color.push({ $: { name: 'klaviyo_notification_color' }, _: color });
  }

  // Build XML
  const builder = new xml2js.Builder();
  const newXml = builder.buildObject(colorsObj);

  fs.writeFileSync(colorsXmlPath, newXml);
  KlaviyoLog.log('Merged colors.xml with notification color');
};

const withNotificationResources: ConfigPlugin<KlaviyoPluginAndroidProps> = (config, props) => {
  return withDangerousMod(config, [
    'android',
    async (config) => {
      KlaviyoLog.log('Adding notification resources to Android Manifest');
      KlaviyoLog.log('Notification props:' + {
        iconPath: props.notificationIconFilePath,
        color: props.notificationColor
      });

      // Always call createColorResource with the notificationColor (which may be undefined)
      await createColorResource(config, props.notificationColor);

      return config;
    },
  ]);
};

const mutateNotificationManifest = (config: ExportedConfigWithProps<AndroidManifest>, props: KlaviyoPluginAndroidProps) => {
  const androidManifest = config.modResults.manifest;
  
  if (!androidManifest.application) {
    KlaviyoLog.log('No application tag found, creating one...');
    androidManifest.application = [{ $: { 'android:name': '.MainApplication' } } as ManifestApplication];
  }

  const application = androidManifest.application[0] as ManifestApplication;
  
  if (!application['meta-data']) {
    application['meta-data'] = [];
  }

  // Handle notification icon meta-data
  if (props.notificationIconFilePath) {
    KlaviyoLog.log(`Adding notification icon meta-data: ${props.notificationIconFilePath}`);
    const iconMetaData = {
      $: {
        'android:name': 'com.klaviyo.push.default_notification_icon',
        'android:resource': '@drawable/notification_icon'
      }
    } as ManifestMetaData;
    const iconExists = (application['meta-data'] || []).some(
      (item: ManifestMetaData) => item.$['android:name'] === 'com.klaviyo.push.default_notification_icon'
    );
    if (!iconExists) {
      application['meta-data'].push(iconMetaData);
      KlaviyoLog.log(`Added icon meta-data: ${JSON.stringify(iconMetaData, null, 2)}`);
    } else {
      KlaviyoLog.log('Icon meta-data already exists, skipping');
    }
  } else {
    // Remove notification icon meta-data if it exists
    KlaviyoLog.log('Removing notification icon meta-data');
    application['meta-data'] = (application['meta-data'] || []).filter(
      (item: ManifestMetaData) => item.$['android:name'] !== 'com.klaviyo.push.default_notification_icon'
    );
  }

  // Add notification color if provided
  if (props.notificationColor) {
    KlaviyoLog.log(`Adding notification color meta-data: ${props.notificationColor}`);
    const colorMetaData = {
      $: {
        'android:name': 'com.klaviyo.push.default_notification_color',
        'android:resource': '@color/klaviyo_notification_color'
      }
    } as ManifestMetaData;
    const colorExists = (application['meta-data'] || []).some(
      (item: ManifestMetaData) => item.$['android:name'] === 'com.klaviyo.push.default_notification_color'
    );
    if (!colorExists) {
      application['meta-data'].push(colorMetaData);
      KlaviyoLog.log(`Added color meta-data: ${JSON.stringify(colorMetaData, null, 2)}`);
    } else {
      KlaviyoLog.log('Color meta-data already exists, skipping');
    }
  } else {
    // Remove notification color meta-data if it exists
    KlaviyoLog.log('Removing notification color meta-data');
    application['meta-data'] = (application['meta-data'] || []).filter(
      (item: ManifestMetaData) => item.$['android:name'] !== 'com.klaviyo.push.default_notification_color'
    );
  }

  return config;
};

const withNotificationManifest: ConfigPlugin<KlaviyoPluginAndroidProps> = (config, props) => {
  return withAndroidManifest(config, (config) => mutateNotificationManifest(config, props));
};

const withNotificationIcon: ConfigPlugin<KlaviyoPluginAndroidProps> = (config, props) => {
  KlaviyoLog.log('Setting up notification icon handling...');
  
  return withDangerousMod(config, [
    'android',
    async (config) => {
      KlaviyoLog.log('Executing notification icon handling...');
      
      // Get absolute paths
      const platformProjectRoot = path.resolve(config.modRequest.platformProjectRoot);
      const drawableDir = path.join(platformProjectRoot, 'app', 'src', 'main', 'res', 'drawable');
      const destPath = path.join(drawableDir, 'notification_icon.png');

      if (props.notificationIconFilePath) {
        const sourcePath = path.resolve(config.modRequest.projectRoot, props.notificationIconFilePath);
        
        if (!fs.existsSync(sourcePath)) {
          throw new Error(`Notification icon file not found: ${sourcePath}`);
        }

        if (!fs.existsSync(drawableDir)) {
          fs.mkdirSync(drawableDir, { recursive: true });
        }

        try {
          fs.copyFileSync(sourcePath, destPath);
        } catch (error) {
          throw new Error(`Failed to copy notification icon: ${error}`);
        }
      } else {
        // Remove the notification icon file if it exists
        KlaviyoLog.log('Removing notification icon from Android resources');
        if (fs.existsSync(destPath)) {
          try {
            // First try to remove the file
            fs.unlinkSync(destPath);
          } catch {
            // If unlinkSync throws, try force removal as fallback
            try {
              fs.rmSync(destPath, { force: true });
            } catch (rmError) {
              throw new Error(`Failed to remove notification icon: ${rmError instanceof Error ? rmError.toString() : rmError}`);
            }
            return config;
          }
          // If file still exists after unlinkSync, try rmSync
          if (fs.existsSync(destPath)) {
            try {
              fs.rmSync(destPath, { force: true });
            } catch (rmError) {
              throw new Error(`Failed to remove notification icon: ${rmError instanceof Error ? rmError.toString() : rmError}`);
            }
          }
        } else {
          KlaviyoLog.log('No notification icon found to remove');
        }
      }

      return config;
    },
  ]);
};

const withKlaviyoAndroid: ConfigPlugin<KlaviyoPluginAndroidProps> = (config, props) => {
  const typedConfig = config as typeof config & { modResults: KlaviyoAndroidModResults };
  if (!typedConfig.modResults) typedConfig.modResults = {};
  if (!typedConfig.modResults.manifest) typedConfig.modResults.manifest = {
    application: [{ $: { 'android:name': '.MainApplication' }, 'meta-data': [], service: [] }]
  };
  if (!typedConfig.modResults.resources) typedConfig.modResults.resources = { string: [], color: [] };
  if (!props) props = { logLevel: 1, openTracking: true, notificationIconFilePath: undefined, notificationColor: undefined };
  KlaviyoLog.log('Starting Android plugin configuration...');
  KlaviyoLog.log('Plugin props:' + JSON.stringify(props));

  return withPlugins(config, [
    withNotificationIcon,
    withNotificationManifest,
    withNotificationResources,
    withAndroidManifestModifications,
    withMainActivityModifications,
    withKlaviyoPluginNameVersion,
  ].map(plugin => [plugin, props]));
};

/**
 * Adds or updates the klaviyo_sdk_plugin_name_override and klaviyo_sdk_plugin_version_override
 * string resources in android/app/src/main/res/values/strings.xml.
 */
export const withKlaviyoPluginNameVersion: ConfigPlugin = config => {
  return withStringsXml(config, config => {
    interface StringResource {
      $: { name: string };
      _: string;
    }
    const strings = config.modResults as { resources: { string: StringResource[]; color: { $: { name: string }; _: string }[] } };

    // Ensure resources and string array exist
    if (!strings.resources) strings.resources = { string: [], color: [] };
    if (!Array.isArray(strings.resources.string)) strings.resources.string = [];
    const stringArray = strings.resources.string;

    function setStringResource(name: string, value: string) {
      const existing = stringArray.find((item) => item?.$?.name === name);
      if (existing) {
        existing._ = value;
      } else {
        stringArray.push({ $: { name }, _: value });
      }
    }

    setStringResource('klaviyo_sdk_plugin_name_override', 'klaviyo-expo');
    setStringResource('klaviyo_sdk_plugin_version_override', '0.0.2');

    return config;
  });
};

// TEST ONLY exports
export { findMainActivity, withMainActivityModifications, withNotificationIcon, withNotificationManifest, mutateNotificationManifest, createColorResource, mutateAndroidManifest };

export default withKlaviyoAndroid; 