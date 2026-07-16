import {Flags} from '@oclif/core'
import {BaseCommand} from '../../lib/base.js'
import {filterMetabaseReports, metabaseReports} from '../../lib/metabase-reports.js'

export default class MetabaseReports extends BaseCommand {
  static description = 'List canonical Metabase equivalents and reusable building blocks for built-in PIMA reports.'

  static examples = [
    '<%= config.bin %> metabase reports',
    '<%= config.bin %> metabase reports --available',
    '<%= config.bin %> metabase reports --match fleet --json',
    '<%= config.bin %> metabase reports --category product_merchandising',
  ]

  static flags = {
    ...BaseCommand.baseFlags,
    match: Flags.string({description: 'Match report ids, titles, categories, or building blocks'}),
    category: Flags.string({description: 'Filter to one report category'}),
    available: Flags.boolean({description: 'Show only reports with a mapped Metabase equivalent'}),
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(MetabaseReports)
    try {
      const reports = filterMetabaseReports(await metabaseReports(await this.client(flags.host)), flags)
      if (flags.json) {
        this.log(JSON.stringify(reports, null, 2))
        return
      }

      this.printList(
        reports.map((report) => ({
          id: report.id,
          title: report.title,
          category: report.category,
          availability: report.availability,
          filters: String(report.filters.length),
          blocks: String(report.building_blocks.length),
        })),
        [
          {key: 'id', label: 'Report'},
          {key: 'title', label: 'Title'},
          {key: 'category', label: 'Category'},
          {key: 'availability', label: 'Metabase'},
          {key: 'filters', label: '#Filters'},
          {key: 'blocks', label: '#Blocks'},
        ],
        flags,
      )
    } catch (error) {
      this.fail(error)
    }
  }
}
