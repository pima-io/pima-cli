import {listSkills} from './skills.js'
import {ALL_SCOPES} from './scopes.js'

// Guards that skills don't drift: every scope a skill names must be a real
// scope, and every skill must have a description. Run via `npm run lint:skills`.
const skills = await listSkills()
const valid = new Set<string>(ALL_SCOPES)
let problems = 0

for (const skill of skills) {
  if (!skill.description) {
    console.error(`skill "${skill.name}": missing description`)
    problems++
  }
  for (const scope of skill.scopes) {
    if (!valid.has(scope)) {
      console.error(`skill "${skill.name}": unknown scope "${scope}"`)
      problems++
    }
  }
}

console.log(`Checked ${skills.length} skill(s); ${problems} problem(s).`)
if (problems > 0) process.exit(1)
