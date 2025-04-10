import { ConfigPlugin } from '@expo/config-plugins';
import { KlaviyoPluginProps } from './withKlaviyo';

const withKlaviyoIos: ConfigPlugin<KlaviyoPluginProps> = (config, props) => {
  // TODO: Add iOS-specific configuration
  return config;
};

export default withKlaviyoIos; 