// Global test setup for Klaviyo Expo Plugin tests

// Mock fs module
jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  existsSync: jest.fn(),
  readFileSync: jest.fn(),
  writeFileSync: jest.fn(),
  mkdirSync: jest.fn(),
  copyFileSync: jest.fn(),
  unlinkSync: jest.fn(),
  rmSync: jest.fn(),
}));

// Mock path module
jest.mock('path', () => ({
  ...jest.requireActual('path'),
  join: jest.fn(),
  resolve: jest.fn(),
}));

// Mock glob module
jest.mock('glob', () => ({
  sync: jest.fn(),
}));

// Mock xml2js module
jest.mock('xml2js', () => ({
  parseString: jest.fn(),
  Builder: jest.fn().mockImplementation(() => ({
    buildObject: jest.fn().mockReturnValue('<xml>test</xml>'),
  })),
}));

// Mock @expo/config-plugins
jest.mock('@expo/config-plugins', () => ({
  withDangerousMod: jest.fn().mockImplementation((config, [platform, action]) => {
    // Add a mods property with the platform mod
    return {
      ...config,
      mods: {
        ...(config.mods || {}),
        [platform]: action,
      },
    };
  }),
  withAndroidManifest: jest.fn().mockImplementation((config, mod) => {
    // Return a function that takes config and props
    return (config: any, props: any) => {
      // Return the config as-is for testing
      return config;
    };
  }),
  withStringsXml: jest.fn().mockImplementation((config, mod) => {
    // Return a function that takes config and props
    return (config: any, props: any) => {
      // Return the config as-is for testing
      return config;
    };
  }),
  withPlugins: jest.fn().mockImplementation((config, plugins) => {
    // Return a function that takes config and props
    return (config: any, props: any) => {
      // Return the config as-is for testing
      return config;
    };
  }),
}));

// Mock @expo/config-plugins/build/utils/generateCode
jest.mock('@expo/config-plugins/build/utils/generateCode', () => ({
  mergeContents: jest.fn(),
}));

// Mock @expo/config-plugins/build/android/Paths
jest.mock('@expo/config-plugins/build/android/Paths', () => ({
  getMainActivityAsync: jest.fn(),
})); // Global test setup for Klaviyo Expo Plugin tests

// Mock fs module
jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  existsSync: jest.fn(),
  readFileSync: jest.fn(),
  writeFileSync: jest.fn(),
  mkdirSync: jest.fn(),
  copyFileSync: jest.fn(),
  unlinkSync: jest.fn(),
  rmSync: jest.fn(),
}));

// Mock path module
jest.mock('path', () => ({
  ...jest.requireActual('path'),
  join: jest.fn(),
  resolve: jest.fn(),
}));

// Mock glob module
jest.mock('glob', () => ({
  sync: jest.fn(),
}));

// Mock xml2js module
jest.mock('xml2js', () => ({
  parseString: jest.fn(),
  Builder: jest.fn().mockImplementation(() => ({
    buildObject: jest.fn().mockReturnValue('<xml>test</xml>'),
  })),
}));

// Mock @expo/config-plugins
jest.mock('@expo/config-plugins', () => ({
  withDangerousMod: jest.fn().mockImplementation((config, mod) => config),
  withAndroidManifest: jest.fn().mockImplementation((config, mod) => config),
  withStringsXml: jest.fn().mockImplementation((config, mod) => config),
  withInfoPlist: jest.fn().mockImplementation((config, mod) => {
    const modifiedConfig = { ...config };
    const result = mod(modifiedConfig);
    return result || modifiedConfig;
  }),
  withEntitlementsPlist: jest.fn().mockImplementation((config, mod) => {
    const modifiedConfig = { ...config };
    const result = mod(modifiedConfig);
    return result || modifiedConfig;
  }),
  withXcodeProject: jest.fn().mockImplementation((config, mod) => config),
  withPlugins: jest.fn().mockImplementation((config, plugins) => {
    let result = { ...config };
    for (const [plugin, pluginProps] of plugins) {
      result = plugin(result, pluginProps);
    }
    return result;
  }),
}));

