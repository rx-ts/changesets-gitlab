import { URL } from 'node:url'

import { getInput, setFailed, setOutput, exportVariable } from '@actions/core'
import { exec } from '@actions/exec'
import fs from 'fs-extra'

import { env } from './env.js'
import { setupUser } from './gitUtils.js'
import readChangesetState from './readChangesetState.js'
import { runPublish, runVersion } from './run.js'
import type { MainCommandOptions } from './types.js'
import { execSync, getOptionalInput, getUsername } from './utils.js'

import { createApi } from './index.js'

export const main = async ({
  published,
  onlyChangesets,
}: MainCommandOptions = {}) => {
  const {
    CI,
    GITLAB_HOST,
    GITLAB_TOKEN,
    HOME,
    NPM_TOKEN,
    DEBUG_GITLAB_CREDENTIAL = 'false',
  } = env

  setOutput('published', false)
  setOutput('publishedPackages', [])

  if (CI) {
    console.log('setting git user')
    await setupUser()

    const url = new URL(GITLAB_HOST)

    console.log('setting GitLab credentials')
    const username = await getUsername(createApi())

    await exec(
      'git',
      [
        'remote',
        'set-url',
        'origin',
        `${url.protocol}//${username}:${GITLAB_TOKEN}@${
          url.host
        }${url.pathname.replace(/\/$/, '')}/${env.CI_PROJECT_PATH}.git`, // eslint-disable-line unicorn/consistent-destructuring
      ],
      { silent: !['true', '1'].includes(DEBUG_GITLAB_CREDENTIAL) },
    )
  }

  const { changesets } = await readChangesetState()

  const publishScript = getInput('publish')
  const hasChangesets = changesets.length > 0
  const hasPublishScript = !!publishScript

  switch (true) {
    case !hasChangesets && !hasPublishScript: {
      console.log('No changesets found')
      return
    }
    case !hasChangesets && hasPublishScript: {
      console.log(
        'No changesets found, attempting to publish any unpublished packages to npm',
      )

      const npmrcPath = `${HOME}/.npmrc`
      if (fs.existsSync(npmrcPath)) {
        console.log('Found existing .npmrc file')
      } else if (NPM_TOKEN) {
        console.log('No .npmrc file found, creating one')
        fs.writeFileSync(
          npmrcPath,
          `//registry.npmjs.org/:_authToken=${NPM_TOKEN}`,
        )
      } else {
        setFailed(
          'No `.npmrc` found nor `NPM_TOKEN` provided, unable to publish packages',
        )
        return
      }

      const result = await runPublish({
        script: publishScript,
        gitlabToken: GITLAB_TOKEN,
        createGitlabReleases: getInput('create_gitlab_releases') !== 'false',
        pushAllTags: getInput('push_all_tags') !== 'false',
      })

      if (result.published) {
        setOutput('published', true)
        setOutput('publishedPackages', result.publishedPackages)
        exportVariable('PUBLISHED', true)
        exportVariable('PUBLISHED_PACKAGES', result.publishedPackages)
        if (published) {
          execSync(published)
        }
      }
      return
    }
    case hasChangesets: {
      await runVersion({
        script: getOptionalInput('version'),
        gitlabToken: GITLAB_TOKEN,
        mrTitle: getOptionalInput('title'),
        mrTargetBranch: getOptionalInput('target_branch'),
        commitMessage: getOptionalInput('commit'),
        removeSourceBranch: getInput('remove_source_branch') === 'true',
        hasPublishScript,
      })
      if (onlyChangesets) {
        execSync(onlyChangesets)
      }
    }
  }
}
