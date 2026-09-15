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
  // Expo sets _internal.projectRoot before config plugins run. Prefer it over cwd():
  // on SDK 49/50 autolinking re-invokes config plugins from ios/, where cwd() is wrong
  // and relative asset paths in app.config.js fail to resolve.
  const projectRoot = (config as unknown as { _internal?: { projectRoot?: string } })._internal?.projectRoot
    ?? path.resolve(process.cwd());
  
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