import { exec } from '@actions/exec'

import { env } from './env.js'
import { execWithOutput, identify } from './utils.js'

export const setupUser = async () => {
  await exec('git', [
    'config',
    'user.name',
    env.GITLAB_CI_USER_NAME || env.GITLAB_USER_NAME,
  ])
  await exec('git', ['config', 'user.email', env.GITLAB_CI_USER_EMAIL])
}

export const pullBranch = async (branch: string) => {
  await exec('git', ['pull', 'origin', branch])
}

export const push = async (
  branch: string,
  { force }: { force?: boolean } = {},
) => {
  await exec(
    'git',
    ['push', 'origin', `HEAD:${branch}`, force && '--force'].filter(identify),
  )
}

export const pushTags = async () => {
  await exec('git', ['push', 'origin', '--tags'])
}

export const pushTag = async (tag: string) => {
  console.log('Pushing tag: ' + tag)
  await exec('git', ['push', 'origin', tag])
}

export const switchToMaybeExistingBranch = async (branch: string) => {
  const { stderr } = await execWithOutput('git', ['checkout', branch], {
    ignoreReturnCode: true,
  })
  const isCreatingBranch =
    !stderr.includes(`Switched to branch '${branch}'`) &&
    // it could be a detached HEAD
    !stderr.includes(`Switched to a new branch '${branch}'`)
  if (isCreatingBranch) {
    await exec('git', ['checkout', '-b', branch])
  }
}

export const reset = async (
  pathSpec: string,
  mode: 'hard' | 'mixed' | 'soft' = 'hard',
) => {
  await exec('git', ['reset', `--${mode}`, pathSpec])
}

export const commitAll = async (message: string) => {
  await exec('git', ['add', '-A', '.'])
  await exec('git', ['commit', '-m', message])
}

export const checkIfClean = async (): Promise<boolean> => {
  const { stdout } = await execWithOutput('git', ['status', '--porcelain'])
  return stdout.length === 0
}
