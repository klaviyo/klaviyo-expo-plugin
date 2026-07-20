export interface KlaviyoPluginAndroidBaseProps {
  logLevel?: number;
  openTracking?: boolean;
  notificationIconFilePath?: string;
  notificationColor?: string;
  geofencingEnabled?: boolean;
  formsEnabled?: boolean;
  /**
   * Controls automatic push token forwarding via the `com.klaviyo.push.automatic_push_token_forwarding`
   * AndroidManifest meta-data flag.
   *
   * When `false`, injects the flag with value `"false"` to explicitly opt out. Omitted (default)
   * means the key is not written — the native SDK default applies. Set to `false` only when the
   * native Android SDK defaults to ON (requires MAGE-937) and you need to opt out.
   */
  automaticPushTokenForwarding?: boolean;
  /**
   * Controls automatic push open tracking via the `com.klaviyo.push.automatic_push_open_tracking`
   * AndroidManifest meta-data flag.
   *
   * When `true`, injects the flag with value `"true"` to opt in. Omitted (default) means the key
   * is not written — the native SDK default (currently OFF) applies.
   */
  automaticPushOpenTracking?: boolean;
}

export interface KlaviyoPluginIosBaseProps  {
  badgeAutoclearing: boolean;
  codeSigningStyle: string;
  devTeam?: string;
  geofencingEnabled?: boolean;
  formsEnabled?: boolean;
  includeNotificationServiceExtension?: boolean;
  /**
   * Controls automatic push token forwarding via the `automatic_push_token_forwarding` Info.plist
   * key.
   *
   * When `true`, injects the key with value `true` to opt in. Omitted (default) means the key is
   * not written — native iOS defaults to OFF.
   */
  automaticPushTokenForwarding?: boolean;
  /**
   * Controls automatic push open tracking via the `automatic_push_open_tracking` Info.plist key.
   *
   * When `true`, injects the key with value `true` to opt in. Omitted (default) means the key is
   * not written — native iOS defaults to OFF.
   */
  automaticPushOpenTracking?: boolean;
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