import { ConfigPlugin } from '@expo/config-plugins';
import withKlaviyoAndroid from './withKlaviyoAndroid';
import withKlaviyoIos from './withKlaviyoIos';
import { KlaviyoPluginProps, mergeProps } from './types';
import { validateAndroidConfig, validateIosConfig } from './support/validateConfig';
import * as path from 'path';
import { KlaviyoLog } from './support/logger';
import { warnOnUnsupportedSdk } from './support/sdkSupport';

const withKlaviyo: ConfigPlugin<KlaviyoPluginProps | undefined> = (config, props) => {
  KlaviyoLog.log('Running prebuild configuration');
  warnOnUnsupportedSdk(config.sdkVersion);

  const mergedProps = mergeProps(props);
  // cwd() is only the project root when the caller happens to be standing in it, which
  // breaks relative asset paths in app.config.js. Expo populates _internal in getConfig();
  // the fallback covers callers that build an ExpoConfig by hand, such as our own tests.
  const projectRoot: string | undefined = config._internal?.projectRoot;
  const resolvedProjectRoot = projectRoot ?? path.resolve(process.cwd());
  
  // Apply iOS configuration
  if (mergedProps.ios) {
    validateIosConfig(mergedProps.ios);
    config = withKlaviyoIos(config, mergedProps.ios);
  }
  
  // Apply Android configuration
  if (mergedProps.android) {
    validateAndroidConfig(mergedProps.android, resolvedProjectRoot);
    config = withKlaviyoAndroid(config, mergedProps.android);
  }

  return config;
};

export default withKlaviyo; 