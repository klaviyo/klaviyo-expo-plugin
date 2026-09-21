export class KlaviyoLog {
  static log(str: string) {
    if (process.env.EXPO_DEBUG && process.env.EXPO_DEBUG === 'true') {
      console.log(`\tklaviyo-expo-plugin: ${str}`);
    }
  }

  /**
   * Always printed, unlike log(), which is EXPO_DEBUG-gated.
   * Use for conditions the developer must see at prebuild time but that
   * are not fatal. For example, running on an Expo SDK we do not support.
   */
  static warn(str: string) {
    console.warn(`\tklaviyo-expo-plugin: ${str}`);
  }

  static error(str: string) {
    console.error(`\tklaviyo-expo-plugin: ${str}`);
  }
}
