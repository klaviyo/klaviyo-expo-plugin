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
