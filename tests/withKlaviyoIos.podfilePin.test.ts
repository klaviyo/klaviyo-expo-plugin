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

/** The canonical single-space pin, i.e. what a rewrite would normalise to. */
const CANONICAL = "pod 'KlaviyoSwiftExtension', '~> 5.0'";

describe('withKlaviyoPodfile - NSE pod pin', () => {
  beforeEach(() => jest.clearAllMocks());

  it('appends the NSE target with a pinned pod when neither exists', async () => {
    const { final } = await runAndCapturePodfile(base);
    expect(final).not.toBeNull();
    expect(final).toContain(PINNED);
    expect(countTargets(final as string)).toBe(1);
  });

  it('upgrades an existing UNPINNED declaration to the pinned form', async () => {
    const unpinned = `${base}
  target '${NSE}' do
    pod 'KlaviyoSwiftExtension'
  end
`;
    const { final } = await runAndCapturePodfile(unpinned);
    expect(final).not.toBeNull();
    expect(final).toContain(PINNED);
    expect(final).not.toMatch(/pod 'KlaviyoSwiftExtension'\s*$/m);
    expect(countTargets(final as string)).toBe(1);
  });

  it('preserves indentation when upgrading', async () => {
    const unpinned = `${base}
  target '${NSE}' do
        pod 'KlaviyoSwiftExtension'
  end
`;
    const { final } = await runAndCapturePodfile(unpinned);
    expect(final).not.toBeNull();
    expect(final).toContain(`        ${PINNED}`);
  });

  it('does not rewrite a declaration that is already pinned, even with odd whitespace', async () => {
    const pinnedOddWhitespace = `${base}
  target '${NSE}' do
    pod  'KlaviyoSwiftExtension',  '~> 5.0'
  end
`;
    const { writes, final } = await runAndCapturePodfile(pinnedOddWhitespace);

    // Unconditional. The env-var mod writes the Podfile once regardless, so a no-op pin
    // means exactly one write whose content still carries the odd spacing. Asserting the
    // ABSENCE of the canonical form is what makes this fail if the whitespace-collapse
    // comparison is removed, since an exact-string compare would rewrite the line.
    expect(writes).toHaveLength(1);
    expect(final).toContain("pod  'KlaviyoSwiftExtension',  '~> 5.0'");
    expect(final).not.toContain(CANONICAL);
    expect(countTargets(final as string)).toBe(1);
  });

  it('never appends a second NSE target when the block exists but the pod is commented out', async () => {
    // This is the case line-anchoring the regex introduced: the commented pod correctly
    // fails to match, and a naive append would duplicate the target and break pod install.
    const commented = `${base}
  target '${NSE}' do
    # pod 'KlaviyoSwiftExtension'
  end
`;
    const { final } = await runAndCapturePodfile(commented);

    expect(final).not.toBeNull();
    expect(countTargets(final as string)).toBe(1);
    // and it must not have pinned a pod inside the comment
    expect(final).not.toContain(`# ${PINNED}`);

    const warnings = (KlaviyoLog.warn as jest.Mock).mock.calls.map((c: any[]) => String(c[0]));
    expect(warnings.some((w: string) => w.includes('declares no'))).toBe(true);
  });
});
