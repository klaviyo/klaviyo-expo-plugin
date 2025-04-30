import { ConfigPlugin, withDangerousMod, withAndroidManifest } from '@expo/config-plugins';
import { KlaviyoPluginProps as BaseKlaviyoPluginProps } from './withKlaviyo';
import * as fs from 'fs';
import * as path from 'path';
import { mergeContents } from '@expo/config-plugins/build/utils/generateCode';
import { getMainActivityAsync } from '@expo/config-plugins/build/android/Paths';
import * as glob from 'glob';


// todo make these default to true
interface KlaviyoAndroidProps {
  logLevel?: number;
  openTracking?: boolean;
}

interface KlaviyoPluginProps extends BaseKlaviyoPluginProps {
  android?: KlaviyoAndroidProps;
  ios?: {};
}

const withAndroidManifestModifications: ConfigPlugin<KlaviyoPluginProps> = (config, props) => {
  return withAndroidManifest(config, (config) => {
    console.log('🔄 Modifying Android Manifest...');
    const androidManifest = config.modResults.manifest;
    
    if (!androidManifest.application) {
      console.log('⚠️ No application tag found, creating one...');
      androidManifest.application = [{ $: { 'android:name': '.MainApplication' } }];
    }

    const application = androidManifest.application[0];
    
    // Add or update the log level meta-data
    if (!application['meta-data']) {
      console.log('⚠️ No meta-data array found, creating one...');
      application['meta-data'] = [];
    }

    const logLevel = props.android?.logLevel ?? 1; // Default to DEBUG (1) if not specified
    console.log(`📝 Setting Klaviyo log level to: ${logLevel}`);

    // Remove any existing log level meta-data entries
    application['meta-data'] = application['meta-data'].filter(
      (item: any) => !['com.klaviyo.core.log_level', 'com.klaviyo.android.log_level'].includes(item.$['android:name'])
    );

    // Add the correct log level meta-data
    console.log('📝 Adding Klaviyo log level with correct name...');
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
      console.log('📝 Adding KlaviyoPushService to manifest...');
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

    console.log('✅ Android Manifest modification complete');
    return config;
  });
};

const findMainActivity = async (projectRoot: string): Promise<string | null> => {
  console.log('🔍 Searching for MainActivity in:', projectRoot);
  
  // First try Expo's built-in detection
  try {
    const expoMainActivity = await getMainActivityAsync(projectRoot);
    const mainActivityPath = expoMainActivity?.toString();
    if (mainActivityPath && fs.existsSync(mainActivityPath)) {
      console.log('✅ Found MainActivity using Expo detection:', mainActivityPath);
      return mainActivityPath;
    }
  } catch (e: unknown) {
    console.log('⚠️ Could not find main activity using Expo detection:', e instanceof Error ? e.message : String(e));
  }

  // Fall back to searching for ReactActivity
  const possibleJavaDirs = [
    path.join(projectRoot, 'app', 'src', 'main', 'java'),
    path.join(projectRoot, 'src', 'main', 'java'),
    path.join(projectRoot, 'java')
  ];

  for (const javaDir of possibleJavaDirs) {
    console.log('🔍 Checking directory:', javaDir);
    if (!fs.existsSync(javaDir)) {
      console.log('⚠️ Directory does not exist:', javaDir);
      continue;
    }

    const files = glob.sync('**/*.kt', { cwd: javaDir });
    console.log(`📝 Found ${files.length} Kotlin files in ${javaDir}`);
    
    for (const file of files) {
      const filePath = path.join(javaDir, file);
      const content = fs.readFileSync(filePath, 'utf-8');
      if (content.includes('class') && (content.includes(': ReactActivity') || content.includes('extends ReactActivity'))) {
        console.log('✅ Found ReactActivity in:', filePath);
        return filePath;
      }
    }
  }

  console.log('❌ Could not find MainActivity in any of the expected locations');
  return null;
};

const withMainActivityModifications: ConfigPlugin<KlaviyoPluginProps> = (config, props) => {
  return withDangerousMod(config, [
    'android',
    async (config) => {
      console.log('🔄 Modifying MainActivity.kt...');
      console.log('📝 OpenTracking setting:', props.android?.openTracking);

      if (!config.android?.package) {
        throw new Error('Android package not found in app config');
      }

      const mainActivityPath = await findMainActivity(config.modRequest.platformProjectRoot);

      if (!mainActivityPath) {
        throw new Error('Could not find main activity file. Please ensure your app has a valid ReactActivity.');
      }

      console.log('📝 MainActivity path:', mainActivityPath);

      if (!fs.existsSync(mainActivityPath)) {
        throw new Error(`MainActivity not found at path: ${mainActivityPath}`);
      }

      // Read the current content
      const mainActivityContent = fs.readFileSync(mainActivityPath, 'utf-8');
      console.log('📝 Found MainActivity.kt, current size:', mainActivityContent.length, 'bytes');

      // Find the package declaration line to use as our anchor
      const packageMatch = mainActivityContent.match(/^package .+$/m);
      if (!packageMatch) {
        throw new Error('Could not find package declaration in MainActivity.kt');
      }

      // Find the class declaration line to use as our anchor
      const classMatch = mainActivityContent.match(/^class MainActivity.*\{/m);
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
      if (props.android?.openTracking) {
        console.log('📝 Adding push tracking code to MainActivity...');
        
        // First, remove any existing generated content
        let contentWithoutGenerated = cleanedContent.replace(
          /\/\/ @generated begin klaviyo-[\s\S]*?\/\/ @generated end klaviyo-/g,
          ''
        ).trim();

        // Add imports right after the package declaration
        const importContents = mergeContents({
          tag: 'klaviyo-imports',
          src: contentWithoutGenerated,
          newSrc: `
import android.content.Intent
import com.klaviyo.analytics.Klaviyo`,
          anchor: /^package .+$/m,
          offset: 1,
          comment: '//',
        });

        // Add the onNewIntent override right after the class declaration
        const methodContents = mergeContents({
          tag: 'klaviyo-onNewIntent',
          src: importContents.contents,
          newSrc: `
    override fun onNewIntent(intent: Intent?) {
        super.onNewIntent(intent)

        // Tracks when a system tray notification is opened
        Klaviyo.handlePush(intent)
    }`,
          anchor: /^class MainActivity : ReactActivity\(\) \{$/m,
          offset: 1,
          comment: '//',
        });

        // Write the modified content back to the file
        fs.writeFileSync(mainActivityPath, methodContents.contents);
      } else {
        console.log('📝 Removing push tracking code from MainActivity...');
        // Write the cleaned content back
        fs.writeFileSync(mainActivityPath, cleanedContent);
      }

      return config;
    },
  ]);
};

const withKlaviyoAndroid: ConfigPlugin<KlaviyoPluginProps> = (config, props) => {
  console.log('🔄 Starting Android plugin configuration...');
  console.log('📝 Plugin props:', JSON.stringify(props, null, 2));
  
  config = withAndroidManifestModifications(config, props);
  console.log('✅ Android manifest modifications complete');
  
  config = withMainActivityModifications(config, props);
  console.log('✅ MainActivity modifications complete');
  
  return config;
};

export default withKlaviyoAndroid; 