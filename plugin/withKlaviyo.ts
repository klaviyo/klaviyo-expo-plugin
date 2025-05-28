import { ConfigPlugin } from '@expo/config-plugins';
import withKlaviyoAndroid from './withKlaviyoAndroid';
import withKlaviyoIos from './withKlaviyoIos';
import { KlaviyoPluginProps, mergeProps } from './types';

const withKlaviyo: ConfigPlugin<KlaviyoPluginProps> = (config, props) => {
  console.log('🔄 Klaviyo Expo Plugin: Running prebuild configuration...');
  const mergedProps = mergeProps(props);
  // Apply iOS configuration
  config = withKlaviyoIos(config, mergedProps.ios);
  
  // Apply Android configuration
  config = withKlaviyoAndroid(config, mergedProps.android);

  return config;
};

export default withKlaviyo; 