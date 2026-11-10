import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Plugin } from 'vite'

export const demoNoticeFile = 'THIRD-PARTY-NOTICES.txt'

// Vite collects installed package licenses from the chunks' module IDs. CSS,
// virtual runtime helpers and embedded upstream attributions need separate entries.
export function demoNotices(): Plugin {
  return {
    name: 'meerkats-demo-notices',
    generateBundle: {
      order: 'post',
      handler(_, bundle) {
        const notices = bundle[demoNoticeFile]
        if (notices?.type !== 'asset' || typeof notices.source !== 'string') {
          this.error('Missing Vite license inventory for the demo.')
        }
        const supplemental = [
          ['tailwindcss', 'LICENSE', 'generated CSS and Preflight'],
          ['vite', 'LICENSE.md', 'preload helpers'],
          ['rolldown', 'LICENSE', 'module runtime helpers'],
        ].map(([name, filename, contribution]) => {
          const directory = join('node_modules', name)
          const { version } = JSON.parse(readFileSync(join(directory, 'package.json'), 'utf8'))
          const license = readFileSync(join(directory, filename), 'utf8')
          // Vite's following sections describe dependencies of its Node build tool.
          const coreLicense = license.split('# Licenses of bundled dependencies')[0].trim()
          return `## ${name} - ${version} (MIT) · ${contribution}\n\n${coreLicense}`
        })
        notices.source = [
          notices.source.trimEnd(),
          ...supplemental,
          readFileSync('build/demo-attributions.txt', 'utf8').trim(),
          '## Noto Sans Malayalam\n\nCopyright 2022 The Noto Project Authors. The font and its complete SIL Open Font License 1.1 are distributed together in fonts/OFL-NotoSansMalayalam.txt.',
        ].join('\n\n').replaceAll('\r\n', '\n') + '\n'
      },
    },
  }
}
