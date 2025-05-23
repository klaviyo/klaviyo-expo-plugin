export interface KlaviyoPluginAndroidConfig {
  logLevel?: number;
  openTracking?: boolean;
}

export interface KlaviyoPluginIosConfig {
  // Add any iOS-specific configuration here
  badgeAutoclearing: boolean;
}

export interface KlaviyoPluginConfig {
  android?: KlaviyoPluginAndroidConfig;
  ios?: KlaviyoPluginIosConfig;
}

interface KlaviyoPluginAndroidProps extends KlaviyoPluginAndroidConfig {
  logLevel: number;
  openTracking: boolean;
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
    openTracking: true
  },
  ios: {
    // Add any iOS-specific defaults here
    badgeAutoclearing: true
  }
};

export const mergeConfig = (config: KlaviyoPluginConfig): KlaviyoPluginProps => {
  return {
    android: { ...DEFAULTS.android, ...(config.android ?? {}) },
    ios: { ...DEFAULTS.ios, ...(config.ios ?? {}) }
  };
};