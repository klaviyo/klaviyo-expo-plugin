import { ConfigPlugin, withAndroidManifest, withDangerousMod, withGradleProperties } from '@expo/config-plugins';
import { KlaviyoPluginAndroidProps } from '../types';
import * as fs from 'fs';
import * as path from 'path';

const withKlaviyoAndroid: ConfigPlugin<KlaviyoPluginAndroidProps> = (config, props) => {
  console.log('🔄 Starting Android plugin configuration...');
  console.log('📝 Plugin props:', props);

  // Add Gradle properties to fix JVM target compatibility
  config = withGradleProperties(config, (config) => {
    config.modResults.push({
      type: 'property',
      key: 'kotlin.jvm.target.validation.mode',
      value: 'warning',
    });
    config.modResults.push({
      type: 'property',
      key: 'org.gradle.jvmargs',
      value: '-Xmx2048m -Dfile.encoding=UTF-8',
    });
    return config;
  });

  // Rest of your existing Android configuration...
  // ... existing code ...

  return config;
};

export default withKlaviyoAndroid; 