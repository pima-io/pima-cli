import {Args, Command, Flags} from '@oclif/core'
import {filterQuestionRecipes, loadQuestionCatalog, type QuestionRecipe} from '../lib/questions.js'

export default class Questions extends Command {
  static description = 'Show example PIMA business questions and the optimized commands agents should use.'

  static examples = [
    '<%= config.bin %> questions',
    '<%= config.bin %> questions "who sold tshirts"',
    '<%= config.bin %> questions --category team --json',
    '<%= config.bin %> questions --match "top selling styles"',
  ]

  static args = {
    query: Args.string({description: 'Optional text to match against questions and command guidance'}),
  }

  static flags = {
    category: Flags.string({char: 'c', description: 'Filter to a category, e.g. sales, product, team, inventory'}),
    match: Flags.string({char: 'm', description: 'Text to match against questions and command guidance'}),
    json: Flags.boolean({description: 'Output structured JSON for agents'}),
  }

  async run(): Promise<void> {
    const {args, flags} = await this.parse(Questions)
    const catalog = await loadQuestionCatalog()
    const match = flags.match ?? args.query
    const recipes = filterQuestionRecipes(catalog.recipes, {category: flags.category, match})

    if (flags.json) {
      this.log(
        JSON.stringify(
          {
            source: catalog.source,
            count: recipes.length,
            total: catalog.recipes.length,
            recipes,
          },
          null,
          2,
        ),
      )
      return
    }

    this.log(renderQuestions(recipes, {match, category: flags.category, total: catalog.recipes.length}))
  }
}

function renderQuestions(recipes: QuestionRecipe[], opts: {match?: string; category?: string; total: number}): string {
  const out: string[] = ['PIMA question catalog', '']
  out.push('Use these optimized commands before paging raw orders, units, or generic resources.')
  out.push('For the full agent briefing, run `pima skill question-catalog` or `pima skill --all`.')
  if (opts.match || opts.category) {
    const filters = [opts.match ? `match="${opts.match}"` : null, opts.category ? `category="${opts.category}"` : null].filter(Boolean)
    out.push(`Showing ${recipes.length} of ${opts.total} recipes (${filters.join(', ')}).`)
  }

  if (recipes.length === 0) {
    out.push('', 'No matching recipes. Try `pima questions`, `pima skill question-catalog`, or `pima resources`.')
    return out.join('\n')
  }

  let category = ''
  for (const recipe of recipes) {
    if (recipe.category !== category) {
      category = recipe.category
      out.push('', `## ${category}`)
    }

    out.push(`- "${recipe.question}"`)
    if (recipe.commands.length > 0) {
      for (const command of recipe.commands) out.push(`  ${command}`)
    } else if (recipe.guidance) {
      out.push(`  ${recipe.guidance}`)
    }
  }

  return out.join('\n')
}

