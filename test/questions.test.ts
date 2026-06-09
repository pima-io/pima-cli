import {describe, it} from 'node:test'
import assert from 'node:assert/strict'
import {filterQuestionRecipes, parseQuestionCatalog} from '../src/lib/questions.js'

describe('question catalog', () => {
  const markdown = `
# Question catalog

Intro text.

## Team Performance

- "Who sold the most tshirts today?"
  Use \`pima metrics team --today --q tshirts --sort units --group-by all\`.
- "Who had the highest sales per hour this week?"
  Use \`pima metrics team --from <week-start> --to <week-end> --group-by all --sort sales_per_hour\`.

## Inventory

- "Which stores are low on best-selling SKUs?"
  Use \`pima inventory risk --all-pos --at-risk\`.
`

  it('parses questions, categories, guidance, and command mappings', () => {
    const recipes = parseQuestionCatalog(markdown)

    assert.equal(recipes.length, 3)
    assert.deepEqual(recipes[0], {
      category: 'Team Performance',
      question: 'Who sold the most tshirts today?',
      commands: ['pima metrics team --today --q tshirts --sort units --group-by all'],
      guidance: 'Use `pima metrics team --today --q tshirts --sort units --group-by all`.',
    })
  })

  it('filters by tokenized match and category', () => {
    const recipes = parseQuestionCatalog(markdown)

    assert.deepEqual(
      filterQuestionRecipes(recipes, {match: 'who tshirts'}).map((r) => r.question),
      ['Who sold the most tshirts today?'],
    )
    assert.deepEqual(
      filterQuestionRecipes(recipes, {category: 'inventory'}).map((r) => r.question),
      ['Which stores are low on best-selling SKUs?'],
    )
  })
})

