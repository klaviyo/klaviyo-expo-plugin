import { ConfigPlugin, withDangerousMod, withAndroidManifest, withStringsXml, withAndroidColors, withPlugins, withGradleProperties, AndroidConfig } from '@expo/config-plugins';
import * as fs from 'fs';
import * as path from 'path';
import {
  KlaviyoPluginAndroidProps,
  KlaviyoAndroidModResults,
  mergeAndroidProps
} from './types';
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

const withNotificationResources: ConfigPlugin<KlaviyoPluginAndroidProps> = (config, props) => {
  return withAndroidColors(config, (config) => {
    KlaviyoLog.log(`Setting notification color resource: ${props.notificationColor}`);
    config.modResults = AndroidConfig.Colors.assignColorValue(config.modResults, {
      name: 'klaviyo_notification_color',
      value: props.notificationColor,
    });
    return config;
  });
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

/**
 * Controls whether the full location module (with geofencing + permissions) is included.
 * When false, only location-core is included (lightweight, no permissions).
 */
const withLocationGradleProperties: ConfigPlugin<KlaviyoPluginAndroidProps> = (config, props) => {
  const enabled = props.geofencingEnabled ?? false;
  return withGradleProperties(config, (config) => {
    const key = 'klaviyoIncludeLocation';
    // Also remove old property name if present
    config.modResults = config.modResults.filter(
      (item) => !(item.type === 'property' && (item.key === key || item.key === 'klaviyoIncludeLocationPermissions'))
    );
    config.modResults.push({ type: 'property', key, value: enabled.toString() });
    return config;
  });
};

/**
 * Controls whether the full forms module (in-app forms rendering) is included.
 * When false, only forms-core is included (lightweight, no WebView deps).
 */
const withFormsGradleProperties: ConfigPlugin<KlaviyoPluginAndroidProps> = (config, props) => {
  const enabled = props.formsEnabled ?? true;
  return withGradleProperties(config, (config) => {
    const key = 'klaviyoIncludeForms';
    config.modResults = config.modResults.filter(
      (item) => !(item.type === 'property' && item.key === key)
    );
    config.modResults.push({ type: 'property', key, value: enabled.toString() });
    return config;
  });
};

const withKlaviyoAndroid: ConfigPlugin<KlaviyoPluginAndroidProps> = (config, props) => {
  const typedConfig = config as typeof config & { modResults: KlaviyoAndroidModResults };
  if (!typedConfig.modResults) typedConfig.modResults = {};
  if (!typedConfig.modResults.manifest) typedConfig.modResults.manifest = {
    application: [{ $: { 'android:name': '.MainApplication' }, 'meta-data': [], service: [] }]
  };
  if (!typedConfig.modResults.resources) typedConfig.modResults.resources = { string: [], color: [] };
  if (!props) props = mergeAndroidProps();
  KlaviyoLog.log('Starting Android plugin configuration...');
  KlaviyoLog.log('Plugin props:' + JSON.stringify(props));

  return withPlugins(config, [
    withNotificationIcon,
    withNotificationManifest,
    withNotificationResources,
    withAndroidManifestModifications,
    withKlaviyoPluginNameVersion,
    withLocationGradleProperties,
    withFormsGradleProperties,
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
    setStringResource('klaviyo_sdk_plugin_version_override', '0.4.0');

    return config;
  });
};

// TEST ONLY exports
export { withNotificationIcon, withNotificationManifest, mutateNotificationManifest, mutateAndroidManifest, withLocationGradleProperties, withFormsGradleProperties, withNotificationResources };

export default withKlaviyoAndroid; 
