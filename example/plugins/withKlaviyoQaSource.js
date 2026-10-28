const { withBaseMod } = require("expo/config-plugins");
const fs = require("fs/promises");
const path = require("path");

const swiftSource = {
  git: "https://github.com/klaviyo/klaviyo-swift-sdk.git",
  commit: "078022a24123dd05d61850f48f10d6fb1d1414c9",
};

function pinNotificationExtensionSource(podfile) {
  return podfile.replace(
    /^([ \t]*)target\s+['"]KlaviyoNotificationServiceExtension['"]\s+do\b([\s\S]*?)^\1end/m,
    (block) =>
      block.replace(
        /^([ \t]*)pod\s+['"]KlaviyoSwiftExtension['"][^\n]*$/m,
        `$1pod 'KlaviyoSwiftExtension', :git => '${swiftSource.git}', :commit => '${swiftSource.commit}'`,
      ),
  );
}

module.exports = (config) =>
  withBaseMod(config, {
    platform: "ios",
    mod: "dangerous",
    async action({ modRequest: { nextMod, ...modRequest }, ...config }) {
      const result = await nextMod({ ...config, modRequest });
      const podfilePath = path.join(modRequest.platformProjectRoot, "Podfile");
      const podfile = await fs.readFile(podfilePath, "utf8");
      await fs.writeFile(podfilePath, pinNotificationExtensionSource(podfile));
      return result;
    },
  });
module.exports.swiftSource = swiftSource;
module.exports.pinNotificationExtensionSource = pinNotificationExtensionSource;
