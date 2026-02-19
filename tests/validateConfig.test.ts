import { validateAndroidConfig, validateIosConfig } from '../plugin/support/validateConfig';

// Mock fs for notificationIconFilePath validation
jest.mock('fs', () => ({
  existsSync: jest.fn(() => true),
}));

jest.mock('path', () => ({
  join: jest.fn((...args) => args.join('/')),
}));

describe('validateConfig', () => {
  describe('validateAndroidConfig', () => {
    describe('geofencingEnabled', () => {
      it('accepts true', () => {
        expect(() => validateAndroidConfig({ geofencingEnabled: true })).not.toThrow();
      });

      it('accepts false', () => {
        expect(() => validateAndroidConfig({ geofencingEnabled: false })).not.toThrow();
      });

      it('accepts undefined (optional)', () => {
        expect(() => validateAndroidConfig({ geofencingEnabled: undefined })).not.toThrow();
      });

      it('accepts missing property', () => {
        expect(() => validateAndroidConfig({})).not.toThrow();
      });

      it('rejects non-boolean values', () => {
        expect(() => validateAndroidConfig({ geofencingEnabled: 'true' as any })).toThrow('Android geofencingEnabled must be a boolean');
      });

      it('rejects number values', () => {
        expect(() => validateAndroidConfig({ geofencingEnabled: 1 as any })).toThrow('Android geofencingEnabled must be a boolean');
      });
    });

    describe('formsEnabled', () => {
      it('accepts true', () => {
        expect(() => validateAndroidConfig({ formsEnabled: true })).not.toThrow();
      });

      it('accepts false', () => {
        expect(() => validateAndroidConfig({ formsEnabled: false })).not.toThrow();
      });

      it('accepts undefined (optional)', () => {
        expect(() => validateAndroidConfig({ formsEnabled: undefined })).not.toThrow();
      });

      it('accepts missing property', () => {
        expect(() => validateAndroidConfig({})).not.toThrow();
      });

      it('rejects non-boolean values', () => {
        expect(() => validateAndroidConfig({ formsEnabled: 'true' as any })).toThrow('Android formsEnabled must be a boolean');
      });

      it('rejects number values', () => {
        expect(() => validateAndroidConfig({ formsEnabled: 0 as any })).toThrow('Android formsEnabled must be a boolean');
      });
    });

    describe('existing validations still work', () => {
      it('rejects invalid logLevel', () => {
        expect(() => validateAndroidConfig({ logLevel: -1 })).toThrow('Android logLevel must be an integer between 0 and 6');
      });

      it('rejects non-boolean openTracking', () => {
        expect(() => validateAndroidConfig({ openTracking: 'yes' as any })).toThrow('Android openTracking must be a boolean value');
      });

      it('rejects invalid notificationColor', () => {
        expect(() => validateAndroidConfig({ notificationColor: 'red' })).toThrow('Android notificationColor must be a valid hex color code');
      });

      it('accepts null config', () => {
        expect(() => validateAndroidConfig(undefined)).not.toThrow();
      });
    });
  });

  describe('validateIosConfig', () => {
    describe('geofencingEnabled', () => {
      it('accepts true', () => {
        expect(() => validateIosConfig({ badgeAutoclearing: true, codeSigningStyle: 'Automatic', projectVersion: '1', marketingVersion: '1.0', geofencingEnabled: true })).not.toThrow();
      });

      it('rejects non-boolean values', () => {
        expect(() => validateIosConfig({ badgeAutoclearing: true, codeSigningStyle: 'Automatic', projectVersion: '1', marketingVersion: '1.0', geofencingEnabled: 'true' as any })).toThrow('iOS geofencingEnabled must be a boolean');
      });
    });
  });
});
