import { ConfigPlugin } from '@expo/config-plugins';

export interface MockConfigOptions {
  android?: {
    package?: string;
  };
  modRequest?: {
    platformProjectRoot?: string;
    projectRoot?: string;
  };
  modResults?: {
    manifest?: any;
    resources?: any;
  };
}

export interface MockPropsOptions {
  logLevel?: number;
  openTracking?: boolean;
  notificationIconFilePath?: string;
  notificationColor?: string;
}

export const createMockConfig = (options: MockConfigOptions = {}): any => ({
  android: {
    package: 'com.example.test',
    ...options.android,
  },
  modRequest: {
    platformProjectRoot: '/test/project/root',
    projectRoot: '/test/project',
    ...options.modRequest,
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
    ...options.modResults,
  },
});

export const createMockProps = (options: MockPropsOptions = {}): any => ({
  logLevel: 1,
  openTracking: true,
  notificationIconFilePath: './assets/icon.png',
  notificationColor: '#FF0000',
  ...options,
});

export const createMockMainActivityContent = (isKotlin: boolean = false): string => {
  if (isKotlin) {
    return `
package com.example.test

import com.facebook.react.ReactActivity

class MainActivity : ReactActivity() {
    override fun getMainComponentName(): String {
        return "main"
    }
}
    `;
  } else {
    return `
package com.example.test;

import com.facebook.react.ReactActivity;

public class MainActivity extends ReactActivity {
  @Override
  protected String getMainComponentName() {
    return "main";
  }
}
    `;
  }
};

export const createMockAndroidManifest = (overrides: any = {}): any => ({
  manifest: {
    application: [{
      $: { 'android:name': '.MainApplication' },
      'meta-data': [],
      service: [],
      ...overrides,
    }],
  },
});

export const createMockStringsXml = (overrides: any = {}): any => ({
  resources: {
    string: [],
    color: [],
    ...overrides,
  },
});

export const executePlugin = async <T>(
  plugin: ConfigPlugin<T>,
  config: any,
  props: T
): Promise<any> => {
  const pluginFunction = plugin(config, props);
  if (typeof pluginFunction === 'function') {
    return await pluginFunction(config);
  }
  return pluginFunction;
};

export const mockFileSystem = {
  existsSync: jest.fn(),
  readFileSync: jest.fn(),
  writeFileSync: jest.fn(),
  mkdirSync: jest.fn(),
  copyFileSync: jest.fn(),
  unlinkSync: jest.fn(),
  rmSync: jest.fn(),
};

export const mockPath = {
  join: jest.fn((...args: string[]) => args.join('/')),
  resolve: jest.fn((...args: string[]) => args.join('/')),
};

export const mockGlob = {
  sync: jest.fn(),
};

export const mockXml2js = {
  parseString: jest.fn(),
  Builder: jest.fn().mockImplementation(() => ({
    buildObject: jest.fn().mockReturnValue('<xml>test</xml>'),
  })),
}; 