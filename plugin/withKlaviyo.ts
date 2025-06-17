import { ConfigPlugin } from '@expo/config-plugins';
import withKlaviyoAndroid from './withKlaviyoAndroid';
import withKlaviyoIos from './withKlaviyoIos';
import { KlaviyoPluginProps, mergeProps } from './types';
import { validateAndroidConfig, validateIosConfig } from './support/validateConfig';
import * as path from 'path';
import { KlaviyoLog } from './support/logger';

const withKlaviyo: ConfigPlugin<KlaviyoPluginProps> = (config, props) => {
  KlaviyoLog.log('Running prebuild configuration');

  const mergedProps = mergeProps(props);
  const projectRoot = path.resolve(process.cwd());
  
  // Apply iOS configuration
  if (mergedProps.ios) {
    validateIosConfig(mergedProps.ios);
    config = withKlaviyoIos(config, mergedProps.ios);
  }
  
  // Apply Android configuration
  if (mergedProps.android) {
    validateAndroidConfig(mergedProps.android, projectRoot);
    config = withKlaviyoAndroid(config, mergedProps.android);
  }

  return config;
};

export default withKlaviyo; 