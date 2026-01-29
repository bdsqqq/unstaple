import * as fs from "fs"
import * as path from "path"
import type { StorageBackend } from "../types.js"

export class LocalStorage implements StorageBackend {
  private baseDir: string

  constructor(baseDir: string) {
    this.baseDir = baseDir
    if (!fs.existsSync(baseDir)) {
      fs.mkdirSync(baseDir, { recursive: true })
    }
  }

  async exists(filename: string): Promise<boolean> {
    const filepath = path.join(this.baseDir, filename)
    return fs.existsSync(filepath)
  }

  async write(filename: string, data: Uint8Array): Promise<string> {
    const filepath = path.join(this.baseDir, filename)
    fs.writeFileSync(filepath, data)
    return filepath
  }

  async rename(oldPath: string, newPath: string): Promise<string> {
    const oldFilepath = oldPath.startsWith(this.baseDir) ? oldPath : path.join(this.baseDir, oldPath)
    const newFilepath = path.join(this.baseDir, newPath)

    fs.renameSync(oldFilepath, newFilepath)
    return newFilepath
  }

  async *scan(pattern?: string): AsyncIterable<string> {
    const files = fs.readdirSync(this.baseDir)
    for (const file of files) {
      if (!pattern || file.includes(pattern)) {
        yield path.join(this.baseDir, file)
      }
    }
  }
}
