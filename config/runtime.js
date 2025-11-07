import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { fileURLToPath } from 'node:url'
import fs from 'node:fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const resolveConfigModule = () => {
  const customPath = path.join(__dirname, 'config.js')
  if (fs.existsSync(customPath)) {
    return pathToFileURL(customPath).href
  }
  return pathToFileURL(path.join(__dirname, 'config.default.js')).href
}

const moduleUrl = resolveConfigModule()
const loaded = await import(moduleUrl)

export const Config = loaded.Config || loaded.default || loaded
export default Config