// Mock @expo/config-plugins/build/utils/generateCode
jest.mock('@expo/config-plugins/build/utils/generateCode', () => ({
  mergeContents: jest.fn(),
}));

// Mock @expo/config-plugins/build/android/Paths
jest.mock('@expo/config-plugins/build/android/Paths', () => ({
  getMainActivityAsync: jest.fn(),
})); // Global test setup for Klaviyo Expo Plugin tests

// Mock fs module
jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  existsSync: jest.fn(),
  readFileSync: jest.fn(),
  writeFileSync: jest.fn(),
  mkdirSync: jest.fn(),
  copyFileSync: jest.fn(),
  unlinkSync: jest.fn(),
  rmSync: jest.fn(),
}));

// Mock path module
jest.mock('path', () => ({
  ...jest.requireActual('path'),
  join: jest.fn(),
  resolve: jest.fn(),
}));

// Mock glob module
jest.mock('glob', () => ({
  sync: jest.fn(),
}));

// Mock xml2js module
jest.mock('xml2js', () => ({
  parseString: jest.fn(),
  Builder: jest.fn().mockImplementation(() => ({
    buildObject: jest.fn().mockReturnValue('<xml>test</xml>'),
  })),
}));

// Mock @expo/config-plugins
jest.mock('@expo/config-plugins', () => ({
  withDangerousMod: jest.fn().mockImplementation((config, mod) => config),
  withAndroidManifest: jest.fn().mockImplementation((config, mod) => config),
  withStringsXml: jest.fn().mockImplementation((config, mod) => config),
  withInfoPlist: jest.fn().mockImplementation((config, mod) => {
    const modifiedConfig = { ...config };
    const result = mod(modifiedConfig);
    return result || modifiedConfig;
  }),
  withEntitlementsPlist: jest.fn().mockImplementation((config, mod) => {
    const modifiedConfig = { ...config };
    const result = mod(modifiedConfig);
    return result || modifiedConfig;
  }),
  withXcodeProject: jest.fn().mockImplementation((config, mod) => config),
  withPlugins: jest.fn().mockImplementation((config, plugins) => {
    let result = { ...config };
    for (const [plugin, pluginProps] of plugins) {
      result = plugin(result, pluginProps);
    }
    return result;
  }),
}));

// Mock @expo/config-plugins/build/utils/generateCode
jest.mock('@expo/config-plugins/build/utils/generateCode', () => ({
  mergeContents: jest.fn(),
}));

// Mock @expo/config-plugins/build/android/Paths
jest.mock('@expo/config-plugins/build/android/Paths', () => ({
  getMainActivityAsync: jest.fn(),
}));

// Global test utilities
global.testUtils = {
  createMockConfig: (overrides = {}) => ({
    android: {
      package: 'com.example.test',
    },
    modRequest: {
      platformProjectRoot: '/test/project/root',
      projectRoot: '/test/project',
    },
    modResults: {
      manifest: {
        application: [{
          $: { 'android:name': '.MainApplication' },
          'meta-data': [],
          service: [],
        }],
      },
      resources: {
        string: [],
        color: [],
      },
    },
    ...overrides,
  }),
  
  createMockProps: (overrides = {}) => ({
    logLevel: 1,
    openTracking: true,
    notificationIconFilePath: './assets/icon.png',
    notificationColor: '#FF0000',
    ...overrides,
  }),

  createMockIosConfig: (overrides = {}) => ({
    name: 'TestApp',
    ios: {
      bundleIdentifier: 'com.test.app',
    },
    modRequest: {
      projectName: 'TestApp',
      platformProjectRoot: '/test/project/ios',
      projectRoot: '/test/project',
    },
    modResults: {
      CFBundleDisplayName: 'TestApp',
      CFBundleIdentifier: 'com.test.app',
      CFBundleVersion: '1',
      CFBundleShortVersionString: '1.0',
    },
    ...overrides,
  }),

  createMockIosProps: (overrides = {}) => ({
    badgeAutoclearing: true,
    codeSigningStyle: 'Automatic',
    projectVersion: '1',
    marketingVersion: '1.0',
    swiftVersion: '5.0',
    devTeam: 'XXXXXXXXXX',
    ...overrides,
  }),
}; 