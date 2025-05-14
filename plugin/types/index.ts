export interface KlaviyoPluginAndroidConfig {
  logLevel?: number;
  openTracking?: boolean;
}

export interface KlaviyoPluginIosConfig {
  // Add any iOS-specific configuration here
  teamId?: string;
  bundleIdentifier?: string;
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

export interface KlaviyoPluginProps extends KlaviyoPluginConfig {
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
    bundleIdentifier: "com.klaviyo.expoexample"
  }
};

export const mergeConfig = (config: KlaviyoPluginConfig): KlaviyoPluginProps => {
  return {
    android: { ...DEFAULTS.android, ...(config.android ?? {}) },
    ios: { ...DEFAULTS.ios, ...(config.ios ?? {}) }
  };
};