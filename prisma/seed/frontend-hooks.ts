// Node module hooks used only by the seed. The frontend's src/data/* files are written for Vite:
// they import "@/lib/slugify" and "./testSeries" without file extensions. These hooks map "@/" to the
// frontend's src/ folder and add ".js" / "/index.js" to extensionless imports inside that folder,
// so Node can load the files as they are (the frontend repo is never modified).
import { existsSync, statSync } from 'node:fs'
import { registerHooks } from 'node:module'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const isFile = (p: string) => existsSync(p) && statSync(p).isFile()

function withExtension(absPath: string) {
  for (const candidate of [absPath, `${absPath}.js`, `${absPath}.jsx`, path.join(absPath, 'index.js')]) {
    if (isFile(candidate)) return candidate
  }
  return null
}

export function registerFrontendImports(srcDir: string) {
  const root = path.resolve(srcDir)
  registerHooks({
    resolve(specifier, context, nextResolve) {
      const parent = context.parentURL?.startsWith('file:') ? fileURLToPath(context.parentURL) : ''
      let target: string | null = null
      if (specifier.startsWith('@/')) target = withExtension(path.join(root, specifier.slice(2)))
      else if (parent.startsWith(root + path.sep) && /^\.\.?\//.test(specifier))
        target = withExtension(path.resolve(path.dirname(parent), specifier))
      return nextResolve(target ? pathToFileURL(target).href : specifier, context)
    },
  })
}
