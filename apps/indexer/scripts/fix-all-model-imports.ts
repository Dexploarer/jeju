#!/usr/bin/env bun
/**
 * Fix All Model Circular Dependencies
 *
 * This script processes all model files and replaces direct model imports
 * with lazy require() patterns to avoid circular dependency issues.
 */

import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, basename } from 'node:path'

const MODELS_DIR = join(import.meta.dir, '..', 'src', 'model', 'generated')

// Process a single model file
function processModelFile(filepath: string): boolean {
  const filename = basename(filepath)

  // Skip non-model files and already processed files
  if (
    filename.startsWith('_') ||
    filename === 'index.ts' ||
    filename === 'marshal.ts' ||
    filename === 'registry.ts' ||
    !filename.endsWith('.model.ts')
  ) {
    return false
  }

  let content = readFileSync(filepath, 'utf-8')

  // Check if already processed (has lazy model getters)
  if (content.includes('// Lazy model getters')) {
    console.log(`  [SKIP] ${filename} - already processed`)
    return false
  }

  // Find all model imports
  const modelImportRegex = /^import \{(\w+)\} from "\.\/(\w+)\.model"$/gm
  const modelImports: Array<{ fullMatch: string; className: string; moduleName: string }> = []

  let match
  while ((match = modelImportRegex.exec(content)) !== null) {
    modelImports.push({
      fullMatch: match[0],
      className: match[1],
      moduleName: match[2],
    })
  }

  if (modelImports.length === 0) {
    console.log(`  [SKIP] ${filename} - no model imports`)
    return false
  }

  console.log(`  [FIX]  ${filename} - ${modelImports.length} model imports`)

  // Generate type imports and lazy getters
  const typeImports = modelImports
    .map((m) => `import type {${m.className}} from "./${m.moduleName}.model"`)
    .join('\n')

  const lazyGetters = modelImports
    .map(
      (m) =>
        `const get${m.className} = () => require("./${m.moduleName}.model").${m.className}`,
    )
    .join('\n')

  // Replace direct imports with type imports
  for (const imp of modelImports) {
    content = content.replace(
      imp.fullMatch,
      `// Replaced: ${imp.fullMatch}`,
    )
  }

  // Find the first import statement to insert after decorators import
  const decoratorImportEnd = content.indexOf('@subsquid/typeorm-store"')
  if (decoratorImportEnd === -1) {
    console.error(`  [ERROR] ${filename} - no decorator import found`)
    return false
  }

  const insertPoint = content.indexOf('\n', decoratorImportEnd) + 1

  // Build the replacement section
  const newImports = `// Use type imports for TypeScript types, lazy require for decorators (avoids circular import)\n${typeImports}\n\n// Lazy model getters to avoid circular dependency at module load time\n${lazyGetters}\n`

  // Insert new imports
  content = content.slice(0, insertPoint) + newImports + content.slice(insertPoint)

  // Remove the old import lines (now commented)
  content = content.replace(/\/\/ Replaced: import \{.+\} from "\.\/\w+\.model"\n/g, '')

  // Replace decorator references: @ManyToOne_(() => ClassName, ...)
  // with: @ManyToOne_(getClassName, ...)
  for (const imp of modelImports) {
    // Replace () => ClassName with getClassName
    const arrowFnRegex = new RegExp(`\\(\\) => ${imp.className}\\b`, 'g')
    content = content.replace(arrowFnRegex, `get${imp.className}`)

    // For OneToMany with accessor function, we need to type the parameter
    // e.g., e => e.from becomes (e: ClassName) => e.from
    const oneToManyRegex = new RegExp(
      `@OneToMany_\\(get${imp.className}, (\\w+) => (\\w+)\\.`,
      'g',
    )
    content = content.replace(
      oneToManyRegex,
      `@OneToMany_(get${imp.className}, ($1: ${imp.className}) => $2.`,
    )
  }

  writeFileSync(filepath, content)
  return true
}

async function main(): Promise<void> {
  console.log('Fixing circular dependencies in all model files...\n')

  const files = readdirSync(MODELS_DIR).filter((f) => f.endsWith('.model.ts'))
  let fixed = 0

  for (const file of files) {
    if (processModelFile(join(MODELS_DIR, file))) {
      fixed++
    }
  }

  console.log(`\nFixed ${fixed} model files`)
}

main().catch(console.error)
