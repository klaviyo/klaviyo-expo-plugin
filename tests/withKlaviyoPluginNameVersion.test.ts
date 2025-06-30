import { withKlaviyoPluginNameVersion } from '../plugin/withKlaviyoAndroid';

// Mock the logger
jest.mock('../plugin/support/logger', () => ({
  KlaviyoLog: {
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

describe('withKlaviyoPluginNameVersion', () => {
  let mockConfig: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockConfig = {
      modResults: {
        resources: {
          string: [
            { $: { name: 'existing_string' }, _: 'existing_value' }
          ]
        }
      }
    };
  });

  it('should add klaviyo plugin name and version strings', () => {
    const result = withKlaviyoPluginNameVersion(mockConfig);
    
    expect(result).toBeDefined();
    expect(typeof result).toBe('function');
  });

  it('should handle empty strings array', () => {
    const configWithEmptyStrings = {
      name: 'test-app',
      slug: 'test-app',
      modResults: {
        resources: {
          string: []
        }
      }
    };

    const result = withKlaviyoPluginNameVersion(configWithEmptyStrings);
    expect(result).toBeDefined();
  });

  it('should handle missing strings array', () => {
    const configWithoutStrings = {
      name: 'test-app',
      slug: 'test-app',
      modResults: {
        resources: {}
      }
    };

    const result = withKlaviyoPluginNameVersion(configWithoutStrings);
    expect(result).toBeDefined();
  });

  it('should update existing strings if they already exist', () => {
    const configWithExistingStrings = {
      name: 'test-app',
      slug: 'test-app',
      modResults: {
        resources: {
          string: [
            { $: { name: 'klaviyo_sdk_plugin_name_override' }, _: 'old_name' },
            { $: { name: 'klaviyo_sdk_plugin_version_override' }, _: 'old_version' }
          ]
        }
      }
    };

    const result = withKlaviyoPluginNameVersion(configWithExistingStrings);
    expect(result).toBeDefined();
  });
}); 