import { ConfigPlugin } from '@expo/config-plugins';
import withKlaviyoAndroid from './withKlaviyoAndroid';
import withKlaviyoIos from './withKlaviyoIos';
import { KlaviyoPluginConfig, mergeConfig } from './types';

const withKlaviyo: ConfigPlugin<KlaviyoPluginConfig> = (config, props) => {
  console.log('🔄 Klaviyo Expo Plugin: Running prebuild configuration...');
  const mergedProps = mergeConfig(config as KlaviyoPluginConfig);
  // Apply iOS configuration
  config = withKlaviyoIos(config, mergedProps);
  
  // Apply Android configuration
  config = withKlaviyoAndroid(config, mergedProps.android);

  return config;
};

export default withKlaviyo; 