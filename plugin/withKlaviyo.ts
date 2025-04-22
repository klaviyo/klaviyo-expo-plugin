import { ConfigPlugin } from '@expo/config-plugins';
import withKlaviyoIos from './withKlaviyoIos';
import withKlaviyoAndroid from './withKlaviyoAndroid';

export interface KlaviyoPluginProps {
  /**
    0 = disable logging entirely
    1 = Verbose and above
    2 = Debug and above
    3 = Info and above
    4 = Warning and above
    5 = Error and above
    6 = Assert only
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