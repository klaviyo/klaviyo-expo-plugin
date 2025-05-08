import { ConfigPlugin, withDangerousMod, withInfoPlist } from '@expo/config-plugins';
import { KlaviyoPluginIosConfig, KlaviyoPluginProps } from './types';
import * as path from 'path';
import * as fs from 'fs';

const withKlaviyoPodfile: ConfigPlugin<KlaviyoPluginProps> = (config) => {
  return withDangerousMod(config, [
    'ios',
    async config => {
      const iosRoot = path.join(config.modRequest.projectRoot, "ios")
      updatePodfile(iosRoot).catch(err => { console.log(err) });
      return config;
    },
  ]);
}

const withRemoteNotificationsPermissions: ConfigPlugin<KlaviyoPluginProps> = (
  config
) => {
  return withInfoPlist(config, (config) => {
    const infoPlist = config.modResults;
    return config;
  });
};

const withKlaviyoIos: ConfigPlugin<KlaviyoPluginProps> = (config, props) => {
  config = withRemoteNotificationsPermissions(config, props);
  config = withKlaviyoPodfile(config, props)
  return config;
};

export async function updatePodfile(iosPath: string) {
  const podfile = await FileManager.readFile(`${iosPath}/Podfile`);
  
  // Check if the pod is already added
  if (podfile.includes("pod 'KlaviyoSwiftExtension'")) {
    return;
  }

  // Find the main target declaration
  const targetRegex = /target '([^']+)' do/;
  const match = podfile.match(targetRegex);
  
  if (!match) {
    console.error("Could not find target declaration in Podfile");
    return;
  }

  // Insert the pod after the target declaration
  const targetLine = match[0];
  const podInsertion = `  pod 'KlaviyoSwiftExtension'`;
  
  const updatedPodfile = podfile.replace(
    targetLine,
    `${targetLine}\n${podInsertion}`
  );

  await FileManager.writeFile(`${iosPath}/Podfile`, updatedPodfile);
}

export default withKlaviyoIos; 

class FileManager {
  static async readFile(path: string): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      fs.readFile(path, 'utf8', (err, data) => {
        if (err || !data) {
          console.log("Couldn't read file:" + path);
          reject(err);
          return;
        }
        resolve(data);
      });
    });
  }

  static async writeFile(path: string, contents: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      fs.writeFile(path, contents, 'utf8', (err) => {
        if (err) {
          console.log("Couldn't write file:" + path);
          reject(err);
          return;
        }
        resolve();
      });
    });
  }

  static async copyFile(path1: string, path2: string): Promise<void> {
    const fileContents = await FileManager.readFile(path1);
    await FileManager.writeFile(path2, fileContents);
  }

  static dirExists(path: string): boolean {
    return fs.existsSync(path)
  }
}