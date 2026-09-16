/**
 * Covers withKlaviyoPluginConfigurationPlist, which the main iOS suite cannot reach:
 * tests/setup.ts mocks withXcodeProject as `(config, mod) => config`, so the mod callback
 * is never invoked there and this entire function executes in no other test.
 *
 * It matters because two one-line assignments in it decide whether the config plist ships
 * in the app bundle at all, and which target's bundle it ships in. Both are raw mutations
 * of the `xcode` package's internal object shape, so this suite runs against the REAL
 * xcode library and a REAL Expo-generated project.pbxproj fixture (two native targets,
 * two build phases commented "Resources") rather than a stub that would agree with
 * whatever we assert.
 */
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// This suite needs the real withXcodeProject, unlike the rest of the tests.
jest.unmock('@expo/config-plugins');
jest.mock('@expo/config-plugins', () => {
  const actual = jest.requireActual('@expo/config-plugins');
  return { ...actual };
});

// Real fs: the mod copies the source plist and stats it.
jest.unmock('fs');
jest.mock('fs', () => jest.requireActual('fs'));
jest.unmock('path');
jest.mock('path', () => jest.requireActual('path'));

// setup.ts mocks getPluginRoot() to '/mock/plugin/root', where no source plist exists,
// which makes the mod bail early. Point it at the real repo root for this suite.
jest.mock('../plugin/support/pluginResolver', () => ({
  getPluginRoot: () => require('path').resolve(__dirname, '..'),
}));

const FIXTURE = path.join(__dirname, 'fixtures', 'project.pbxproj');

// Every runPlistMod() call mkdtemps a directory; without this a full run leaves them behind.
const tmpDirs: string[] = [];
afterAll(() => {
  for (const dir of tmpDirs) {
    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch {
      // best effort - a leaked temp dir is not worth failing the suite over
    }
  }
});

/** Runs the plist mod against a real parsed pbxproj and returns the mutated project. */
async function runPlistMod(opts: { projectName?: string } = {}) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const xcode = require('xcode');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const withKlaviyoIos = require('../plugin/withKlaviyoIos').default;

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'klaviyo-plist-'));
  tmpDirs.push(tmp);
  const projectName = opts.projectName ?? 'klaviyopluginexample';
  fs.mkdirSync(path.join(tmp, projectName), { recursive: true });

  const project = xcode.project(FIXTURE).parseSync();

  const config: any = {
    name: projectName,
    slug: projectName,
    sdkVersion: '57.0.0',
    ios: { bundleIdentifier: 'com.test.app' },
    modResults: project,
    modRequest: {
      platformProjectRoot: tmp,
      projectName,
      projectRoot: tmp,
      platform: 'ios',
    },
    _internal: { projectRoot: tmp },
  };

  // withKlaviyoIos registers the plist mod first; invoke the ios mod chain it builds.
  const result = withKlaviyoIos(config, {
    badgeAutoclearing: true,
    codeSigningStyle: 'Automatic',
    devTeam: 'XXXXXXXXXX',
    geofencingEnabled: false,
    formsEnabled: true,
    // Keep the NSE mods out: the fixture already contains the NSE target, and this
    // suite is about which existing Resources phase the plist lands in.
    includeNotificationServiceExtension: false,
  } as any);

  const mod = result?.mods?.ios?.xcodeproj;
  if (typeof mod !== 'function') {
    throw new Error('expected withXcodeProject to register an ios.xcodeproj mod');
  }
  await mod({ ...config, modResults: project });
  return { project, tmp };
}

/** Runs the plist mod against an already-parsed project (for pre-seeded legacy states). */
async function runPlistModOn(project: any, projectName = 'klaviyopluginexample') {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const withKlaviyoIos = require('../plugin/withKlaviyoIos').default;
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'klaviyo-plist-'));
  tmpDirs.push(tmp);
  fs.mkdirSync(path.join(tmp, projectName), { recursive: true });

  const config: any = {
    name: projectName,
    slug: projectName,
    sdkVersion: '57.0.0',
    ios: { bundleIdentifier: 'com.test.app' },
    modResults: project,
    modRequest: { platformProjectRoot: tmp, projectName, projectRoot: tmp, platform: 'ios' },
    _internal: { projectRoot: tmp },
  };
  const result = withKlaviyoIos(config, {
    badgeAutoclearing: true,
    codeSigningStyle: 'Automatic',
    devTeam: 'XXXXXXXXXX',
    geofencingEnabled: false,
    formsEnabled: true,
    includeNotificationServiceExtension: false,
  } as any);
  const mod = result?.mods?.ios?.xcodeproj;
  if (typeof mod !== 'function') {
    throw new Error('expected withXcodeProject to register an ios.xcodeproj mod');
  }
  await mod({ ...config, modResults: project });
  return project;
}

