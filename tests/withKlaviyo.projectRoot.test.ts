import type { ExpoConfig } from '@expo/config-types';

// The root plugin's only observable use of the resolved project root is the second
// argument it hands to validateAndroidConfig, so assert on that.
jest.mock('../plugin/support/validateConfig', () => ({
  validateAndroidConfig: jest.fn(),
  validateIosConfig: jest.fn(),
}));

// Keep the platform mods inert: this suite is about project-root resolution only.
jest.mock('../plugin/withKlaviyoIos', () => ({
  __esModule: true,
  default: jest.fn((config) => config),
}));
jest.mock('../plugin/withKlaviyoAndroid', () => ({
  __esModule: true,
  default: jest.fn((config) => config),
}));

import withKlaviyo from '../plugin/withKlaviyo';
import { validateAndroidConfig } from '../plugin/support/validateConfig';

const projectRootArg = () => (validateAndroidConfig as jest.Mock).mock.calls[0][1];

const baseConfig = (internal?: Record<string, unknown>): ExpoConfig =>
  ({
    name: 'test',
    slug: 'test',
    sdkVersion: '57.0.0',
    ...(internal ? { _internal: internal } : {}),
  }) as ExpoConfig;

describe('withKlaviyo project root resolution', () => {
  beforeEach(() => jest.clearAllMocks());

  it('prefers _internal.projectRoot over cwd()', () => {
    withKlaviyo(baseConfig({ projectRoot: '/from/expo/config' }), {
      android: { notificationColor: '#FF0000' },
    } as never);

    expect(projectRootArg()).toBe('/from/expo/config');
  });

  it('does not fall back to cwd() when Expo supplied a project root', () => {
    withKlaviyo(baseConfig({ projectRoot: '/from/expo/config' }), {
      android: { notificationColor: '#FF0000' },
    } as never);

    expect(projectRootArg()).not.toBe(process.cwd());
  });

  // This is the documented trigger for the ?? fallback: a caller that builds an
  // ExpoConfig by hand and therefore has no _internal.
  it('falls back to cwd() when _internal is absent', () => {
    withKlaviyo(baseConfig(), { android: { notificationColor: '#FF0000' } } as never);

    expect(projectRootArg()).toBe(process.cwd());
  });

  it('falls back to cwd() when _internal exists but carries no projectRoot', () => {
    withKlaviyo(baseConfig({ pluginHistory: {} }), {
      android: { notificationColor: '#FF0000' },
    } as never);

    expect(projectRootArg()).toBe(process.cwd());
  });
});
