# .github Guidelines

For agents and humans editing workflows and actions here. `CLAUDE.md` in this directory points to this file.

## Slack

- Use only `klaviyo/klaviyo-react-native-sdk/.github/shared/notify-slack` for Slack. It wraps slackapi/slack-github-action, so don't call slackapi or curl directly.
- `token: ${{ secrets.SLACK_BOT_TOKEN }}`. An empty token skips, so no presence checks.
- One message per release or deploy, updated through `ts` (job output or `workflow_call` input). Failure details go in a `thread_ts` reply.
- Each workflow sets `SLACK_USERNAME` and `SLACK_ICON_EMOJI` in its top-level `env:`: "Expo SDK" for `publish-release.yml` and `publish-sdk.yml`, "Expo Example App" for `publish-example.yml`, both with `:merlin-orb-expo:`.
- `continue-on-error: true` on Slack notify steps.
- Backtick code spans in `title`, `body` and `fields` values: versions, tags, branches, package names and commands. A `Commit` field holds the first 7 characters of the SHA; `links` carries a `Commit` entry to the full SHA.
- Report a cancelled job only on timeout: the `Classify cancellation` step in the `publish-example.yml` deploy jobs.
- `publish-release.yml` passes `slack_ts` to `publish-sdk.yml`, and passes `slack_thread_ts` to `publish-example.yml`, only when the workflow at the tag declares the input.
- `publish-example.yml` posts from `announce` on every run that will deploy (push, release, dispatch, labelled PR): a top-level message, or a reply under `slack_thread_ts` when a release dispatched it. `progress` edits it after the checks pass and `report` makes the final edit. A `preflight` or `checks` failure edits that message to failed; there is no separate blocked post. Deploy and notes replies go under `slack_thread_ts`, else the announce message.
- `publish-sdk.yml` posts an `announce` reply under `slack_ts` (top-level when empty) before the `npm` approval. `notify` edits that reply to the result and also edits the release message. A job that never started is "approval rejected or expired", not a publish failure. Dry runs post nothing.
- Jobs without a repo checkout that need `set-source-label` sparse-checkout `.github/actions/set-source-label` at `github.sha`.
- Never post EAS build, artifact or internal-distribution links. Logs and messages here only get links that need a store login.

## Shared CI

- Shared CI lives in klaviyo-react-native-sdk: the composite actions in `.github/shared/` (`notify-slack`, `promotion-check`, `pr-target-check`, `linear-release-sync`, `stale`, `remove-deploy-label`) plus the callable workflows `release-preflight.yml` and `rel-branch-core.yml`. Don't copy it here.
- Its contract is klaviyo-react-native-sdk `.github/shared/README.md`. Its inputs are additive only.
- This repo passes its own values as inputs: `bump-files` in `promotion-check.yml`, `sdk-checks` in `publish-release.yml`, and `bump-command` with `node-version-file` in `rel-branch.yml`.

## Workflow conventions

- `publish-release.yml` is the npm trusted publisher entry point. Don't rename it.
- `publish-example.yml` skips docs, CI and config-only changes via `paths-ignore`. Add new CI-only paths there.
- Check out with `persist-credentials: false` unless a step pushes.
