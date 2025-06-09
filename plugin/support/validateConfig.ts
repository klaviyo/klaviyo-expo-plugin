import { KlaviyoPluginProps } from '../types';
import * as fs from 'fs';
import * as path from 'path';

export class KlaviyoConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'KlaviyoConfigError';
  }
}

export const validateAndroidConfig = (config: KlaviyoPluginProps['android'], projectRoot?: string) => {
  if (!config) return;

  // Validate logLevel
  if (config.logLevel !== undefined) {
    if (!Number.isInteger(config.logLevel) || config.logLevel < 0 || config.logLevel > 7) {
      throw new KlaviyoConfigError('Android logLevel must be an integer between 0 and 6');
    }
  }

  // Validate openTracking
  if (config.openTracking !== undefined && typeof config.openTracking !== 'boolean') {
    throw new KlaviyoConfigError('Android openTracking must be a boolean value');
  }

  // Validate notificationColor if provided
  if (config.notificationColor) {
    const hexColorRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
    if (!hexColorRegex.test(config.notificationColor)) {
      throw new KlaviyoConfigError('Android notificationColor must be a valid hex color code (e.g., "#FF0000" or "#F00")');
    }
  }

  // Validate notificationIconFilePath if provided
  if (config.notificationIconFilePath) {
    if (typeof config.notificationIconFilePath !== 'string') {
      throw new KlaviyoConfigError('Android notificationIconFilePath must be a string');
    }
    
    // Always validate file existence
    if (!projectRoot) {
      throw new KlaviyoConfigError('projectRoot is required to validate notificationIconFilePath');
    }
    
    const fullPath = path.join(projectRoot, config.notificationIconFilePath);
    if (!fs.existsSync(fullPath)) {
      throw new KlaviyoConfigError(`Android notificationIconFilePath does not exist: ${config.notificationIconFilePath}`);
    }
  }
};

export const validateIosConfig = (config: KlaviyoPluginProps['ios']) => {
  if (!config) return;

  // Validate badgeAutoclearing
  if (config.badgeAutoclearing !== undefined && typeof config.badgeAutoclearing !== 'boolean') {
    throw new KlaviyoConfigError('iOS badgeAutoclearing must be a boolean');
  }

  // Validate codeSigningStyle
  if (config.codeSigningStyle && !['Automatic', 'Manual'].includes(config.codeSigningStyle)) {
    throw new KlaviyoConfigError('iOS codeSigningStyle must be either "Automatic" or "Manual"');
  }

  // Validate projectVersion
  if (config.projectVersion && !/^\d+$/.test(config.projectVersion)) {
    throw new KlaviyoConfigError('iOS projectVersion must be a string containing only digits');
  }

  // Validate marketingVersion
  if (config.marketingVersion && !/^\d+\.\d+(\.\d+)?$/.test(config.marketingVersion)) {
    throw new KlaviyoConfigError('iOS marketingVersion must be in format "X.Y" or "X.Y.Z"');
  }

  // Validate swiftVersion
  if (config.swiftVersion) {
    const allowedSwiftVersions = ['4.0', '4.2', '5.0', '6.0'];
    if (!allowedSwiftVersions.includes(String(config.swiftVersion))) {
      throw new KlaviyoConfigError(
        `iOS swiftVersion must be one of: ${allowedSwiftVersions.join(', ')}`
      );
    }
  }
};