import { ConfigPlugin, withInfoPlist, withDangerousMod } from '@expo/config-plugins';
import { KlaviyoPluginProps } from './withKlaviyo';
import fs from 'fs';
import path from 'path';

const withKlaviyoIos: ConfigPlugin<KlaviyoPluginProps> = (config, props) => {
  // Handle the Podfile modification for modular headers
  config = withDangerousMod(config, [
    'ios',
    async (config) => {
      const podfilePath = path.join(config.modRequest.platformProjectRoot, 'Podfile');
      const podfileContent = fs.readFileSync(podfilePath, 'utf-8');

      // Add use_modular_headers! if it's not already there
      if (!podfileContent.includes('use_modular_headers!')) {
        const modifiedContent = podfileContent.replace(
          'prepare_react_native_project!',
          'prepare_react_native_project!\n\nuse_modular_headers!'
        );
        fs.writeFileSync(podfilePath, modifiedContent);
      }

      return config;
    },
  ]);

  // Handle the Info.plist modifications
  return withInfoPlist(config, (config) => {
    const infoPlist = config.modResults;
    return config;
  });
};

export default withKlaviyoIos; 