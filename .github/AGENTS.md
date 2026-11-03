# .github Guidelines

For agents and humans editing workflows and actions here. `CLAUDE.md` in this directory points to this file.

## Slack

- Use only `.github/actions/notify-slack` for Slack. It wraps slackapi/slack-github-action, so don't call slackapi or curl directly.
- `token: ${{ secrets.SLACK_BOT_TOKEN }}`. An empty token skips, so no presence checks.
- One message per release or deploy, updated through `ts` (job output or `workflow_call` input). Failure details go in a `thread_ts` reply.
- Each workflow sets `SLACK_USERNAME` and `SLACK_ICON_EMOJI` in its top-level `env:`: "Expo SDK" for `publish-release.yml` and `publish-sdk.yml`, "Expo Example App" for `publish-example.yml`, both with `:merlin-orb-expo:`.
- `continue-on-error: true` on Slack notify steps and Slack-action checkout steps.
- Report a cancelled job only on timeout: the `Classify cancellation` step in the `publish-example.yml` deploy jobs.
- `publish-release.yml` passes `slack_ts` to `publish-sdk.yml`. `publish-example.yml` posts from `announce` before the `example-app-deploy` gate, and `report` updates that message.
- Jobs on another ref, or without a repo checkout, sparse-checkout `.github/actions` at `github.sha` into `_slack/`.
- Never post EAS build, artifact or internal-distribution links. Logs and messages here only get links that need a store login.
- `notify-slack` stays byte-identical in all 7 repos: klaviyo-android-sdk, klaviyo-android-test-app, klaviyo-swift-sdk, klaviyo-ios-test-app, klaviyo-react-native-sdk, klaviyo-expo-plugin, klaviyo-flutter-sdk.

## Workflow conventions

- `publish-release.yml` is the npm trusted publisher entry point. Don't rename it.
- `publish-example.yml` skips docs, CI and config-only changes via `paths-ignore`. Add new CI-only paths there.
- Check out with `persist-credentials: false` unless a step pushes.
