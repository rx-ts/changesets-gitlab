import { setFailed } from '@actions/core'
import dotenv from 'dotenv'

import type { Env } from './types'

dotenv.config()

let isGitlabTokenValidated = false

export const env = {
  ...process.env,

  CI_MERGE_REQUEST_IID: +process.env.CI_MERGE_REQUEST_IID!,
  GITLAB_HOST:
    process.env.GITLAB_HOST ??
    process.env.CI_SERVER_URL ??
    'https://gitlab.com',
  GITLAB_CI_USER_EMAIL:
    process.env.GITLAB_CI_USER_EMAIL || 'gitlab[bot]@users.noreply.gitlab.com',
  GITLAB_COMMENT_TYPE: process.env.GITLAB_COMMENT_TYPE ?? 'discussion',
  DEBUG_GITLAB_CREDENTIAL: process.env.DEBUG_GITLAB_CREDENTIAL ?? 'false',
  GITLAB_COMMENT_CUSTOM_LINKS:
    process.env.GITLAB_COMMENT_CUSTOM_LINKS ?? 'false',

  // only check for the token if we are explicitly using it
  // eslint-disable-next-line sonar/function-name
  get GITLAB_TOKEN() {
    if (!isGitlabTokenValidated) {
      isGitlabTokenValidated = true
      if (!process.env.GITLAB_TOKEN) {
        setFailed('Please add the `GITLAB_TOKEN` to the changesets action')
      }
    }
    return process.env.GITLAB_TOKEN!
  },
} as Env
