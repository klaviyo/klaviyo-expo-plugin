import { warnOnUnsupportedSdk, resetSdkWarningState } from '../plugin/support/sdkSupport';
import { KlaviyoLog } from '../plugin/support/logger';

const warnMessage = () => (KlaviyoLog.warn as jest.Mock).mock.calls[0][0];

describe('warnOnUnsupportedSdk', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // The warning dedupes per version per process; clear it so cases do not mask each other.
    resetSdkWarningState();
  });

  // 54 is the documented minimum; undefined is a bare workflow; the rest are unparseable.
  it.each(['54.0.37', '57.0.22', undefined, 'not-a-version', 'UNVERSIONED'])(
    'stays silent on %s',
    (sdkVersion) => {
      expect(() => warnOnUnsupportedSdk(sdkVersion)).not.toThrow();
      expect(KlaviyoLog.warn).not.toHaveBeenCalled();
    }
  );

  it.each(['52.0.49', '53.0.27'])(
    'on %s, says it built in testing but is outside the supported range',
    (sdkVersion) => {
      warnOnUnsupportedSdk(sdkVersion);
      expect(KlaviyoLog.warn).toHaveBeenCalledTimes(1);
      expect(warnMessage()).toContain('built successfully in our testing');
      expect(warnMessage()).not.toContain('expected to fail');
    }
  );

  it.each(['50.0.21', '51.0.39'])('on %s, says the build is expected to fail', (sdkVersion) => {
    warnOnUnsupportedSdk(sdkVersion);
    expect(KlaviyoLog.warn).toHaveBeenCalledTimes(1);
    expect(warnMessage()).toContain('Android build is expected to fail');
  });

  it('warns that push will silently not work on SDK 49 and below', () => {
    warnOnUnsupportedSdk('49.0.23');
    expect(KlaviyoLog.warn).toHaveBeenCalledTimes(1);
    expect(warnMessage()).toContain('push notification handling will NOT work');
    expect(warnMessage()).toContain('even though the build succeeds');
  });

  it('warns only once per version, so repeated config resolutions do not spam', () => {
    warnOnUnsupportedSdk('52.0.49');
    warnOnUnsupportedSdk('52.0.49');
    warnOnUnsupportedSdk('52.0.49');
    expect(KlaviyoLog.warn).toHaveBeenCalledTimes(1);
  });

  it('still reports a different unsupported version after one was already warned', () => {
    warnOnUnsupportedSdk('52.0.49');
    warnOnUnsupportedSdk('50.0.21');
    expect(KlaviyoLog.warn).toHaveBeenCalledTimes(2);
  });
});
