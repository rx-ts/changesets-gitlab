import { Gitlab } from '@gitbeaker/node'
import { bootstrap, ProxyAgentConfigurationType } from 'global-agent'

const PROXY_PROPS = ['http_proxy', 'https_proxy', 'no_proxy'] as const

declare global {
  const GLOBAL_AGENT: {
    HTTP_PROXY: string | null
    HTTPS_PROXY: string | null
    NO_PROXY: string | null
  }
}

export const createApi = (gitlabToken?: string) => {
  bootstrap()

  for (const prop of PROXY_PROPS) {
    const uProp = prop.toUpperCase() as keyof ProxyAgentConfigurationType
    const value = process.env[uProp] || process.env[prop]
    if (value) {
      GLOBAL_AGENT[uProp] = value
    }
  }

  return new Gitlab({
    camelize: true,
    host: process.env.GITLAB_HOST,
    token: gitlabToken || process.env.GITLAB_TOKEN,
  })
}
