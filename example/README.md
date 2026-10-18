# Klaviyo Expo Plugin Example

This is a minimal example app that demonstrates how to use the Klaviyo Expo Plugin from the parent repository. It serves as a reference implementation for integrating the plugin into an Expo project.

## Purpose

This example app exists to:

- Demonstrate the plugin's configuration and setup process
- Show how the plugin integrates with Expo's prebuild system
- Provide a simple test environment for plugin development

## Getting Started

1. Install dependencies:

```bash
npm install
```

2. Start the development server:

```bash
npx expo start --dev-client
```

3. Run on Android:

```bash
npx expo run:android
```

4. Run on iOS:

```bash
npx expo run:ios
```

## Plugin Integration

The plugin is integrated through:

- `package.json`: References the parent plugin via `"klaviyo-expo-plugin": "file:../"`
- `app.json`: Includes the plugin in the Expo configuration
- `_layout.tsx`: Contains the minimal app implementation

## Project Structure

```
example/
├── app/                 # App source code
│   └── _layout.tsx     # Main app component
├── assets/             # App assets
├── app.json           # Expo configuration
└── package.json       # Dependencies and scripts
```

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
    npx expo start
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

You can also run the following to create a new android / ios build (useful after plugin configuration)

```bash
npm run clean-androoid
npm run clean-ios
```

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.

## Personalized forms with a pasted JWT

This development-only demo uses the React Native SDK's public
[`registerAuthTokenProvider` API](https://github.com/klaviyo/klaviyo-react-native-sdk#personalized-forms-authentication).
It requires SDK 2.6.0 (native Android 4.6.0 and iOS 5.5.0) and personalized forms
enablement for your Klaviyo account. No JWT option or bridge is needed in the Expo plugin.
The example temporarily depends on the named `feat/jwts-for-personalized-forms`
SDK branch until 2.6.0 is published; replace that dependency with published `2.6.0`
and regenerate the lockfile before merging this adoption change.

1. Install the parent plugin dependencies and run `npm run build` from the repository root.
   Install the example dependencies, then create a new development build for your platform.
   Expo Go cannot load the native Klaviyo SDK. Rebuild after changing SDK versions.
2. In Klaviyo, enable personalized forms for the account and publish a mobile in-app
   form with personalized content, targeting the test profile and the **Added to Cart**
   event. Check its targeting, timing, and display-frequency settings before each run.
3. On **Profile**, initialize with that account's public API key. Enter the email
   corresponding to the JWT's `email` claim and tap **Save Profile**.
4. Obtain a JWT from your trusted backend, signed for that account with valid `iat`
   and `exp` claims. Paste the raw token (without a `Bearer` prefix) into **Paste raw JWT**,
   tap **Set**, then enable **Enable JWT provider**. The field clears after assignment;
   the assigned token remains in memory only and is never logged or persisted.
5. On **Forms**, tap **Register for In-App Forms**, then **Track Added to Cart**.
   Confirm the form displays the expected profile's personalized content.

The existing registration flow also works with the provider disabled. To compare
unauthenticated behavior, dismiss any open form, disable the provider on **Profile**,
and trigger the form again. Expect the account's configured unauthenticated behavior;
an open form retains its existing token until expiry. Disabling the provider is not logout.

To check expiry, assign an expired JWT with **Set**, leave the provider enabled, and
trigger the form again after dismissing any open form. Confirm personalized content
is not served using that expired token. Form availability and fallback behavior depend
on account and form configuration; this demo does not validate JWTs locally.

**Set** replaces an enabled provider, invalidating its cached token so a replacement
JWT can be tested. **Reset Profile** unregisters the provider, clears the assigned and
pasted tokens, and calls `resetProfile()` to log out. Saving a profile or initializing
an account clears the JWT and unregisters the provider without resetting the SDK profile;
save the new identity before assigning its JWT.
Dismiss an open form before changing users, since its token remains valid until expiry.

This is a manual testing tool, not a production auth integration. It returns the same
assigned JWT until you replace it, so it cannot refresh an expired token. Production
providers should fetch a fresh JWT for the current signed-in user on each invocation,
keep signing credentials on the server, and follow the SDK's provider requirements.