/** The build-phase section entry whose comment is `Resources` for a given target uuid. */
function resourcesPhaseFor(project: any, targetUuid: string) {
  return project.pbxResourcesBuildPhaseObj(targetUuid);
}

describe('withKlaviyoPluginConfigurationPlist (real xcode project)', () => {
  it('fixture precondition: two native targets, each with a Resources phase', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const xcode = require('xcode');
    const project = xcode.project(FIXTURE).parseSync();
    const targets = Object.keys(project.pbxNativeTargetSection()).filter(
      (k) => !k.endsWith('_comment')
    );
    expect(targets.length).toBe(2);
    for (const t of targets) {
      expect(resourcesPhaseFor(project, t)).toBeTruthy();
    }

    // Order is load-bearing. Without fileRef.target, xcode appends to whichever
    // Resources phase the object hash yields FIRST, so the regression is only visible
    // when the extension's phase precedes the app's. If this fixture is ever
    // regenerated in the natural order, the wrong-phase test silently stops testing
    // anything - this assertion is what tells you.
    const phases = project.hash.project.objects['PBXResourcesBuildPhase'];
    const order = Object.keys(phases).filter((k) => !k.endsWith('_comment'));
    const appPhaseKey = project.pbxResourcesBuildPhaseObj(project.getFirstTarget().uuid);
    const appKey = order.find((k) => phases[k] === appPhaseKey);
    expect(order.indexOf(appKey as string)).toBe(1);
  });

  it('writes a real uuid for the PBXBuildFile entry, never the string "undefined"', async () => {
    const { project } = await runPlistMod();

    const section = project.pbxBuildFileSection();
    const keys = Object.keys(section);
    expect(keys).not.toContain('undefined');
    expect(keys).not.toContain('undefined_comment');

    const plistKey = keys.find(
      (k) => !k.endsWith('_comment') && String(section[k]?.fileRef_comment ?? '')
        .includes('klaviyo-plugin-configuration.plist')
    );
    expect(plistKey).toBeDefined();
    expect(plistKey).toMatch(/^[A-F0-9]{24}$/);
  });

  it('actually copies the plist onto disk, not just into the project file', async () => {
    // Removing fs.copyFileSync broke no test before this: the suite proved the pbxproj
    // REFERENCES the plist but never that the file exists. A dangling reference is an
    // Xcode build failure, so this is the more consequential half of the mod.
    const { tmp } = await runPlistMod();
    const onDisk = path.join(tmp, 'klaviyopluginexample', 'klaviyo-plugin-configuration.plist');
    expect(fs.existsSync(onDisk)).toBe(true);
    expect(fs.readFileSync(onDisk, 'utf8')).toContain('<plist');
  });

  it('records the plist with a path relative to the project, not an absolute one', async () => {
    // An absolute path bakes one machine's directory into project.pbxproj, which breaks
    // every other checkout once ios/ is committed - and makes hasFile() miss across
    // machines, which is what makes the build-phase ambiguity reachable.
    const { project } = await runPlistMod();
    const refs = project.pbxFileReferenceSection();
    const entry = Object.keys(refs)
      .filter((k) => !k.endsWith('_comment'))
      .map((k) => refs[k])
      .find((r: any) => String(r?.path ?? '').includes('klaviyo-plugin-configuration.plist'));

    expect(entry).toBeDefined();
    const stored = String((entry as any).path).replace(/^"|"$/g, '');
    expect(path.isAbsolute(stored)).toBe(false);
    expect(stored).not.toContain('/var/folders');
    expect(stored).toBe('klaviyopluginexample/klaviyo-plugin-configuration.plist');
  });

  it('adds the plist to the FIRST target\'s Resources phase, not the extension\'s', async () => {
    const { project } = await runPlistMod();

    const firstTargetUuid = project.getFirstTarget().uuid;
    const appPhase = resourcesPhaseFor(project, firstTargetUuid);

    const inApp = appPhase.files.some((f: any) =>
      String(f.comment ?? '').includes('klaviyo-plugin-configuration.plist')
    );
    expect(inApp).toBe(true);

    // And in exactly one phase overall - not duplicated across both.
    const allPhases = project.hash.project.objects['PBXResourcesBuildPhase'];
    const phasesContaining = Object.keys(allPhases)
      .filter((k) => !k.endsWith('_comment'))
      .filter((k) =>
        (allPhases[k].files ?? []).some((f: any) =>
          String(f.comment ?? '').includes('klaviyo-plugin-configuration.plist')
        )
      );
    expect(phasesContaining).toHaveLength(1);
  });

  it('is idempotent: running twice does not add a second reference', async () => {
    const { project, tmp } = await runPlistMod();

    const countRefs = (p: any) =>
      Object.keys(p.pbxFileReferenceSection()).filter(
        (k) =>
          !k.endsWith('_comment') &&
          String(p.pbxFileReferenceSection()[k]?.path ?? '').includes(
            'klaviyo-plugin-configuration.plist'
          )
      ).length;

    expect(countRefs(project)).toBe(1);

    // Re-run the mod against the already-modified project.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const withKlaviyoIos = require('../plugin/withKlaviyoIos').default;
    const config: any = {
      name: 'klaviyopluginexample',
      slug: 'klaviyopluginexample',
      sdkVersion: '57.0.0',
      ios: { bundleIdentifier: 'com.test.app' },
      modResults: project,
      modRequest: {
        platformProjectRoot: tmp,
        projectName: 'klaviyopluginexample',
        projectRoot: tmp,
        platform: 'ios',
      },
      _internal: { projectRoot: tmp },
    };
    const result = withKlaviyoIos(config, {
      badgeAutoclearing: true,
      codeSigningStyle: 'Automatic',
      devTeam: 'XXXXXXXXXX',
      geofencingEnabled: false,
      formsEnabled: true,
      includeNotificationServiceExtension: false,
    } as any);
    const mod = result?.mods?.ios?.xcodeproj;
    if (typeof mod !== 'function') {
      throw new Error('expected withXcodeProject to register an ios.xcodeproj mod');
    }
    await mod({ ...config, modResults: project });

    expect(countRefs(project)).toBe(1);

    // addFile() has its own hasFile() check, so a duplicate reference is prevented by
    // xcode regardless. What OUR early return protects is the false warning: without
    // it, addFile returns null on the second pass and the always-printed "Could not
    // add ... SDK will not be able to report the plugin version" fires on every
    // incremental prebuild. That is the regression worth pinning.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { KlaviyoLog } = require('../plugin/support/logger');
    const warnings = (KlaviyoLog.warn as jest.Mock).mock.calls.map((c: any[]) => String(c[0]));
    expect(warnings.filter((w: string) => w.includes('Could not add'))).toHaveLength(0);
  });
  it('removes a legacy 1.0.0 absolute reference instead of leaving it alongside the new one', async () => {
    // Reproduces the upgrade path a reviewer hit: ios/ generated by plugin 1.0.0, then
    // `expo prebuild --no-clean` on this version. 1.0.0 wrote an ABSOLUTE PBXFileReference
    // and never got it into a build phase, and hasFile(relative) does not match it - so
    // without pruning, the upgraded project keeps the stale machine-specific entry next to
    // the new working one.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const xcode = require('xcode');
    const project = xcode.project(FIXTURE).parseSync();

    // Seed the legacy state exactly as 1.0.0 left it: a file reference with an absolute
    // path, present in the group, absent from every build phase.
    const legacyId = 'AAAAAAAAAAAAAAAAAAAAAAAA';
    const legacyAbsolute =
      '"/Users/someone-else/Repos/app/ios/klaviyopluginexample/klaviyo-plugin-configuration.plist"';
    project.pbxFileReferenceSection()[legacyId] = {
      isa: 'PBXFileReference',
      lastKnownFileType: 'text.plist.xml',
      name: '"klaviyo-plugin-configuration.plist"',
      path: legacyAbsolute,
      sourceTree: '"<group>"',
    };
    project.pbxFileReferenceSection()[`${legacyId}_comment`] =
      'klaviyo-plugin-configuration.plist';
    const groupId = project.findPBXGroupKey({ name: 'klaviyopluginexample' });
    project.getPBXGroupByKey(groupId).children.push({
      value: legacyId,
      comment: 'klaviyo-plugin-configuration.plist',
    });

    const countPlistRefs = () => {
      const refs = project.pbxFileReferenceSection();
      return Object.keys(refs)
        .filter((k) => !k.endsWith('_comment'))
        .map((k) => String(refs[k]?.path ?? '').replace(/^"|"$/g, ''))
        .filter((pathValue) => pathValue.endsWith('klaviyo-plugin-configuration.plist'));
    };

    expect(countPlistRefs()).toHaveLength(1);
    expect(countPlistRefs()[0]).toContain('/Users/someone-else');

    await runPlistModOn(project);

    // Exactly one reference survives, and it is the relative one.
    const after = countPlistRefs();
    expect(after).toHaveLength(1);
    expect(after[0]).toBe('klaviyopluginexample/klaviyo-plugin-configuration.plist');

    // The stale entry is gone from the group as well, not just the reference section.
    const childIds = project
      .getPBXGroupByKey(groupId)
      .children.map((c: any) => c.value);
    expect(childIds).not.toContain(legacyId);

    // And the surviving reference is wired into the app target's Resources phase.
    const appPhase = resourcesPhaseFor(project, project.getFirstTarget().uuid);
    expect(
      appPhase.files.some((f: any) =>
        String(f.comment ?? '').includes('klaviyo-plugin-configuration.plist')
      )
    ).toBe(true);
  });
});
