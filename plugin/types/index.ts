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
  devTeam?: string;
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
  badgeAutoclearing: boolean;
  codeSigningStyle: string;
  projectVersion: string;
  marketingVersion: string;
  swiftVersion: string;
  devTeam: string | undefined;
}

export interface KlaviyoPluginPropsDefaultValues extends KlaviyoPluginProps {
  android: KlaviyoPluginAndroidProps;
  ios: KlaviyoPluginIosProps;
}

const ANDROID_DEFAULTS: KlaviyoPluginAndroidProps = {
  logLevel: 1,
  openTracking: true,
  notificationIconFilePath: undefined,
  notificationColor: undefined
};

const IOS_DEFAULTS: KlaviyoPluginIosProps = {
  badgeAutoclearing: true,
  codeSigningStyle: "Automatic",
  projectVersion: "1",
  marketingVersion: "1.0",
  swiftVersion: "5.0",
  devTeam: undefined
};

export const mergeAndroidProps = (props?: KlaviyoPluginAndroidBaseProps): KlaviyoPluginAndroidProps => {
  return { ...ANDROID_DEFAULTS, ...(props ?? {}) };
};

export const mergeIosProps = (props?: KlaviyoPluginIosBaseProps): KlaviyoPluginIosProps => {
  return { ...IOS_DEFAULTS, ...(props ?? {}) };
};

export const mergeProps = (props: KlaviyoPluginProps): KlaviyoPluginPropsDefaultValues => {
  return {
    android: mergeAndroidProps(props.android),
    ios: mergeIosProps(props.ios)
  };
};