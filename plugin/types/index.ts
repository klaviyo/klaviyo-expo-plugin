export interface KlaviyoPluginAndroidConfig {
  logLevel?: number;
  openTracking?: boolean;
  notificationIconFilePath?: string;
  notificationColor?: string;
}

export interface KlaviyoPluginIosConfig {
  badgeAutoclearing: boolean;
  codeSigningStyle: string;
  projectVersion: string;
  marketingVersion: string;
  swiftVersion: string;
}

export interface KlaviyoPluginConfig {
  android?: KlaviyoPluginAndroidConfig;
  ios?: KlaviyoPluginIosConfig;
}

interface KlaviyoPluginAndroidProps extends KlaviyoPluginAndroidConfig {
  logLevel: number;
  openTracking: boolean;
  notificationIconFilePath: string | undefined;
  notificationColor: string | undefined;
}

interface KlaviyoPluginIosProps extends KlaviyoPluginIosConfig {
  // Add any iOS-specific configuration here
}

interface KlaviyoPluginProps extends KlaviyoPluginConfig {
  android: KlaviyoPluginAndroidProps;
  ios: KlaviyoPluginIosProps;
}

const DEFAULTS: KlaviyoPluginProps = {
  android: {
    logLevel: 1,
    openTracking: true,
    notificationIconFilePath: undefined,
    notificationColor: undefined
  },
  ios: {
    badgeAutoclearing: true,
    codeSigningStyle: "Automatic",
    projectVersion: "1",
    marketingVersion: "1.0",
    swiftVersion: "5.0"
  }
};

export const mergeConfig = (config: KlaviyoPluginConfig): KlaviyoPluginProps => {
  return {
    android: { ...DEFAULTS.android, ...(config.android ?? {}) },
    ios: { ...DEFAULTS.ios, ...(config.ios ?? {}) }
  };
};