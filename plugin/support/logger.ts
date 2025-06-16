export class KlaviyoLog {
  static log(str: string) {
    if (process.env.EXPO_DEBUG) {
      console.log(`\tklaviyo-expo-plugin: ${str}`);
    }
  }

  static error(str: string) {
    console.error(`\tklaviyo-expo-plugin: ${str}`);
  }
}
