import { ConfigPlugin, withDangerousMod, withAndroidManifest, withStringsXml, withPlugins } from '@expo/config-plugins';
import * as fs from 'fs';
import * as path from 'path';
import { mergeContents } from '@expo/config-plugins/build/utils/generateCode';
import { getMainActivityAsync } from '@expo/config-plugins/build/android/Paths';
import * as glob from 'glob';
import { KlaviyoPluginAndroidProps } from './types';
import * as xml2js from 'xml2js';


const withAndroidManifestModifications: ConfigPlugin<KlaviyoPluginAndroidProps> = (config, props) => {
  return withAndroidManifest(config, (config) => {
    const androidManifest = config.modResults.manifest;
    
    if (!androidManifest.application) {
      androidManifest.application = [{ $: { 'android:name': '.MainApplication' } }];
    }

    const application = androidManifest.application[0];
    
    // Add or update the log level meta-data
    if (!application['meta-data']) {
      application['meta-data'] = [];
    }

    const logLevel = props.logLevel ?? 1; // Default to DEBUG (1) if not specified

    // Remove any existing log level meta-data entries
    application['meta-data'] = application['meta-data'].filter(
      (item: any) => !['com.klaviyo.core.log_level', 'com.klaviyo.android.log_level'].includes(item.$['android:name'])
    );

    // Add the correct log level meta-data
    application['meta-data'].push({
      $: {
        'android:name': 'com.klaviyo.core.log_level',
        'android:value': logLevel.toString()
      }
    });

    // Add KlaviyoPushService to the manifest
    if (!application.service) {
      application.service = [];
    }

    const pushServiceIndex = application.service.findIndex(
      (item: any) => item.$['android:name'] === 'com.klaviyo.pushFcm.KlaviyoPushService'
    );

    if (pushServiceIndex === -1) {
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
  });
};

const findMainActivity = async (projectRoot: string): Promise<{ path: string; isKotlin: boolean } | null> => {
  // First try Expo's built-in detection
  try {
    const expoMainActivity = await getMainActivityAsync(projectRoot);
    const mainActivityPath = expoMainActivity?.toString();
    if (mainActivityPath && fs.existsSync(mainActivityPath)) {
      return {
        path: mainActivityPath,
        isKotlin: mainActivityPath.endsWith('.kt')
      };
    }
  } catch (e: unknown) {
    
  }

  // Fall back to searching for ReactActivity
  const possibleJavaDirs = [
    path.join(projectRoot, 'app', 'src', 'main', 'java'),
    path.join(projectRoot, 'src', 'main', 'java'),
    path.join(projectRoot, 'java')
  ];

  for (const javaDir of possibleJavaDirs) {
    if (!fs.existsSync(javaDir)) {
      continue;
    }

    // Search for both .kt and .java files
    const kotlinFiles = glob.sync('**/*.kt', { cwd: javaDir });
    const javaFiles = glob.sync('**/*.java', { cwd: javaDir });
    
    // Check Kotlin files first
    for (const file of kotlinFiles) {
      const filePath = path.join(javaDir, file);
      const content = fs.readFileSync(filePath, 'utf-8');
      if (content.includes('class') && (content.includes(': ReactActivity') || content.includes('extends ReactActivity'))) {
        return { path: filePath, isKotlin: true };
      }
    }

    // Then check Java files
    for (const file of javaFiles) {
      const filePath = path.join(javaDir, file);
      const content = fs.readFileSync(filePath, 'utf-8');
      if (content.includes('class') && content.includes('extends ReactActivity')) {
        return { path: filePath, isKotlin: false };
      }
    }
  }

  return null;
};

const withMainActivityModifications: ConfigPlugin<KlaviyoPluginAndroidProps> = (config, props) => {
  return withDangerousMod(config, [
    'android',
    async (config) => {
      if (!config.android?.package) {
        throw new Error('Android package not found in app config');
      }

      const mainActivityInfo = await findMainActivity(config.modRequest.platformProjectRoot);

      if (!mainActivityInfo) {
        throw new Error('Could not find main activity file. Please ensure your app has a valid ReactActivity.');
      }

      const { path: mainActivityPath, isKotlin } = mainActivityInfo;

      if (!fs.existsSync(mainActivityPath)) {
        throw new Error(`MainActivity not found at path: ${mainActivityPath}`);
      }

      // Read the current content
      const mainActivityContent = fs.readFileSync(mainActivityPath, 'utf-8');

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
      let lines = mainActivityContent.split('\n');

      // Remove Klaviyo-related imports and generated blocks
      let newLines: string[] = [];
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
      let cleanedContent = newLines.join('\n').replace(/\n{3,}/g, '\n\n');

      // Only add the code if openTracking is enabled
      if (props.openTracking) {
        // First, remove any existing generated content
        let contentWithoutGenerated = cleanedContent.replace(
          /\/\/ @generated begin klaviyo-[\s\S]*?\/\/ @generated end klaviyo-/g,
          ''
        ).trim();

        // Add imports right after the package declaration
        const importContents = mergeContents({
          tag: 'klaviyo-imports',
          src: contentWithoutGenerated,
          newSrc: isKotlin ? 
            `import android.content.Intent
import com.klaviyo.analytics.Klaviyo` :
            `import android.content.Intent;
import com.klaviyo.analytics.Klaviyo;`,
          anchor: /^package .+$/m,
          offset: 1,
          comment: '//',
        });

        // Add the onNewIntent override right after the class declaration
        const methodContents = mergeContents({
          tag: 'klaviyo-onNewIntent',
          src: importContents.contents,
          newSrc: isKotlin ?
            `
    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)

        // Tracks when a system tray notification is opened
        Klaviyo.handlePush(intent)
    }` :
            `
    @Override
    public void onNewIntent(Intent intent) {
        super.onNewIntent(intent);

        // Tracks when a system tray notification is opened
        Klaviyo.handlePush(intent);
    }`,
          anchor: isKotlin ? 
            /^class MainActivity : ReactActivity\(\) \{$/m :
            /^(?:public\s+)?class\s+MainActivity\s+(?:extends|:)\s+ReactActivity\s*(?:\(\))?\s*\{/m,
          offset: 1,
          comment: '//',
        });

        // Write the modified content back to the file
        fs.writeFileSync(mainActivityPath, methodContents.contents);
      } else {
        // Write the cleaned content back
        fs.writeFileSync(mainActivityPath, cleanedContent);
      }

      return config;
    },
  ]);
};

const createColorResource = async (config: any, color: string | undefined) => {
  const colorsDir = path.join(config.modRequest.platformProjectRoot, 'app', 'src', 'main', 'res', 'values');
  if (!fs.existsSync(colorsDir)) {
    fs.mkdirSync(colorsDir, { recursive: true });
  }

  const colorsXmlPath = path.join(colorsDir, 'colors.xml');
  let colorsObj: any = { resources: { color: [] } };

  if (fs.existsSync(colorsXmlPath)) {
    const xml = fs.readFileSync(colorsXmlPath, 'utf-8');
    const parsed = await xml2js.parseStringPromise(xml);
    colorsObj = parsed;
  }

  // Remove any existing klaviyo_notification_color
  colorsObj.resources.color = (colorsObj.resources.color || []).filter(
    (c: any) => c.$.name !== 'klaviyo_notification_color'
  );

  // Only add the new color if it's truthy
  if (color) {
    colorsObj.resources.color.push({ $: { name: 'klaviyo_notification_color' }, _: color });
  }

  // Build XML
  const builder = new xml2js.Builder();
  const newXml = builder.buildObject(colorsObj);

  fs.writeFileSync(colorsXmlPath, newXml);
};

const withNotificationResources: ConfigPlugin<KlaviyoPluginAndroidProps> = (config, props) => {
  return withDangerousMod(config, [
    'android',
    async (config) => {
      // Always call createColorResource with the notificationColor (which may be undefined)
      await createColorResource(config, props.notificationColor);

      return config;
    },
  ]);
};

const withNotificationManifest: ConfigPlugin<KlaviyoPluginAndroidProps> = (config, props) => {
  return withAndroidManifest(config, (config) => {
    const androidManifest = config.modResults.manifest;
    
    if (!androidManifest.application) {
      androidManifest.application = [{ $: { 'android:name': '.MainApplication' } }];
    }

    const application = androidManifest.application[0];
    
    if (!application['meta-data']) {
      application['meta-data'] = [];
    }

    // Handle notification icon meta-data
    if (props.notificationIconFilePath) {
      const iconMetaData = {
        $: {
          'android:name': 'com.klaviyo.push.default_notification_icon',
          'android:resource': '@drawable/notification_icon'
        }
      };
      const iconExists = application['meta-data'].some(
        (item: any) => item.$['android:name'] === 'com.klaviyo.push.default_notification_icon'
      );
      if (!iconExists) {
        application['meta-data'].push(iconMetaData);
      }
    } else {
      // Remove notification icon meta-data if it exists
      application['meta-data'] = application['meta-data'].filter(
        (item: any) => item.$['android:name'] !== 'com.klaviyo.push.default_notification_icon'
      );
    }

    // Add notification color if provided
    if (props.notificationColor) {
      const colorMetaData = {
        $: {
          'android:name': 'com.klaviyo.push.default_notification_color',
          'android:resource': '@color/klaviyo_notification_color'
        }
      };
      const colorExists = application['meta-data'].some(
        (item: any) => item.$['android:name'] === 'com.klaviyo.push.default_notification_color'
      );
      if (!colorExists) {
        application['meta-data'].push(colorMetaData);
      }
    } else {
      // Remove notification color meta-data if it exists
      application['meta-data'] = application['meta-data'].filter(
        (item: any) => item.$['android:name'] !== 'com.klaviyo.push.default_notification_color'
      );
    }

    return config;
  });
};

const withNotificationIcon: ConfigPlugin<KlaviyoPluginAndroidProps> = (config, props) => {
  return withDangerousMod(config, [
    'android',
    async (config) => {
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
        if (fs.existsSync(destPath)) {
          try {
            // First try to remove the file
            fs.unlinkSync(destPath);
            
            // Verify the file was actually removed
            if (fs.existsSync(destPath)) {
              // Try force removal
              fs.rmSync(destPath, { force: true });
            }
          } catch (error) {
            // Try force removal as fallback
            try {
              fs.rmSync(destPath, { force: true });
            } catch (forceError) {
              throw new Error(`Failed to remove notification icon: ${forceError}`);
            }
          }
        }
      }

      return config;
    },
  ]);
};

const withKlaviyoAndroid: ConfigPlugin<KlaviyoPluginAndroidProps> = (config, props) => {
  return withPlugins(config, [
    [withNotificationIcon, props],
    [withNotificationManifest, props],
    [withNotificationResources, props],
    [withAndroidManifestModifications, props],
    [withMainActivityModifications, props],
    withKlaviyoPluginNameVersion,
  ]);
};

/**
 * Adds or updates the klaviyo_sdk_plugin_name_override and klaviyo_sdk_plugin_version_override
 * string resources in android/app/src/main/res/values/strings.xml.
 */
export const withKlaviyoPluginNameVersion: ConfigPlugin = config => {
  return withStringsXml(config, config => {
    let strings = config.modResults;

    function setStringResource(name: string, value: string) {
      const existing = strings.resources.string?.find((item: any) => item.$.name === name);
      if (existing) {
        existing._ = value;
      } else {
        if (!strings.resources.string) strings.resources.string = [];
        strings.resources.string.push({ $: { name }, _: value });
      }    }

    setStringResource('klaviyo_sdk_plugin_name_override', 'klaviyo-expo');
    setStringResource('klaviyo_sdk_plugin_version_override', '0.0.2');

    return config;
  });
};

export default withKlaviyoAndroid; 