/**
 * Covers the NSE pod pin-upgrade path in withKlaviyoPodfile.
 *
 * The existing Podfile tests only assert the inject/skip cases, which pass identically
 * whether or not the pin logic works. These cover the four branches the logic actually
 * has: append when absent, upgrade an unpinned declaration, no-op when already pinned
 * (including benign whitespace), and - the important one - never append a SECOND
 * `target 'KlaviyoNotificationServiceExtension' do` block, which makes `pod install` fail.
 */
import withKlaviyoIos from '../plugin/withKlaviyoIos';
import { createMockIosConfig, createMockIosProps } from './utils/testHelpers';

const { FileManager } = require('../plugin/support/fileManager');
const { KlaviyoLog } = require('../plugin/support/logger');

const NSE = 'KlaviyoNotificationServiceExtension';
const PINNED = "pod 'KlaviyoSwiftExtension', '~> 5.0'";

const base = `platform :ios, '15.1'
use_frameworks! :linkage => :static

target 'TestApp' do
  config = use_native_modules!
end
`;

/** Runs the ios mod chain and returns the content written back to the Podfile, if any. */
async function runAndCapturePodfile(podfileContent: string) {
  FileManager.readFile.mockResolvedValue(podfileContent);
  FileManager.writeFile.mockResolvedValue(undefined);
  FileManager.dirExists.mockReturnValue(true);
  FileManager.copyFile.mockResolvedValue(undefined);

  const config = createMockIosConfig();
  const result = withKlaviyoIos(config, createMockIosProps()) as any;
  if (result.mods && result.mods.ios) {
    await result.mods.ios(result);
  }

  const writes = FileManager.writeFile.mock.calls.filter(
    (c: any) => c && typeof c[0] === 'string' && c[0].endsWith('/Podfile')
  );
  // The env-var mod also writes the Podfile; the pin lives in the last write.
  return writes.length ? String(writes[writes.length - 1][1]) : null;
}

const countTargets = (s: string) => s.split(`target '${NSE}'`).length - 1;

describe('withKlaviyoPodfile - NSE pod pin', () => {
  beforeEach(() => jest.clearAllMocks());

  it('appends the NSE target with a pinned pod when neither exists', async () => {
    const out = await runAndCapturePodfile(base);
    expect(out).toContain(PINNED);
    expect(countTargets(out as string)).toBe(1);
  });

  it('upgrades an existing UNPINNED declaration to the pinned form', async () => {
    const unpinned = `${base}
  target '${NSE}' do
    pod 'KlaviyoSwiftExtension'
  end
`;
    const out = await runAndCapturePodfile(unpinned);
    expect(out).toContain(PINNED);
    expect(out).not.toMatch(/pod 'KlaviyoSwiftExtension'\s*$/m);
    expect(countTargets(out as string)).toBe(1);
  });

  it('preserves indentation when upgrading', async () => {
    const unpinned = `${base}
  target '${NSE}' do
        pod 'KlaviyoSwiftExtension'
  end
`;
    const out = await runAndCapturePodfile(unpinned);
    expect(out).toContain(`        ${PINNED}`);
  });

  it('does not rewrite a declaration that is already pinned, even with odd whitespace', async () => {
    const pinnedOddWhitespace = `${base}
  target '${NSE}' do
    pod  'KlaviyoSwiftExtension',  '~> 5.0'
  end
`;
    const out = await runAndCapturePodfile(pinnedOddWhitespace);
    // Either no Podfile write at all for the pin, or a write that left the line alone.
    if (out !== null) {
      expect(out).toContain("pod  'KlaviyoSwiftExtension',  '~> 5.0'");
      expect(countTargets(out)).toBe(1);
    }
  });

  it('never appends a second NSE target when the block exists but the pod is commented out', async () => {
    // This is the case line-anchoring the regex introduced: the commented pod correctly
    // fails to match, and a naive append would duplicate the target and break pod install.
    const commented = `${base}
  target '${NSE}' do
    # pod 'KlaviyoSwiftExtension'
  end
`;
    const out = await runAndCapturePodfile(commented);

    if (out !== null) {
      expect(countTargets(out)).toBe(1);
      // and it must not have pinned a pod inside the comment
      expect(out).not.toContain(`# ${PINNED}`);
    }

    const warnings = (KlaviyoLog.warn as jest.Mock).mock.calls.map((c: any[]) => String(c[0]));
    expect(warnings.some((w: string) => w.includes('declares no'))).toBe(true);
  });
});
