import { ConfigPlugin, withInfoPlist } from '@expo/config-plugins';
import { KlaviyoPluginProps } from './withKlaviyo';

const withKlaviyoIos: ConfigPlugin<KlaviyoPluginProps> = (config, props) => {
  return withInfoPlist(config, (config) => {
    const infoPlist = config.modResults;
    return config;
  });
};

export default withKlaviyoIos; 