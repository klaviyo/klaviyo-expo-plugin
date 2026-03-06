import { withLocationGradleProperties, withFormsGradleProperties } from '../plugin/withKlaviyoAndroid';
import { createMockProps } from './utils/testHelpers';
import { KlaviyoPluginAndroidProps } from '../plugin/types';

// Mock xml2js module
jest.mock('xml2js', () => ({
  parseStringPromise: jest.fn().mockResolvedValue({
    resources: { color: [] }
  }),
  Builder: jest.fn().mockImplementation(() => ({
    buildObject: jest.fn().mockReturnValue('<xml>test</xml>')
  }))
}));

// Mock file system operations
jest.mock('fs', () => ({
  existsSync: jest.fn(() => true),
  readFileSync: jest.fn(() => ''),
  writeFileSync: jest.fn(),
  mkdirSync: jest.fn(),
  copyFileSync: jest.fn(),
  unlinkSync: jest.fn(),
  rmSync: jest.fn()
}));

jest.mock('glob', () => ({
  sync: jest.fn(() => [])
}));

jest.mock('@expo/config-plugins/build/android/Paths', () => ({
  getMainActivityAsync: jest.fn(() => Promise.resolve('/test/path/MainActivity.java'))
}));

jest.mock('path', () => ({
  resolve: jest.fn((...args) => args.join('/')),
  join: jest.fn((...args) => args.join('/'))
}));

describe('Gradle Properties Plugins', () => {
  describe('withLocationGradleProperties', () => {
    it('sets klaviyoIncludeLocation to false when geofencingEnabled is false', () => {
      const config: any = { modResults: [] };
      const props = createMockProps({ geofencingEnabled: false });

      const result = withLocationGradleProperties(config, props);

      expect(result.modResults).toContainEqual({
        type: 'property',
        key: 'klaviyoIncludeLocation',
        value: 'false'
      });
    });

    it('sets klaviyoIncludeLocation to true when geofencingEnabled is true', () => {
      const config: any = { modResults: [] };
      const props = createMockProps({ geofencingEnabled: true });

      const result = withLocationGradleProperties(config, props);

      expect(result.modResults).toContainEqual({
        type: 'property',
        key: 'klaviyoIncludeLocation',
        value: 'true'
      });
    });

    it('defaults to false when geofencingEnabled is undefined', () => {
      const config: any = { modResults: [] };
      const props = { logLevel: 1, openTracking: true, notificationIconFilePath: undefined, notificationColor: undefined, formsEnabled: true } as KlaviyoPluginAndroidProps;

      const result = withLocationGradleProperties(config, props);

      expect(result.modResults).toContainEqual({
        type: 'property',
        key: 'klaviyoIncludeLocation',
        value: 'false'
      });
    });

    it('removes existing klaviyoIncludeLocation property before adding new one', () => {
      const config: any = {
        modResults: [
          { type: 'property', key: 'klaviyoIncludeLocation', value: 'true' },
          { type: 'property', key: 'otherProperty', value: 'keep' }
        ]
      };
      const props = createMockProps({ geofencingEnabled: false });

      const result = withLocationGradleProperties(config, props);

      const locationProps = result.modResults.filter(
        (item: any) => item.key === 'klaviyoIncludeLocation'
      );
      expect(locationProps).toHaveLength(1);
      expect(locationProps[0].value).toBe('false');

      // Other properties should be preserved
      expect(result.modResults).toContainEqual({
        type: 'property',
        key: 'otherProperty',
        value: 'keep'
      });
    });

    it('removes old klaviyoIncludeLocationPermissions property name', () => {
      const config: any = {
        modResults: [
          { type: 'property', key: 'klaviyoIncludeLocationPermissions', value: 'true' }
        ]
      };
      const props = createMockProps({ geofencingEnabled: true });

      const result = withLocationGradleProperties(config, props);

      const oldProps = result.modResults.filter(
        (item: any) => item.key === 'klaviyoIncludeLocationPermissions'
      );
      expect(oldProps).toHaveLength(0);

      expect(result.modResults).toContainEqual({
        type: 'property',
        key: 'klaviyoIncludeLocation',
        value: 'true'
      });
    });
  });

  describe('withFormsGradleProperties', () => {
    it('sets klaviyoIncludeForms to true when formsEnabled is true', () => {
      const config: any = { modResults: [] };
      const props = createMockProps({ formsEnabled: true });

      const result = withFormsGradleProperties(config, props);

      expect(result.modResults).toContainEqual({
        type: 'property',
        key: 'klaviyoIncludeForms',
        value: 'true'
      });
    });

    it('sets klaviyoIncludeForms to false when formsEnabled is false', () => {
      const config: any = { modResults: [] };
      const props = createMockProps({ formsEnabled: false });

      const result = withFormsGradleProperties(config, props);

      expect(result.modResults).toContainEqual({
        type: 'property',
        key: 'klaviyoIncludeForms',
        value: 'false'
      });
    });

    it('defaults to true when formsEnabled is undefined', () => {
      const config: any = { modResults: [] };
      const props = { logLevel: 1, openTracking: true, notificationIconFilePath: undefined, notificationColor: undefined, geofencingEnabled: false } as KlaviyoPluginAndroidProps;

      const result = withFormsGradleProperties(config, props);

      expect(result.modResults).toContainEqual({
        type: 'property',
        key: 'klaviyoIncludeForms',
        value: 'true'
      });
    });

    it('removes existing klaviyoIncludeForms property before adding new one', () => {
      const config: any = {
        modResults: [
          { type: 'property', key: 'klaviyoIncludeForms', value: 'false' },
          { type: 'property', key: 'otherProperty', value: 'keep' }
        ]
      };
      const props = createMockProps({ formsEnabled: true });

      const result = withFormsGradleProperties(config, props);

      const formsProps = result.modResults.filter(
        (item: any) => item.key === 'klaviyoIncludeForms'
      );
      expect(formsProps).toHaveLength(1);
      expect(formsProps[0].value).toBe('true');

      // Other properties should be preserved
      expect(result.modResults).toContainEqual({
        type: 'property',
        key: 'otherProperty',
        value: 'keep'
      });
    });
  });

  describe('default values', () => {
    it('geofencing defaults to off (false)', () => {
      const config: any = { modResults: [] };
      const props = createMockProps();

      const result = withLocationGradleProperties(config, props);

      expect(result.modResults).toContainEqual({
        type: 'property',
        key: 'klaviyoIncludeLocation',
        value: 'false'
      });
    });

    it('forms defaults to on (true)', () => {
      const config: any = { modResults: [] };
      const props = createMockProps();

      const result = withFormsGradleProperties(config, props);

      expect(result.modResults).toContainEqual({
        type: 'property',
        key: 'klaviyoIncludeForms',
        value: 'true'
      });
    });
  });
});
