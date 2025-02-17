# changesets-gitlab

[![GitHub Actions](https://github.com/un-ts/changesets-gitlab/workflows/CI/badge.svg)](https://github.com/un-ts/changesets-gitlab/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/changesets-gitlab.svg)](https://www.npmjs.com/package/changesets-gitlab)
[![GitHub Release](https://img.shields.io/github/release/un-ts/changesets-gitlab)](https://github.com/un-ts/changesets-gitlab/releases)

[![Conventional Commits](https://img.shields.io/badge/conventional%20commits-1.0.0-yellow.svg)](https://conventionalcommits.org)
[![Renovate enabled](https://img.shields.io/badge/renovate-enabled-brightgreen.svg)](https://renovatebot.com)
[![JavaScript Style Guide](https://img.shields.io/badge/code_style-standard-brightgreen.svg)](https://standardjs.com)
[![Code Style: Prettier](https://img.shields.io/badge/code_style-prettier-ff69b4.svg)](https://github.com/prettier/prettier)
[![changesets](https://img.shields.io/badge/maintained%20with-changesets-176de3.svg)](https://github.com/atlassian/changesets)

GitLab CI cli for [changesets](https://github.com/atlassian/changesets) like its [GitHub Action](https://github.com/changesets/action), it creates a merge request with all of the package versions updated and changelogs updated and when there are new changesets on master, the MR will be updated. When you're ready, you can merge the merge request and you can either publish the packages to npm manually or setup the action to do it for you.

## Usage

### Inputs

> Note: environment variables are case-sensitive

- `INPUT_PUBLISH` - The command to use to build and publish packages
- `INPUT_VERSION` - The command to update version, edit CHANGELOG, read and delete changesets. Default to `changeset version` if not provided
- `INPUT_COMMIT` - The commit message to use. Default to `Version Packages`
- `INPUT_TITLE` - The merge request title. Default to `Version Packages`

#### Only available in `changesets-gitlab`

- `INPUT_PUBLISHED` - Command executed after published
- `INPUT_ONLY_CHANGESETS` - Command executed on only changesets detected
- `INPUT_REMOVE_SOURCE_BRANCH` - Enables the merge request "Delete source branch" checkbox. Default false.
- `INPUT_TARGET_BRANCH` -> The merge request target branch. Defaults to current branch
- `INPUT_CREATE_GITLAB_RELEASES` - A boolean value to indicate whether to create Gitlab releases after publish or not. Default true.
- `INPUT_LABELS` - A comma separated string of labels to be added to the version package Gitlab Merge request

### Outputs

- `PUBLISHED` - A boolean value to indicate whether a publishing is happened or not
- `PUBLISHED_PACKAGES` - A JSON array to present the published packages. The format is `[{"name": "@xx/xx", "version": "1.2.0"}, {"name": "@xx/xy", "version": "0.8.9"}]`

### Environment Variables

```sh
GLOBAL_AGENT_HTTP_PROXY  # optional, if you're using custom GitLab service under proxy
GLOBAL_AGENT_HTTPS_PROXY # As above but for https requests
GLOBAL_AGENT_NO_PROXY    # Like above but for no proxied requests

# http_proxy, https_proxy, no_proxy environment variables are supported at the same time

GITLAB_HOST # optional, if you're using custom GitLab host, will fallback to `CI_SERVER_URL` if not provided

GITLAB_TOKEN                          # required, token with accessibility to push
GITLAB_TOKEN_TYPE                     # optional, type of the provided token in GITLAB_TOKEN. defaults to personal access token. can be `job` if you provide the Gitlab CI_JOB_TOKEN or `oauth` if you use Gitlab Oauth token
GITLAB_CI_USER_NAME                   # optional, username with accessibility to push, used in pairs of the above token (if it was personal access token). If not set read it from the Gitlab API
GITLAB_CI_USER_EMAIL                  # optional, default `gitlab[bot]@users.noreply.gitlab.com`
GITLAB_COMMENT_TYPE                   # optional, type of the comment. defaults to `discussion`. can be set to `note` to not create a discussion instead of a thread
GITLAB_ADD_CHANGESET_MESSAGE          # optional, default commit message for adding changesets on GitLab Web UI
GITLAB_COMMENT_DISCUSSION_AUTORESOLVE # optional, automaticly resolve added discussion with options to resolve discussion by default (value `always`) or resolve only when changeset is present (value `hasChangeset`)
DEBUG_GITLAB_CREDENTIAL               # optional, default `false`
```

### Example workflow

#### Without Publishing

Create a file at `.gitlab-ci.yml` with the following content.

```yml
stages:
  - comment
  - release

before_script: yarn --frozen-lockfile

comment:
  image: node:lts-alpine
  stage: comment
  rules:
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"
  script: yarn changesets-gitlab comment # comment automatically like https://github.com/changesets/bot

release:
  image: node:lts-alpine
  rules:
    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH
  script: yarn changesets-gitlab
```

#### With Publishing

Before you can setup this action with publishing, you'll need to have an [npm token](https://docs.npmjs.com/creating-and-viewing-authentication-tokens) that can publish the packages in the repo you're setting up the action for and doesn't have 2FA on publish enabled ([2FA on auth can be enabled](https://docs.npmjs.com/about-two-factor-authentication)). You'll also need to [add it as a custom environment variable on your GitLab repo](https://docs.gitlab.com/ee/ci/variables/#custom-cicd-variables) with the name `NPM_TOKEN`. Once you've done that, you can create a file at `.gitlab-ci.yml` with the following content.

```yml
stages:
  - comment
  - release

before_script: yarn --frozen-lockfile

comment:
  image: node:lts-alpine
  stage: comment
  rules:
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"
  script: yarn changesets-gitlab comment

release:
  image: node:lts-alpine
  rules:
    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH
  script: yarn changesets-gitlab
  variables:
    INPUT_PUBLISH: yarn release
```

By default the GitLab CI cli creates a `.npmrc` file with the following content:

```sh
//registry.npmjs.org/:_authToken=${process.env.NPM_TOKEN}
```

However, if a `.npmrc` file is found, the GitLab CI cli does not recreate the file. This is useful if you need to configure the `.npmrc` file on your own.
For example, you can add a step before running the Changesets GitLab CI cli:

```yml
script: |
  cat << EOF > "$HOME/.npmrc"
    email=my@email.com
    //registry.npmjs.org/:_authToken=$NPM_TOKEN
  EOF
```

#### With version script

If you need to add additional logic to the version command, you can do so by using a version script.

If the version script is present, this action will run that script instead of `changeset version`, so please make sure that your script calls `changeset version` at some point. All the changes made by the script will be included in the MR.

```yml
stages:
  - comment
  - release

before_script: yarn --frozen-lockfile

comment:
  image: node:lts-alpine
  stage: comment
  rules:
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"
  script: yarn changesets-gitlab comment

release:
  image: node:lts-alpine
  rules:
    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH
  script: yarn changesets-gitlab
  variables:
    INPUT_VERSION: yarn version
```

#### With Yarn 2 / Plug'n'Play

If you are using [Yarn Plug'n'Play](https://yarnpkg.com/features/pnp), you should use a custom `version` command so that the action can resolve the `changeset` CLI:

```yml
stages:
  - comment
  - release

before_script: yarn --frozen-lockfile

comment:
  image: node:lts-alpine
  stage: comment
  rules:
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"
  script: yarn changesets-gitlab comment

release:
  image: node:lts-alpine
  rules:
    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH
  script: yarn changesets-gitlab
  variables:
    INPUT_VERSION: yarn changeset version
```

You may also want to run `yarn install` after the `changeset verion` command to update the `yarn.lock` in the version MR. You need to disable immutable lock file setting using an env variable:

```yml
release:
  image: node:lts-alpine
  rules:
    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH
  script: yarn changesets-gitlab
  variables:
    YARN_ENABLE_IMMUTABLE_INSTALLS: 'false'
    INPUT_VERSION: yarn update-versions
```

And your `update-versions` script would be:

```json
{
  "update-versions": "changeset version && yarn install"
}
```

## Sponsors

| 1stG                                                                                                                               | RxTS                                                                                                                               | UnTS                                                                                                                               |
| ---------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| [![1stG Open Collective backers and sponsors](https://opencollective.com/1stG/organizations.svg)](https://opencollective.com/1stG) | [![RxTS Open Collective backers and sponsors](https://opencollective.com/rxts/organizations.svg)](https://opencollective.com/rxts) | [![UnTS Open Collective backers and sponsors](https://opencollective.com/unts/organizations.svg)](https://opencollective.com/unts) |

## Backers

[![Backers](https://raw.githubusercontent.com/1stG/static/master/sponsors.svg)](https://github.com/sponsors/JounQin)

| 1stG                                                                                                                             | RxTS                                                                                                                             | UnTS                                                                                                                             |
| -------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| [![1stG Open Collective backers and sponsors](https://opencollective.com/1stG/individuals.svg)](https://opencollective.com/1stG) | [![RxTS Open Collective backers and sponsors](https://opencollective.com/rxts/individuals.svg)](https://opencollective.com/rxts) | [![UnTS Open Collective backers and sponsors](https://opencollective.com/unts/individuals.svg)](https://opencollective.com/unts) |

## Changelog

Detailed changes for each release are documented in [CHANGELOG.md](./CHANGELOG.md).

## License

[MIT][] © [JounQin][]@[1stG.me][]

[1stg.me]: https://www.1stg.me
[jounqin]: https://GitHub.com/JounQin
[mit]: http://opensource.org/licenses/MIT
