import { ConfigPlugin } from '@expo/config-plugins';
import withKlaviyoIos from './withKlaviyoIos';
import withKlaviyoAndroid from './withKlaviyoAndroid';

export interface KlaviyoPluginProps {
  /**
   * Sets the log level for Android projects (0-5)
   * 0: VERBOSE
   * 1: DEBUG
   * 2: INFO
   * 3: WARN
   * 4: ERROR
   * 5: ASSERT
   */
  androidLogLevel?: number;
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