import { ConfigPlugin, withStringsXml } from '@expo/config-plugins';
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

const withKlaviyoAndroid: ConfigPlugin<KlaviyoPluginProps> = (config, props) => {
  config = withProjectStrings(config, props);
  return config;
};

export default withKlaviyoAndroid; 