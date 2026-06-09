import {loadSkill} from './skills.js'

export interface QuestionRecipe {
  category: string
  question: string
  commands: string[]
  guidance: string
}

export interface QuestionCatalog {
  source: string
  recipes: QuestionRecipe[]
}

export async function loadQuestionCatalog(): Promise<QuestionCatalog> {
  const skill = await loadSkill('question-catalog')
  if (!skill) throw new Error('The question catalog skill is missing.')

  return {
    source: 'skill://question-catalog',
    recipes: parseQuestionCatalog(skill.body),
  }
}

export function parseQuestionCatalog(markdown: string): QuestionRecipe[] {
  const recipes: QuestionRecipe[] = []
  let category = ''
  let current: QuestionRecipe | null = null

  for (const rawLine of markdown.split('\n')) {
    const line = rawLine.trimEnd()
    const heading = line.match(/^##\s+(.+)$/)
    if (heading) {
      category = heading[1]
      current = null
      continue
    }

    const question = line.match(/^-\s+"(.+)"$/)
    if (question && category) {
      current = {category, question: question[1], commands: [], guidance: ''}
      recipes.push(current)
      continue
    }

    if (!current || !line.trim()) continue

    const text = line.trim()
    current.guidance = current.guidance ? `${current.guidance} ${text}` : text
    for (const match of text.matchAll(/`([^`]*\bpima\s+[^`]*)`/g)) current.commands.push(match[1])
  }

  return recipes
}

export function filterQuestionRecipes(recipes: QuestionRecipe[], opts: {match?: string; category?: string} = {}): QuestionRecipe[] {
  const category = opts.category?.trim().toLowerCase()
  const terms = (opts.match ?? '')
    .toLowerCase()
    .split(/\s+/)
    .map((term) => term.trim())
    .filter(Boolean)

  return recipes.filter((recipe) => {
    if (category && !recipe.category.toLowerCase().includes(category)) return false
    if (terms.length === 0) return true

    const haystack = [recipe.category, recipe.question, recipe.guidance, ...recipe.commands].join(' ').toLowerCase()
    return terms.every((term) => haystack.includes(term))
  })
}

