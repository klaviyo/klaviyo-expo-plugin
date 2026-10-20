import { KlaviyoLog } from './logger';

/** Lowest Expo SDK this plugin officially supports. Matches Expo's own support window. */
const MIN_SUPPORTED_SDK_VERSION = 54;

/**
 * Lowest Expo SDK that can produce a working Android build. Below this, klaviyo-android-sdk
 * needs androidx.core 1.16.0 (compileSdk 35), and Expo 50/51 ship compileSdk 34.
 */
const MIN_BUILDABLE_ANDROID_SDK_VERSION = 52;

/**
 * Highest Expo SDK whose autolinking does not understand the `apple` platform key. At or
 * below this, ExpoKlaviyo is dropped silently: the build succeeds, push never works.
 */
const LAST_SDK_WITHOUT_AUTOLINKING = 49;

/** Expo resolves the config several times per command, so warn once per version. */
const warnedVersions = new Set<string>();

/**
 * Test-only. Clears the once-per-process dedupe state so each case starts clean.
 */
export function resetSdkWarningState(): void {
  warnedVersions.clear();
}

/**
 * Warn when the host app is on an Expo SDK this plugin does not support. Never throws.
 *
 * Runs on every config resolution. That includes `expo prebuild`, `expo start`,
 * `expo config` and EAS fingerprinting, so it must stay cheap and free of side effects.
 */
export function warnOnUnsupportedSdk(sdkVersion: string | undefined): void {
  // A bare (non-Expo-managed) project has no sdkVersion at all; say that explicitly
  // rather than relying on String(undefined) parsing to NaN.
  if (sdkVersion == null) {
    return;
  }

  // Still guard NaN: sdkVersion can be a non-numeric sentinel such as 'UNVERSIONED'.
  const major = parseInt(sdkVersion.split('.')[0], 10);
  if (Number.isNaN(major) || major >= MIN_SUPPORTED_SDK_VERSION) {
    return;
  }

  if (warnedVersions.has(sdkVersion)) {
    return;
  }
  warnedVersions.add(sdkVersion);

  let detail: string;
  if (major <= LAST_SDK_WITHOUT_AUTOLINKING) {
    detail =
      `On SDK ${LAST_SDK_WITHOUT_AUTOLINKING} and below, Expo autolinking cannot load this plugin's ` +
      'native iOS module, so push notification handling will NOT work even though the build succeeds.';
  } else if (major < MIN_BUILDABLE_ANDROID_SDK_VERSION) {
    detail = 'The Android build is expected to fail.';
  } else {
    detail = 'This SDK built successfully in our testing, but is outside the supported range.';
  }

  KlaviyoLog.warn(
    `Expo SDK ${sdkVersion} is not supported (minimum is ${MIN_SUPPORTED_SDK_VERSION}). ${detail} ` +
      `Upgrade to Expo SDK ${MIN_SUPPORTED_SDK_VERSION} or newer.`
  );
}
