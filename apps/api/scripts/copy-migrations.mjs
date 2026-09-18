// tsc копирует только .ts, поэтому .sql-файлы нужно положить в dist отдельно.
// Без этого шага собранный образ падает на старте: миграций рядом с dist нет.
import { cpSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const apiRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')

cpSync(path.join(apiRoot, 'src/migrations'), path.join(apiRoot, 'dist/migrations'), { recursive: true })
