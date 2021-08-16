import { ValidationError } from '@changesets/errors'
import {
  ReleasePlan,
  ComprehensiveRelease,
  VersionType,
} from '@changesets/types'
import { Gitlab, MergeRequests } from '@gitbeaker/core'
import { captureException } from '@sentry/node'
import { humanId } from 'human-id'
import { markdownTable } from 'markdown-table'

import * as context from './context.js'
import { getChangedPackages } from './get-changed-packages.js'

import { createApi } from './index.js'

const getReleasePlanMessage = (releasePlan: ReleasePlan | null) => {
  if (!releasePlan) return ''

  const publishableReleases = releasePlan.releases.filter(
    (x): x is ComprehensiveRelease & { type: Exclude<VersionType, 'none'> } =>
      x.type !== 'none',
  )

  const table = markdownTable([
    ['Name', 'Type'],
    ...publishableReleases.map(x => [
      x.name,
      {
        major: 'Major',
        minor: 'Minor',
        patch: 'Patch',
      }[x.type],
    ]),
  ])

  return `<details><summary>This PR includes ${
    releasePlan.changesets.length > 0
      ? `changesets to release ${
          publishableReleases.length === 1
            ? '1 package'
            : `${publishableReleases.length} packages`
        }`
      : 'no changesets'
  }</summary>

  ${
    publishableReleases.length > 0
      ? table
      : "When changesets are added to this PR, you'll see the packages that this PR includes changesets for and the associated semver types"
  }

</details>`
}

const getAbsentMessage = (
  commitSha: string,
  addChangesetUrl: string,
  releasePlan: ReleasePlan | null,
) => `###  ⚠️  No Changeset found

Latest commit: ${commitSha}

Merging this PR will not cause a version bump for any packages. If these changes should not result in a new version, you're good to go. **If these changes should result in a version bump, you need to add a changeset.**

${getReleasePlanMessage(releasePlan)}

[Click here to learn what changesets are, and how to add one](https://github.com/changesets/changesets/blob/master/docs/adding-a-changeset.md).

[Click here if you're a maintainer who wants to add a changeset to this PR](${addChangesetUrl})

`

const getApproveMessage = (
  commitSha: string,
  addChangesetUrl: string,
  releasePlan: ReleasePlan | null,
) => `###  🦋  Changeset detected

Latest commit: ${commitSha}

**The changes in this PR will be included in the next version bump.**

${getReleasePlanMessage(releasePlan)}

Not sure what this means? [Click here  to learn what changesets are](https://github.com/changesets/changesets/blob/master/docs/adding-a-changeset.md).

[Click here if you're a maintainer who wants to add another changeset to this PR](${addChangesetUrl})

`

const getNewChangesetTemplate = (changedPackages: string[], title: string) =>
  encodeURIComponent(`---
${changedPackages.map(x => `"${x}": patch`).join('\n')}
---

${title}
`)

const getCommentId = (api: Gitlab, mrIid: number | string) =>
  api.MergeRequestNotes.all(context.projectId, mrIid).then(comments => {
    const changesetBotComment = comments.find(
      comment => comment.author.username === process.env.GITLAB_CI_USER_NAME,
    )
    return changesetBotComment ? changesetBotComment.id : null
  })

const hasChangesetBeenAdded = (
  changedFilesPromise: ReturnType<MergeRequests['changes']>,
) =>
  changedFilesPromise.then(files =>
    files.changes!.some(
      file =>
        file.new_file &&
        /^\.changeset\/.+\.md$/.test(file.new_path) &&
        file.new_path !== '.changeset/README.md',
    ),
  )

export const comment = async () => {
  const {
    CI_MERGE_REQUEST_IID,
    CI_MERGE_REQUEST_PROJECT_URL,
    CI_MERGE_REQUEST_SOURCE_BRANCH_NAME: mrBranch,
    CI_MERGE_REQUEST_SOURCE_BRANCH_SHA,
    CI_MERGE_REQUEST_TITLE,
  } = process.env

  if (!mrBranch) {
    console.warn('[changesets-gitlab:comment] It should only be used on MR')
    return
  }

  if (mrBranch.startsWith('changeset-release')) {
    return
  }

  const api = createApi()

  let errFromFetchingChangedFiles = ''

  const mrIid = +CI_MERGE_REQUEST_IID!

  try {
    const latestCommitSha = CI_MERGE_REQUEST_SOURCE_BRANCH_SHA!
    const changedFilesPromise = api.MergeRequests.changes(
      context.projectId,
      mrIid,
    )

    const [commentId, hasChangeset, { changedPackages, releasePlan }] =
      await Promise.all([
        getCommentId(api, mrIid),
        hasChangesetBeenAdded(changedFilesPromise),
        getChangedPackages({
          changedFiles: changedFilesPromise.then(x =>
            x.changes!.map(x => x.new_path),
          ),
          api,
        }).catch((err: unknown) => {
          if (err instanceof ValidationError) {
            errFromFetchingChangedFiles = `<details><summary>💥 An error occurred when fetching the changed packages and changesets in this PR</summary>\n\n\`\`\`\n${err.message}\n\`\`\`\n\n</details>\n`
          } else {
            console.error(err)
            captureException(err)
          }
          return {
            changedPackages: ['@fake-scope/fake-pkg'],
            releasePlan: null,
          }
        }),
      ] as const)

    const addChangesetUrl = `${CI_MERGE_REQUEST_PROJECT_URL!}/new/${mrBranch}?file_name=.changeset/${humanId(
      {
        separator: '-',
        capitalize: false,
      },
    )}.md&file=${getNewChangesetTemplate(
      changedPackages,
      CI_MERGE_REQUEST_TITLE!,
    )}`

    const prComment =
      (hasChangeset
        ? getApproveMessage(latestCommitSha, addChangesetUrl, releasePlan)
        : getAbsentMessage(latestCommitSha, addChangesetUrl, releasePlan)) +
      errFromFetchingChangedFiles

    if (commentId != null) {
      return api.MergeRequestNotes.edit(
        context.projectId,
        mrIid,
        commentId,
        prComment,
      )
    }
    return api.MergeRequestNotes.create(context.projectId, mrIid, prComment)
  } catch (err: unknown) {
    console.error(err)
    throw err
  }
}
