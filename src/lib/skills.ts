import {readdir, readFile} from 'node:fs/promises'
import {fileURLToPath} from 'node:url'
import {dirname, join} from 'node:path'

// Skills ship as markdown in /skills with frontmatter. They give agents deep
// domain understanding — distinct from `--help`, which is syntax.
const SKILLS_DIR = join(dirname(dirname(dirname(fileURLToPath(import.meta.url)))), 'skills')

export interface Skill {
  name: string
  description: string
  whenToUse?: string
  scopes: string[]
  related: string[]
  body: string
}

export async function listSkills(): Promise<Skill[]> {
  const files = (await readdir(SKILLS_DIR)).filter((f) => f.endsWith('.md'))
  const skills = await Promise.all(files.map((f) => loadSkill(f.replace(/\.md$/, ''))))
  return skills.filter((s): s is Skill => s !== null).sort((a, b) => a.name.localeCompare(b.name))
}

export async function loadSkill(name: string): Promise<Skill | null> {
  try {
    const raw = await readFile(join(SKILLS_DIR, `${name}.md`), 'utf8')
    return parse(name, raw)
  } catch {
    return null
  }
}

function parse(name: string, raw: string): Skill {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)
  const fm: Record<string, string> = {}
  let body = raw
  if (match) {
    body = match[2].trim()
    for (const line of match[1].split('\n')) {
      const m = line.match(/^(\w+):\s*(.*)$/)
      if (m) fm[m[1]] = m[2].trim()
    }
  }
  return {
    name: fm.name ?? name,
    description: fm.description ?? '',
    whenToUse: fm.when_to_use,
    scopes: parseList(fm.scopes),
    related: parseList(fm.related),
    body,
  }
}

function parseList(v?: string): string[] {
  if (!v) return []
  return v
    .replace(/^\[|\]$/g, '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}
