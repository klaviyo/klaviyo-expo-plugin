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
const DECLARATION = "pod 'KlaviyoSwiftExtension'";

const base = `platform :ios, '15.1'
use_frameworks! :linkage => :static

target 'TestApp' do
  config = use_native_modules!
end
`;

/**
 * Runs the ios mod chain and returns every Podfile write plus the final content.
 *
 * withKlaviyoPodfileEnvVars always writes the Podfile (it prepends env vars), so there is
 * exactly one write on the paths where the pin logic is a no-op. Tests assert on `writes`
 * and `final` unconditionally - an earlier version guarded assertions behind
 * `if (out !== null)`, which meant a mod that threw before writing would have produced a
 * silently passing test with zero assertions executed.
 */
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

  const writes = FileManager.writeFile.mock.calls
    .filter((c: any) => c && typeof c[0] === 'string' && c[0].endsWith('/Podfile'))
    .map((c: any) => String(c[1]));

  return { writes, final: writes.length ? writes[writes.length - 1] : null };
}

/** Counts NSE target DECLARATIONS, not bare mentions of the name. */
const countTargets = (s: string) =>
  (s.match(new RegExp(`^[ \\t]*target '${NSE}' do`, 'gm')) ?? []).length;


describe('withKlaviyoPodfile - NSE pod declaration', () => {
  beforeEach(() => jest.clearAllMocks());

  it('appends the NSE target with the pod when neither exists', async () => {
    const { final } = await runAndCapturePodfile(base);
    expect(final).not.toBeNull();
    expect(final).toContain(DECLARATION);
    expect(countTargets(final as string)).toBe(1);
  });

  it('leaves an existing bare declaration untouched', async () => {
    const existing = `${base}
  target '${NSE}' do
    ${DECLARATION}
  end
`;
    const { writes, final } = await runAndCapturePodfile(existing);
    // One write, from the env-var mod. The pod branch must not rewrite anything.
    expect(writes).toHaveLength(1);
    expect(final).toContain(DECLARATION);
    expect(countTargets(final as string)).toBe(1);
  });

  it("leaves a version the consumer chose themselves alone", async () => {
    // We declare no version, so an existing declaration WITH one is the consumer's
    // choice. Rewriting it to our bare form would silently strip their pin.
    const consumerPinned = `${base}
  target '${NSE}' do
    pod  'KlaviyoSwiftExtension',  '~> 5.4'
  end
`;
    const { writes, final } = await runAndCapturePodfile(consumerPinned);
    expect(writes).toHaveLength(1);
    expect(final).toContain("pod  'KlaviyoSwiftExtension',  '~> 5.4'");
    expect(countTargets(final as string)).toBe(1);
  });

  it('never appends a second NSE target when the block exists but the pod is commented out', async () => {
    const commented = `${base}
  target '${NSE}' do
    # pod 'KlaviyoSwiftExtension'
  end
`;
    const { final } = await runAndCapturePodfile(commented);

    expect(final).not.toBeNull();
    expect(countTargets(final as string)).toBe(1);
    expect(final).not.toContain(`# ${DECLARATION}, '`);

    const warnings = (KlaviyoLog.warn as jest.Mock).mock.calls.map((c: any[]) => String(c[0]));
    expect(warnings.some((w: string) => w.includes('declares no'))).toBe(true);
  });
});
