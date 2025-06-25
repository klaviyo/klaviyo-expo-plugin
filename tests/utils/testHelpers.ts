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

export const executePlugin = async <T>(
  plugin: ConfigPlugin<T>,
  config: any,
  props: T
): Promise<any> => {
  const pluginFunction = plugin(config, props);
  if (typeof pluginFunction === 'function') {
    return await (pluginFunction as (config: any) => Promise<any>)(config);
  }
  return pluginFunction;
};

/**
 * Helper function to test plugin functions with a common pattern
 */
export const testPluginFunction = <T>(
  plugin: ConfigPlugin<T>,
  configOptions: MockConfigOptions = {},
  propsOptions: MockPropsOptions = {},
  expectedProperty?: string
) => {
  const config = createMockConfig(configOptions);
  const props = createMockProps(propsOptions);
  
  const result = plugin(config, props);
  
  expect(result).toBeDefined();
  if (expectedProperty) {
    expect(result).toHaveProperty(expectedProperty);
  }
  
  return { config, props, result };
};

/**
 * Helper function for integration tests that have a different config structure
 */
export const testIntegrationPluginFunction = <T>(
  plugin: ConfigPlugin<T>,
  manifestContents: string,
  propsOptions: MockPropsOptions = {}
) => {
  const config: any = {
    name: 'test-app',
    slug: 'test-app',
    android: {
      manifest: {
        contents: manifestContents
      }
    }
  };
  
  const props = createMockProps(propsOptions);
  
  const result = plugin(config, props);
  
  expect(result).toBeDefined();
  expect(typeof result).toBe('function');
};

/**
 * Helper function for simple integration tests that just verify the plugin returns a function
 */
export const testSimpleIntegration = <T>(
  plugin: ConfigPlugin<T>,
  propsOptions: MockPropsOptions = {}
) => {
  const config: any = {
    name: 'test-app',
    slug: 'test-app',
    android: {
      manifest: {
        contents: `
          <manifest xmlns:android="http://schemas.android.com/apk/res/android">
            <application
              android:allowBackup="true"
              android:icon="@mipmap/ic_launcher"
              android:label="@string/app_name"
              android:roundIcon="@mipmap/ic_launcher_round"
              android:supportsRtl="true"
              android:theme="@style/AppTheme">
              <activity
                android:name=".MainActivity"
                android:exported="true"
                android:launchMode="singleTop"
                android:theme="@style/LaunchTheme"
                android:configChanges="orientation|keyboardHidden|keyboard|screenSize|smallestScreenSize|locale|layoutDirection|fontScale|screenLayout|density|uiMode"
                android:hardwareAccelerated="true"
                android:windowSoftInputMode="adjustResize">
                <meta-data
                  android:name="io.expo.client.arguments"
                  android:value="exp://192.168.1.100:8081" />
                <intent-filter>
                  <action android:name="android.intent.action.MAIN" />
                  <category android:name="android.intent.category.LAUNCHER" />
                </intent-filter>
              </activity>
            </application>
          </manifest>
        `
      }
    }
  };
  
  const props = createMockProps(propsOptions);
  
  const result = plugin(config, props);
  
  expect(result).toBeDefined();
  expect(typeof result).toBe('function');
}; import { ConfigPlugin } from '@expo/config-plugins';

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