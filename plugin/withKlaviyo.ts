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
  // Resolve the project root from the config, not from cwd(). process.cwd() is only the
  // project root when the caller happens to be standing in it; it is wrong for a prebuild
  // invoked from a subdirectory, for a monorepo where the command runs at the workspace
  // root, and for any tool that re-invokes config plugins from a platform directory
  // (SDK 49/50 autolinking did exactly that, re-entering from ios/). A wrong value here
  // makes relative asset paths in app.config.js - e.g. notificationIconFilePath - resolve
  // against the wrong directory and fail validation.
  //
  // Expo sets _internal.projectRoot in getConfig() before config plugins run, so the
  // fallback is not for Expo itself: it covers callers that build an ExpoConfig by hand,
  // such as our own unit tests and third-party tooling, where _internal is absent.
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