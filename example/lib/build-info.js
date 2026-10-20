// Shared build-info formatter used by the in-app modal (Metro), the
// TestFlight / Play release-notes header, and Slack messages. Plain
// CommonJS with no dependencies and no I/O: callers pass plain data.
//
// Missing values (undefined, null, empty or whitespace-only strings)
// render as MISSING ("—" U+2014). A literal 'unknown' or 'local' string
// is passed through unchanged.
//
// notesText truncation to maxChars counts code points (Array.from), so
// multi-byte emoji count as one and are never split. Cut order:
//   a) cut the release body first, appending "…[truncated]" to the kept
//      body text so the total fits; if the body is cut to nothing, drop
//      the whole "Release notes" block and append "\n…[truncated]" only
//      when that still fits.
//   b) if the header alone is still too long, drop the "CI run:" line
//      and append "…[truncated]" to the last remaining line when it fits.
//   c) the app line, sdk lines, Commit and Built lines are never cut,
//      even if the result exceeds maxChars.
// A text that already fits is returned unchanged with no marker.

'use strict';

const MISSING = '—';
const SEP = ' · ';
const TRUNC_MARK = '…[truncated]';

const SDK_NAMES = {
  'expo-plugin': 'Klaviyo Expo Plugin',
  rn: 'Klaviyo RN SDK',
  ios: 'Klaviyo iOS SDK',
  android: 'Klaviyo Android SDK',
};

const SHORT_NAMES = {
  'expo-plugin': 'Expo',
  rn: 'RN',
  ios: 'iOS',
  android: 'Android',
};

// Returns null when value is undefined, null, or a blank string.
function present(value) {
  if (value === undefined || value === null) return null;
  const str = String(value).trim();
  return str === '' ? null : str;
}

function orMissing(value) {
  const v = present(value);
  return v === null ? MISSING : v;
}

// First 7 characters of the commit sha, or MISSING when absent.
function sha7(sha) {
  const v = present(sha);
  return v === null ? MISSING : v.slice(0, 7);
}

// Display ref for an SDK: the ref as given, or MISSING when absent.
// Callers compute the ref string (bare version for a release tag,
// branch@sha7 otherwise, local:branch@sha7[-dirty] for local builds).
function formatRef(version, ref) {
  return orMissing(ref);
}

// One SDK line, long or short form. The ref suffix is omitted when it
// equals the version (a release tag) or is missing.
function sdkLine(sdk, options) {
  const short = Boolean(options && options.short);
  const key = sdk && sdk.key;
  const names = short ? SHORT_NAMES : SDK_NAMES;
  const name = names[key] !== undefined ? names[key] : orMissing(key);
  const version = orMissing(sdk && sdk.version);
  const ref = present(sdk && sdk.ref);
  if (ref === null || ref === version) {
    return `${name} ${version}`;
  }
  return `${name} ${version}${SEP}${ref}`;
}

// Value-only SDK rendering for the in-app modal rows.
function sdkValue(sdk) {
  const version = orMissing(sdk && sdk.version);
  const ref = present(sdk && sdk.ref);
  if (ref === null || ref === version) {
    return version;
  }
  return `${version}${SEP}${ref}`;
}

// Label/value rows for the in-app modal, in fixed order.
function buildInfoRows(input) {
  const data = input || {};
  const rows = [
    {
      label: 'App',
      value: `${orMissing(data.appVersion)} (${orMissing(data.buildNumber)})`,
    },
  ];
  const sdks = Array.isArray(data.sdks) ? data.sdks : [];
  for (const sdk of sdks) {
    const name = SDK_NAMES[sdk && sdk.key];
    rows.push({
      label: name !== undefined ? name : orMissing(sdk && sdk.key),
      value: sdkValue(sdk),
    });
  }
  rows.push({
    label: 'App commit',
    value: `${sha7(data.commitSha)} on ${orMissing(data.branch)}`,
  });
  rows.push({ label: 'Built', value: orMissing(data.builtAt) });
  return rows;
}

