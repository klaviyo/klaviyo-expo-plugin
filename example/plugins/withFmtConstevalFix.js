const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * EXAMPLE-APP-ONLY WORKAROUND — this is NOT part of the Klaviyo Expo plugin.
 *
 * Xcode 26 / Apple Clang 21 enforces C++20 `consteval` strictly: a consteval
 * call site must itself be a constant expression. That breaks the fmt 11.0.2
 * library vendored by React Native 0.81 (via RCT-Folly), failing the iOS build
 * in ios/Pods/fmt/include/fmt/format-inl.h. Refs:
 *   - https://github.com/facebook/react-native/issues/55601
 *   - https://github.com/fmtlib/fmt/issues/4740
 *   - https://github.com/expo/expo/issues/44229
 *
 * We inject a Podfile `post_install` hook that rewrites the vendored
 * fmt/base.h to set FMT_USE_CONSTEVAL 0, moving format-string validation from
 * compile time to runtime. The affected format strings are static literals, so
 * runtime behavior is unchanged. The patch is idempotent and safe across
 * repeated `pod install`.
 *
 * REMOVE THIS once the example moves to Expo SDK 56 / RN >= 0.83.9, which
 * bundles fmt 12.1.0 and fixes the issue upstream.
 */
const MARKER = 'klaviyo-example: fmt consteval workaround';

const SNIPPET = `
    # ${MARKER} for Xcode 26 / Apple Clang 21 (remove on Expo SDK 56 / RN >= 0.83.9)
    fmt_base = File.join(Pod::Config.instance.installation_root, 'Pods', 'fmt', 'include', 'fmt', 'base.h')
    if File.exist?(fmt_base)
      fmt_contents = File.read(fmt_base)
      fmt_patched = fmt_contents.gsub('#  define FMT_USE_CONSTEVAL 1', '#  define FMT_USE_CONSTEVAL 0')
      if fmt_patched != fmt_contents
        File.write(fmt_base, fmt_patched)
        Pod::UI.puts '[klaviyo-example] Patched fmt/base.h -> FMT_USE_CONSTEVAL 0 (Xcode 26 workaround)'
      end
    end
`;

const withFmtConstevalFix = (config) => {
  return withDangerousMod(config, [
    'ios',
    async (cfg) => {
      const podfilePath = path.join(cfg.modRequest.platformProjectRoot, 'Podfile');
      let contents = fs.readFileSync(podfilePath, 'utf8');

      // Idempotent: don't inject twice.
      if (contents.includes(MARKER)) {
        return cfg;
      }

      const anchor = 'post_install do |installer|';
      const idx = contents.indexOf(anchor);
      if (idx === -1) {
        // No post_install block found; nothing to hook into.
        return cfg;
      }

      const insertAt = idx + anchor.length;
      contents = contents.slice(0, insertAt) + '\n' + SNIPPET + contents.slice(insertAt);
      fs.writeFileSync(podfilePath, contents);
      return cfg;
    },
  ]);
};

module.exports = withFmtConstevalFix;
