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
  join: jest.fn((...args) => args.join('/')),
  resolve: jest.fn((...args) => args.join('/')),
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
  withDangerousMod: jest.fn().mockImplementation((config, [platform, action]) => ({
    ...config,
    mods: {
      ...(config.mods || {}),
      [platform]: action,
    },
  })),
  withAndroidManifest: jest.fn().mockImplementation((config, mod) => {
    return mod(config);
  }),
  withStringsXml: jest.fn().mockImplementation((config, mod) => (config: any, props: any) => config),
  withPlugins: jest.fn().mockImplementation((config, plugins) => {
    let result = config;
    for (const entry of plugins) {
      // Each entry can be [plugin, props] or just plugin
      if (Array.isArray(entry)) {
        const [plugin, props] = entry;
        result = plugin(result, props);
      } else {
        result = entry(result);
      }
    }
    return result;
  }),
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
  withMainActivity: jest.fn().mockImplementation((config, action) => {
    const modifiedConfig = {
      ...config,
      modResults: {
        language: 'java',
        contents: `package com.example.test;

import com.facebook.react.ReactActivity;

public class MainActivity extends ReactActivity {
  @Override
  protected String getMainComponentName() {
    return "main";
  }
}`
      }
    };
    const result = action(modifiedConfig);
    return result || modifiedConfig;
  }),
}));

// Mock @expo/config-plugins/build/utils/generateCode
jest.mock('@expo/config-plugins/build/utils/generateCode', () => ({
  mergeContents: jest.fn().mockImplementation((options) => {
    // Simple mock implementation that adds newSrc to src
    const { src, newSrc, anchor, offset, tag, comment } = options;

    // Check if the content already has this tag
    const tagRegex = new RegExp(`${comment}\\s*@generated begin ${tag}[\\s\\S]*?${comment}\\s*@generated end ${tag}`, 'g');
    if (tagRegex.test(src)) {
      // Content already exists, return as-is
      return { contents: src };
    }

    // Find the anchor in the source
    const lines = src.split('\n');
    const anchorIndex = lines.findIndex(line => anchor.test(line));

    if (anchorIndex === -1) {
      // If anchor not found, just append at the end
      const beforeTag = comment ? `${comment} @generated begin ${tag} - expo prebuild (DO NOT MODIFY) sync-${tag}` : '';
      const afterTag = comment ? `${comment} @generated end ${tag}` : '';
      return { contents: src + '\n' + beforeTag + '\n' + newSrc + '\n' + afterTag };
    }

    // Insert newSrc after the anchor line + offset
    const insertIndex = anchorIndex + (offset || 0);
    const beforeTag = comment ? `${comment} @generated begin ${tag} - expo prebuild (DO NOT MODIFY) sync-${tag}` : '';
    const afterTag = comment ? `${comment} @generated end ${tag}` : '';

    lines.splice(insertIndex + 1, 0, beforeTag, newSrc, afterTag);

    return { contents: lines.join('\n') };
  }),
}));

// Mock @expo/config-plugins/build/android/Paths
jest.mock('@expo/config-plugins/build/android/Paths', () => ({
  getMainActivityAsync: jest.fn(),
}));

// Mock the logger to avoid console output during tests
jest.mock('../plugin/support/logger', () => ({
  KlaviyoLog: {
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

// Mock the file manager
jest.mock('../plugin/support/fileManager', () => ({
  FileManager: {
    readFile: jest.fn(),
    writeFile: jest.fn(),
    copyFile: jest.fn(),
    dirExists: jest.fn(),
  },
}));

// Mock the plugin resolver
jest.mock('../plugin/support/pluginResolver', () => ({
  getPluginRoot: jest.fn().mockReturnValue('/mock/plugin/root'),
})); 