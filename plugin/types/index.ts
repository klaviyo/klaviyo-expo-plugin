export interface KlaviyoPluginAndroidBaseProps {
  logLevel?: number;
  openTracking?: boolean;
  notificationIconFilePath?: string;
  notificationColor?: string;
}

export interface KlaviyoPluginIosBaseProps  {
  badgeAutoclearing: boolean;
  codeSigningStyle: string;
  projectVersion: string;
  marketingVersion: string;
  swiftVersion: string;
}

export interface KlaviyoPluginProps {
  android?: KlaviyoPluginAndroidBaseProps;
  ios?: KlaviyoPluginIosBaseProps;
}

export interface KlaviyoPluginAndroidProps extends KlaviyoPluginAndroidBaseProps {
  logLevel: number;
  openTracking: boolean;
  notificationIconFilePath: string | undefined;
  notificationColor: string | undefined;
}

export interface KlaviyoPluginIosProps extends KlaviyoPluginIosBaseProps {
  // Add any iOS-specific configuration here
}

export interface KlaviyoPluginPropsDefaultValues extends KlaviyoPluginProps {
  android: KlaviyoPluginAndroidProps;
  ios: KlaviyoPluginIosProps;
}

const DEFAULTS: KlaviyoPluginPropsDefaultValues = {
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

export const mergeProps = (props: KlaviyoPluginProps): KlaviyoPluginPropsDefaultValues => {
  return {
    android: { ...DEFAULTS.android, ...(props.android ?? {}) },
    ios: { ...DEFAULTS.ios, ...(props.ios ?? {}) }
  };
};