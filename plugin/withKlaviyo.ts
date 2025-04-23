import { ConfigPlugin } from '@expo/config-plugins';
import withKlaviyoAndroid from './withKlaviyoAndroid';
import withKlaviyoIos from './withKlaviyoIos';

export interface KlaviyoPluginProps {
  /**
   * Android-specific configuration
   */
  android?: {
    /**
     * Log level for Android
     * 0 = disable logging entirely
     * 1 = Verbose and above
     * 2 = Debug and above
     * 3 = Info and above
     * 4 = Warning and above
     * 5 = Error and above
     * 6 = Assert only
     */
    logLevel?: number;
    /**
     * Whether to enable open tracking for push notifications
     */
    openTracking?: boolean;
  };
  /**
   * iOS-specific configuration
   */
  ios?: {
    // Add iOS-specific configuration options here
  };
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