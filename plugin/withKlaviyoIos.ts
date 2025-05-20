import { ConfigPlugin, withXcodeProject } from '@expo/config-plugins';
import { KlaviyoPluginIosConfig } from './types';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Adds klaviyo-plugin-configuration.plist to the iOS project and includes it in the app bundle.
 */
const withKlaviyoPluginConfigurationPlist: ConfigPlugin = config => {
  return withXcodeProject(config, async (config) => {
    const xcodeProject = config.modResults;
    const projectName = config.modRequest.projectName || config.name;
    if (!projectName) {
      throw new Error('Could not determine project name for iOS build');
    }

    // Get the plugin's root directory, accounting for the dist folder
    const pluginRoot = path.resolve(__dirname, '../..');
    const srcPlistPath = path.join(pluginRoot, 'ios', 'klaviyo-plugin-configuration.plist');
    const destPlistPath = path.join(
      config.modRequest.platformProjectRoot,
      projectName,
      'klaviyo-plugin-configuration.plist'
    );

    if (fs.existsSync(srcPlistPath)) {
      // Copy the file
      fs.copyFileSync(srcPlistPath, destPlistPath);
      console.log(`✅ Copied klaviyo-plugin-configuration.plist to ${destPlistPath}`);

      // Get the main group
      const mainGroup = xcodeProject.getFirstProject().firstProject.mainGroup;
      const mainGroupId = xcodeProject.findPBXGroupKey({ name: projectName });
      
      if (!mainGroupId) {
        console.warn(`⚠️ Could not find main group for project ${projectName}, skipping Xcode project modification`);
        return config;
      }

      // Add the file to the Xcode project
      const fileRef = xcodeProject.addFile(
        destPlistPath,
        mainGroupId,
        { target: xcodeProject.getFirstTarget().uuid }
      );

      if (!fileRef) {
        console.warn('⚠️ Failed to add file to Xcode project');
        return config;
      }

      // Add the file to the "Copy Bundle Resources" build phase
      const target = xcodeProject.getFirstTarget();
      if (!target) {
        console.warn('⚠️ Could not find target, skipping build phase modification');
        return config;
      }

      // Find or create the Copy Bundle Resources build phase
      let buildPhase = xcodeProject.buildPhaseObject(
        target.uuid,
        'PBXResourcesBuildPhase'
      );

      if (!buildPhase) {
        // Create the build phase if it doesn't exist
        buildPhase = xcodeProject.addBuildPhase(
          [],
          'PBXResourcesBuildPhase',
          'Copy Bundle Resources',
          target.uuid
        );
        console.log('✅ Created Copy Bundle Resources build phase');
      }

      if (buildPhase) {
        // Add the file as a resource
        xcodeProject.addResourceFile(destPlistPath, { target: target.uuid });
        console.log('✅ Added klaviyo-plugin-configuration.plist to Xcode project');

        // Ensure the file is included in the build phase
        const buildPhaseFiles = buildPhase.files || [];
        const fileRefId = fileRef.fileRef;
        
        // Check if the file is already in the build phase
        const fileAlreadyInBuildPhase = buildPhaseFiles.some(
          (file: any) => file.fileRef === fileRefId
        );

        if (!fileAlreadyInBuildPhase) {
          // Add the file to the build phase
          xcodeProject.addToPbxBuildFileSection(fileRef);
          xcodeProject.addToPbxResourcesBuildPhase(fileRef);
          console.log('✅ Added klaviyo-plugin-configuration.plist to Copy Bundle Resources build phase');
        }
      } else {
        console.warn('⚠️ Failed to create or find Copy Bundle Resources build phase');
      }
    } else {
      console.warn(`⚠️ Source plist not found at ${srcPlistPath}`);
    }

    return config;
  });
};

const withKlaviyoIos: ConfigPlugin<KlaviyoPluginIosConfig> = (config, props) => {
  config = withKlaviyoPluginConfigurationPlist(config);
  return config;
};

export default withKlaviyoIos; 