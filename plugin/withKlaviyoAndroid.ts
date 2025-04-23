import { ConfigPlugin, withDangerousMod, withAndroidManifest } from '@expo/config-plugins';
import { KlaviyoPluginProps } from './withKlaviyo';
import * as fs from 'fs';
import * as path from 'path';
import { mergeContents } from '@expo/config-plugins/build/utils/generateCode';

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

    const logLevel = props.androidLogLevel ?? 1; // Default to DEBUG (1) if not specified
    console.log(`📝 Setting Klaviyo log level to: ${logLevel}`);

    const logLevelIndex = application['meta-data'].findIndex(
      (item: any) => item.$['android:name'] === 'com.klaviyo.core.log_level'
    );

    if (logLevelIndex > -1) {
      console.log('📝 Updating existing Klaviyo log level...');
      application['meta-data'][logLevelIndex].$['android:value'] = logLevel.toString();
    } else {
      console.log('📝 Adding new Klaviyo log level...');
      application['meta-data'].push({
        $: {
          'android:name': 'com.klaviyo.core.log_level',
          'android:value': logLevel.toString()
        }
      });
    }

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

const withMainActivityModifications: ConfigPlugin = (config) => {
  return withDangerousMod(config, [
    'android',
    async (config) => {
      const mainActivityPath = path.join(
        config.modRequest.platformProjectRoot,
        'app',
        'src',
        'main',
        'java',
        ...config.android?.package?.split('.') ?? ['com', 'klaviyo', 'expoexample'],
        'MainActivity.kt'
      );

      // Read the current content
      const mainActivityContent = fs.readFileSync(mainActivityPath, 'utf-8');

      // Add the imports if they don't exist
      const importContents = mergeContents({
        tag: 'klaviyo-imports',
        src: mainActivityContent,
        newSrc: `
import android.content.Intent
import com.klaviyo.analytics.Klaviyo`,
        anchor: 'import',
        offset: 1,
        comment: '//',
      });

      // Add the onNewIntent override
      const methodContents = mergeContents({
        tag: 'klaviyo-onNewIntent',
        src: importContents.contents,
        newSrc: `
    override fun onNewIntent(intent: Intent?) {
        super.onNewIntent(intent)

        // Tracks when a system tray notification is opened
        Klaviyo.handlePush(intent)
    }`,
        anchor: 'class MainActivity',
        offset: 1,
        comment: '//',
      });

      // Write the modified content back to the file
      fs.writeFileSync(mainActivityPath, methodContents.contents);

      return config;
    },
  ]);
};

const withKlaviyoAndroid: ConfigPlugin<KlaviyoPluginProps> = (config, props) => {
  config = withAndroidManifestModifications(config, props);
  config = withMainActivityModifications(config);
  return config;
};

export default withKlaviyoAndroid; 