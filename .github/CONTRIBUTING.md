# Contributing

Thank you for considering contributing to the Klaviyo Expo Plugin!

We welcome your contributions and strive to respond in a timely manner. In return, we ask that you do your
**due diligence** to answer your own questions using public resources, and check for related issues (including
closed ones) before posting. This helps keep the discussion focused on the most important topics. Issues deemed
off-topic or out of scope for the plugin will be closed. Likewise, please keep comments on-topic and productive. If
you have a different question, please open a new issue rather than commenting on an unrelated issue.

Before contributing, please read the [code of conduct](./CODE_OF_CONDUCT.md). We want this community to be friendly
and respectful to each other. Please follow it in all your interactions with the project.

## Github Issues

If you suspect a bug or have a feature request, please open an issue, following the guidelines below:

- Research your issue using public resources such as Google, Stack Overflow, React Native documentation, Expo documentation, etc.
- Attempt to reproduce your issue with the example app provided in the repository. Setup instruction can be found below.
- Check if the issue has already been reported before.
- Use a clear and descriptive title for the issue to identify the problem.
- Include as much information as possible, including:
  - The version of the plugin you are using.
  - The version of React Native you are using.
  - The version of Expo you are using
  - The platform (iOS or Android) you are experiencing the issue on.
  - Any error messages you are seeing. (please use `EXPO_DEBUG=true npx expo prebuild`)
  - The expected behavior and what went wrong.
  - Detailed steps to reproduce the issue
  - A code snippet or a minimal example that reproduces the issue.

> Answer all questions in the issue template, it is designed to help you follow all the above guidelines.
>
> ⚠️ Incomplete issues will be de-prioritized or closed. ⚠️

## Development workflow

- The plugin in the `/plugin` directory.
- An example app in the `example/` directory.


The [example app](/example) demonstrates usage of the library. You need to run it to test any changes you make.

It is configured to use the local version of the plugin, so any changes you make to the plugin's source code will be
reflected in the example app.

If you want to use Android Studio or XCode to edit the native code, you can open the `example/android` or `example/ios`
directories respectively in those editors after prebuilding.


### Commit message convention

We follow the [conventional commits specification](https://www.conventionalcommits.org/en) for our commit messages:

- `fix`: bug fixes, e.g. fix crash due to deprecated method.
- `feat`: new features, e.g. add new method to the module.
- `refactor`: code refactor, e.g. migrate from class components to hooks.
- `docs`: changes into documentation, e.g. add usage example for the module..
- `test`: adding or updating tests, e.g. add integration tests using detox.
- `chore`: tooling changes, e.g. change CI config.

### Sending a pull request

> **Working on your first pull request?** You can learn how from this _free_ series: [How to Contribute to an Open Source Project on GitHub](https://app.egghead.io/playlists/how-to-contribute-to-an-open-source-project-on-github).

When you're sending a pull request:

- Prefer small pull requests focused on one change.
- Verify that linters and tests are passing.
- Review the documentation to make sure it looks good.
- Follow the pull request template when opening a pull request.
- For pull requests that change the API or implementation, discuss with maintainers first by opening an issue.