// Header block shared by the store release notes and Slack, one line per
// entry, joined with '\n', no trailing newline.
function notesHeader(input) {
  const data = input || {};
  const lines = [
    `${orMissing(data.appName)} ${orMissing(data.appVersion)} (${orMissing(data.buildNumber)})`,
  ];
  const sdks = Array.isArray(data.sdks) ? data.sdks : [];
  for (const sdk of sdks) {
    lines.push(sdkLine(sdk));
  }
  lines.push(
    `Commit: ${sha7(data.commitSha)} on ${orMissing(data.sourceLabel)} (${orMissing(data.event)})`,
  );
  lines.push(`Built: ${orMissing(data.builtAt)}`);
  const runUrl = present(data.runUrl);
  if (runUrl !== null) {
    lines.push(`CI run: ${runUrl}`);
  }
  return lines.join('\n');
}

// Text for the in-app "Copy build info" button: the notes header without the CI
// run line, since the app cannot know which run built it.
function copyText(input) {
  return notesHeader({ ...(input || {}), runUrl: undefined });
}

function len(text) {
  return Array.from(text).length;
}

function takeChars(text, count) {
  return Array.from(text).slice(0, count).join('');
}

function notesText(input, maxChars) {
  const data = input || {};
  const header = notesHeader(data);
  const bodyRaw = present(data.releaseBody);
  const body = bodyRaw === null ? null : String(data.releaseBody).trim();

  let block = '';
  if (body !== null) {
    const name = present(data.releaseName);
    const heading =
      name === null ? 'Release notes:' : `Release notes (${name}):`;
    block = `\n\n${heading}\n${body}`;
  }

  const full = header + block;
  if (maxChars === undefined || maxChars === null || len(full) <= maxChars) {
    return full;
  }

  if (block !== '') {
    const blockPrefix = block.slice(0, block.length - body.length);
    const budget = maxChars - len(header) - len(blockPrefix) - len(TRUNC_MARK);
    if (budget > 0) {
      return header + blockPrefix + takeChars(body, budget) + TRUNC_MARK;
    }
    // Body cut to nothing: fall through to the header-only cuts, which mark
    // the truncation. The header is never returned unmarked after a cut.
  }

  // Header alone, with a marker when a release body was dropped.
  const dropped = block !== '';
  const withMark = (text) => (dropped ? `${text}\n${TRUNC_MARK}` : text);
  if (len(withMark(header)) <= maxChars) {
    return withMark(header);
  }

  const lines = header.split('\n');
  const ciIndex = lines.findIndex((line) => line.startsWith('CI run: '));
  if (ciIndex !== -1) {
    lines.splice(ciIndex, 1);
    const shortened = lines.join('\n');
    const marked = `${shortened}${dropped ? '\n' : ''}${TRUNC_MARK}`;
    return len(marked) <= maxChars ? marked : `${shortened}${dropped ? '\n' : ''}${TRUNC_MARK}`;
  }

  return `${header}${dropped ? '\n' : ''}${TRUNC_MARK}`;
}

// Field map for Slack messages: version/build, short SDK entries joined
// with ' | ', and the build source. The commit line is built in slack-payload.sh.
function slackFields(input, options) {
  const data = input || {};
  const sdks = Array.isArray(data.sdks) ? data.sdks : [];
  return {
    build: `${orMissing(data.appVersion)} (${orMissing(data.buildNumber)})`,
    sdks: sdks.map((sdk) => sdkLine(sdk, { short: true })).join(' | '),
    source: `${orMissing(data.sourceLabel)} (${orMissing(data.event)})`,
  };
}

module.exports = {
  MISSING,
  SDK_NAMES,
  SHORT_NAMES,
  formatRef,
  sdkLine,
  buildInfoRows,
  notesHeader,
  copyText,
  notesText,
  slackFields,
  sha7,
};
