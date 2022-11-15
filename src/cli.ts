#!/usr/bin/env node

import './env.js'

import _ from 'node:module'

import { setFailed } from '@actions/core'
import { program } from 'commander'

import { comment } from './comment.js'
import { main } from './main.js'
import { getOptionalInput } from './utils.js'

const cjsRequire =
  typeof require === 'undefined' ? _.createRequire(import.meta.url) : require

const run = async () => {
  const { GITLAB_TOKEN } = process.env

  if (!GITLAB_TOKEN) {
    setFailed('Please add the `GITLAB_TOKEN` to the changesets action')
    return
  }

  program.version(
    (cjsRequire('../package.json') as { version: string }).version,
  )

  program.command('comment').action(async () => {
    await comment()
  })

  program
    .command('main', {
      isDefault: true,
    })
    .action(() =>
      main({
        published: getOptionalInput('published'),
        onlyChangesets: getOptionalInput('only_changesets'),
      }),
    )

  return program.showHelpAfterError().parseAsync()
}

run().catch((err: Error) => {
  console.error(err)
  process.exitCode = 1
})
