import * as fs from "fs/promises";
import * as os from "os";
import * as path from "path";
import { withDangerousMod } from "@expo/config-plugins";

jest.unmock("@expo/config-plugins");
jest.unmock("fs");
jest.unmock("path");

const source =
  ":git => 'https://github.com/klaviyo/klaviyo-swift-sdk.git', :commit => '88303c731342e931e1d3212611841a2c73f74a40'";
const fixture = `target 'App' do
  pod 'Other'
end
target 'KlaviyoNotificationServiceExtension' do
  pod 'KlaviyoSwiftExtension'
end
target 'UnrelatedExtension' do
  pod 'KlaviyoSwiftExtension', '5.5.0'
end
`;

describe("example Swift QA source", () => {
  it("pins only the generated NSE declaration and is idempotent", () => {
    const {
      pinNotificationExtensionSource,
    } = require("../example/plugins/withKlaviyoQaSource");
    const updated = pinNotificationExtensionSource(fixture);
    expect(updated).toBe(
      fixture.replace(
        "  pod 'KlaviyoSwiftExtension'\n",
        `  pod 'KlaviyoSwiftExtension', ${source}\n`,
      ),
    );
    expect(pinNotificationExtensionSource(updated)).toBe(updated);
  });

  it("runs the rewrite after the existing dangerous mods generate the NSE", async () => {
    const plugin = require("../example/plugins/withKlaviyoQaSource");
    const projectRoot = await fs.mkdtemp(
      path.join(os.tmpdir(), "expo-qa-source-"),
    );
    try {
      await fs.mkdir(path.join(projectRoot, "ios"));
      let config = withDangerousMod({ name: "App", slug: "app" }, [
        "ios",
        async (result) => {
          await fs.writeFile(path.join(projectRoot, "ios/Podfile"), fixture);
          return result;
        },
      ]);
      config = plugin(config);
      await config.mods!.ios!.dangerous!({
        ...config,
        modResults: {},
        modRequest: {
          projectRoot,
          platformProjectRoot: path.join(projectRoot, "ios"),
          platform: "ios",
          modName: "dangerous",
          introspect: false,
        } as any,
      });
      expect(
        await fs.readFile(path.join(projectRoot, "ios/Podfile"), "utf8"),
      ).toContain(`pod 'KlaviyoSwiftExtension', ${source}`);
    } finally {
      await fs.rm(projectRoot, { recursive: true, force: true });
    }
  });
});
