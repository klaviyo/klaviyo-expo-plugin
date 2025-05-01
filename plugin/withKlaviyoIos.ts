import { ConfigPlugin, withInfoPlist } from '@expo/config-plugins';
import { KlaviyoPluginIosConfig } from './types';

const withKlaviyoIos: ConfigPlugin<KlaviyoPluginIosConfig> = (config, props) => {
  return withInfoPlist(config, (config) => {
    const infoPlist = config.modResults;
    return config;
  });
};

export default withKlaviyoIos; 