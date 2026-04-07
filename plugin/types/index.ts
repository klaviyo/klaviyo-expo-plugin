export interface KlaviyoPluginAndroidBaseProps {
  logLevel?: number;
  openTracking?: boolean;
  notificationIconFilePath?: string;
  notificationColor?: string;
  geofencingEnabled?: boolean;
  formsEnabled?: boolean;
}

export interface KlaviyoPluginIosBaseProps  {
  badgeAutoclearing: boolean;
  codeSigningStyle: string;
  devTeam?: string;
  geofencingEnabled?: boolean;
  formsEnabled?: boolean;
  includeNotificationServiceExtension?: boolean;
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
  geofencingEnabled: boolean;
  formsEnabled: boolean;
}

export interface KlaviyoPluginIosProps extends KlaviyoPluginIosBaseProps {
  badgeAutoclearing: boolean;
  codeSigningStyle: string;
  devTeam: string | undefined;
  geofencingEnabled?: boolean;
  formsEnabled: boolean;
  includeNotificationServiceExtension: boolean;
}

export interface KlaviyoPluginPropsDefaultValues extends KlaviyoPluginProps {
  android: KlaviyoPluginAndroidProps;
  ios: KlaviyoPluginIosProps;
}

const ANDROID_DEFAULTS: KlaviyoPluginAndroidProps = {
  logLevel: 1,
  openTracking: true,
  notificationIconFilePath: undefined,
  notificationColor: undefined,
  geofencingEnabled: false,
  formsEnabled: true
};

const IOS_DEFAULTS: KlaviyoPluginIosProps = {
  badgeAutoclearing: true,
  codeSigningStyle: "Automatic",
  devTeam: undefined,
  formsEnabled: true,
  includeNotificationServiceExtension: true
};

export const mergeAndroidProps = (props?: KlaviyoPluginAndroidBaseProps): KlaviyoPluginAndroidProps => {
  return { ...ANDROID_DEFAULTS, ...(props ?? {}) };
};

export const mergeIosProps = (props?: KlaviyoPluginIosBaseProps): KlaviyoPluginIosProps => {
  return { ...IOS_DEFAULTS, ...(props ?? {}) };
};

export const mergeProps = (props?: KlaviyoPluginProps): KlaviyoPluginPropsDefaultValues => {
  return {
    android: mergeAndroidProps(props?.android),
    ios: mergeIosProps(props?.ios)
  };
};

// Android manifest and resources types for plugin/withKlaviyoAndroid.ts
export interface AndroidMetaData {
  $: { 'android:name': string; 'android:value'?: string; 'android:resource'?: string };
}

export interface AndroidService {
  $: { 'android:name': string; 'android:exported'?: string };
  'intent-filter'?: any[];
}

export interface AndroidApplication {
  $: { 'android:name': string };
  'meta-data'?: AndroidMetaData[];
  service?: AndroidService[];
}

export interface AndroidManifest {
  application: AndroidApplication[];
}

export interface AndroidResources {
  string: any[];
  color: any[];
}

export interface KlaviyoAndroidModResults {
  manifest?: AndroidManifest;
  resources?: AndroidResources;
}