import { ConfigPlugin } from '@expo/config-plugins';
import withKlaviyoIos from './withKlaviyoIos';
import withKlaviyoAndroid from './withKlaviyoAndroid';

export interface KlaviyoPluginProps {
  // Add any plugin-specific props here
}

const withKlaviyo: ConfigPlugin<KlaviyoPluginProps> = (config, props) => {
  console.log('🔄 Klaviyo Expo Plugin: Running prebuild configuration...');
  
  // Apply iOS configuration
  config = withKlaviyoIos(config, props);
  
  // Apply Android configuration
  config = withKlaviyoAndroid(config, props);

  return config;
};

export default withKlaviyo; 