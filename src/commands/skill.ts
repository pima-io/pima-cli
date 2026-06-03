import {Args, Command, Flags} from '@oclif/core'
import {listSkills, loadSkill} from '../lib/skills.js'
import {fetchManifest} from '../lib/manifest.js'
import {renderResourcesBriefing} from '../lib/manifest-render.js'

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
    host: Flags.string({description: 'PIMA host URL (for live skills like `resources`)'}),
    refresh: Flags.boolean({description: 'Bypass the manifest cache (live skills)'}),
  }

  async run(): Promise<void> {
    const {args, flags} = await this.parse(Skill)

    // `resources` is a LIVE skill: an agent briefing rendered from the server's
    // API manifest rather than a static markdown file.
    if (args.name === 'resources') {
      const manifest = await fetchManifest({host: flags.host, refresh: flags.refresh})
      this.log(flags.json ? JSON.stringify(manifest, null, 2) : renderResourcesBriefing(manifest))
      return
    }

    const skills = await listSkills()

    if (flags.all) {
      if (flags.json) return void this.log(JSON.stringify(skills, null, 2))
      return void this.log(skills.map((s) => `# ${s.name}\n\n${s.body}`).join('\n\n---\n\n'))
    }

    if (!args.name) {
      // The full self-onboarding menu: EVERY static skill from the loader plus
      // the live `resources` skill, then a single "Go deeper" footer. An agent
      // that runs `pima skill` once knows everything it can learn.
      const RESOURCES_DESC = 'Live agent briefing of the full resource surface (from the API manifest)'
      if (flags.json) {
        const entries = [
          ...skills.map(({body, ...m}) => m),
          {name: 'resources', description: RESOURCES_DESC, scopes: [], related: ['data-model', 'automation'], live: true},
        ]
        return void this.log(JSON.stringify(entries, null, 2))
      }

      this.log('New here? Start with `pima skill getting-started`.\n')
      this.log('Available skills (run `pima skill <name>` for the full text):\n')

      const width = Math.max(...skills.map((s) => s.name.length), 'resources'.length)
      for (const s of skills) this.log(`  ${s.name.padEnd(width)}  ${s.description}`)
      this.log(`  ${'resources'.padEnd(width)}  ${RESOURCES_DESC}`)

      this.log('\nGo deeper:')
      this.log('  pima skill <name>                 full text of one skill')
      this.log('  pima skill --all                  every skill concatenated (slurp once)')
      this.log('  pima resources                    every resource: domain, scopes, access, fields/filters/actions')
      this.log('  pima resource describe <name>     full contract for one resource (search, fields, actions, paths)')
      this.log('  MCP equivalents                   skill://<name> resources, the manifest://resources resource,')
      this.log('                                    and the pima_describe / pima_resources tools')
      return
    }

    const skill = await loadSkill(args.name)
    if (!skill) this.error(`Unknown skill: ${args.name}. Run \`pima skill\` to list them.`, {exit: 4})
    this.log(flags.json ? JSON.stringify(skill, null, 2) : skill.body)
  }
}
