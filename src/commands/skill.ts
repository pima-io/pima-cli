import {Args, Command, Flags} from '@oclif/core'
import {listSkills, loadSkill} from '../lib/skills.js'

// `pima skill` — deep, agent-oriented domain understanding. Distinct from
// `--help` (syntax). Skills ship as version-matched markdown in /skills.
export default class Skill extends Command {
  static description = 'Show agent skills: deep domain/workflow understanding beyond command syntax.'

  static examples = [
    '<%= config.bin %> skill',
    '<%= config.bin %> skill data-model',
    '<%= config.bin %> skill --all',
    '<%= config.bin %> skill order-routing --json',
  ]

  static args = {
    name: Args.string({description: 'Skill name to display (omit to list all)'}),
  }

  static flags = {
    all: Flags.boolean({description: 'Print every skill, concatenated'}),
    json: Flags.boolean({description: 'Output as JSON'}),
  }

  async run(): Promise<void> {
    const {args, flags} = await this.parse(Skill)
    const skills = await listSkills()

    if (flags.all) {
      if (flags.json) return void this.log(JSON.stringify(skills, null, 2))
      return void this.log(skills.map((s) => `# ${s.name}\n\n${s.body}`).join('\n\n---\n\n'))
    }

    if (!args.name) {
      if (flags.json) return void this.log(JSON.stringify(skills.map(({body, ...m}) => m), null, 2))
      this.log('Available skills (run `pima skill <name>` for the full text):\n')
      for (const s of skills) this.log(`  ${s.name.padEnd(18)} ${s.description}`)
      this.log('\nNew here? Start with `pima skill getting-started`.')
      return
    }

    const skill = await loadSkill(args.name)
    if (!skill) this.error(`Unknown skill: ${args.name}. Run \`pima skill\` to list them.`, {exit: 4})
    this.log(flags.json ? JSON.stringify(skill, null, 2) : skill.body)
  }
}
