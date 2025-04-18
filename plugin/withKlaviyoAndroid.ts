import { ConfigPlugin, withStringsXml, withAndroidManifest } from '@expo/config-plugins';
import { KlaviyoPluginProps } from './withKlaviyo';

interface StringResource {
  $: { name: string };
  _: string;
}

interface StringsXml {
  resources: {
    string: StringResource[];
  };
}

const withProjectStrings: ConfigPlugin<KlaviyoPluginProps> = (config) => {
  return withStringsXml(config, (config) => {
    config.modResults = config.modResults ?? { resources: { string: [] } };
    config.modResults.resources.string = config.modResults.resources.string ?? [];

    // Add or update the version string
    const versionIndex = config.modResults.resources.string.findIndex(
      (item: StringResource) => item.$.name === 'klaviyo_sdk_version_override'
    );
    if (versionIndex > -1) {
      config.modResults.resources.string[versionIndex]._ = '.0.0.1';
    } else {
      config.modResults.resources.string.push({
        $: { name: 'klaviyo_sdk_version_override' },
        _: '.0.0.1',
      });
    }

    // Add or update the name string
    const nameIndex = config.modResults.resources.string.findIndex(
      (item: StringResource) => item.$.name === 'klaviyo_sdk_name_override'
    );
    if (nameIndex > -1) {
      config.modResults.resources.string[nameIndex]._ = 'expo';
    } else {
      config.modResults.resources.string.push({
        $: { name: 'klaviyo_sdk_name_override' },
        _: 'expo',
      });
    }

    return config;
  });
};

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

    console.log('✅ Android Manifest modification complete');
    return config;
  });
};

const withKlaviyoAndroid: ConfigPlugin<KlaviyoPluginProps> = (config, props) => {
  config = withProjectStrings(config, props);
  config = withAndroidManifestModifications(config, props);
  return config;
};

export default withKlaviyoAndroid; 