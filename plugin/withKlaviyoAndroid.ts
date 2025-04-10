import { ConfigPlugin } from '@expo/config-plugins';
import { KlaviyoPluginProps } from './withKlaviyo';

const withKlaviyoAndroid: ConfigPlugin<KlaviyoPluginProps> = (config, props) => {
  // TODO: Add Android-specific configuration
  return config;
};

export default withKlaviyoAndroid; 