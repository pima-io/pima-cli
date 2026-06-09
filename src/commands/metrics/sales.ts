import {Flags} from '@oclif/core'
import {BaseCommand} from '../../lib/base.js'
import {flatSalesSummary, flatSalesSummaryGroups, salesSummary} from '../../lib/metrics.js'

export default class MetricsSales extends BaseCommand {
  static description = 'Fetch optimized sales metrics. Requires scope: reports:read.'
  static examples = [
    '<%= config.bin %> metrics sales --today --channel pos',
    '<%= config.bin %> metrics sales --today --channel pos --group-by location_group',
    '<%= config.bin %> metrics sales --today --channel pos --city "Los Angeles"',
    '<%= config.bin %> metrics sales --today --location-group-id 12 --group-by location_group',
    '<%= config.bin %> metrics sales --from 2026-06-01 --to 2026-06-08 --channel pos --compare previous_week',
    '<%= config.bin %> metrics sales --from 2026-06-01 --to 2026-06-08 --channel pos --state CA',
  ]

  static flags = {
    today: Flags.boolean({description: 'Use today as the date'}),
    date: Flags.string({description: 'Single date, YYYY-MM-DD'}),
    from: Flags.string({description: 'Start date, YYYY-MM-DD'}),
    to: Flags.string({description: 'End date, YYYY-MM-DD'}),
    compare: Flags.string({options: ['previous_period', 'previous_week', 'previous_year'], description: 'Comparison range'}),
    'compare-from': Flags.string({description: 'Explicit comparison start date, YYYY-MM-DD'}),
    'compare-to': Flags.string({description: 'Explicit comparison end date, YYYY-MM-DD'}),
    channel: Flags.string({options: ['pos', 'online', 'all'], default: 'all', description: 'Sales channel'}),
    'location-id': Flags.string({description: 'Location id'}),
    'location-ids': Flags.string({description: 'Comma-separated location ids'}),
    location: Flags.string({description: 'Location name, reporting name, or short name'}),
    'short-name': Flags.string({description: 'Location short name'}),
    'location-group': Flags.string({description: 'Pima LocationGroup name, short name, or id'}),
    'location-group-id': Flags.string({description: 'Pima LocationGroup id'}),
    'location-group-ids': Flags.string({description: 'Comma-separated Pima LocationGroup ids'}),
    city: Flags.string({description: 'Location city'}),
    state: Flags.string({description: 'Location state abbreviation'}),
    'all-pos': Flags.boolean({description: 'Restrict to all POS locations'}),
    gender: Flags.string({description: 'Optional gender filter (m, w, u)'}),
    'group-by': Flags.string({
      options: ['location_group', 'region', 'location', 'city', 'state', 'all'],
      description: 'Group sales totals. location_group uses Pima LocationGroup; city/state/location are ad-hoc dimensions.',
    }),
    sort: Flags.string({
      options: ['net_sales', 'sales', 'total_revenue', 'plan_attainment', 'orders', 'units', 'aov', 'auv', 'upt', 'visits', 'conversion_rate', 'sales_per_hour', 'inventory_on_hand'],
      default: 'net_sales',
      description: 'Ranking metric for grouped output',
    }),
    'under-plan': Flags.boolean({description: 'Only include groups below net sales plan'}),
    'min-sales': Flags.string({description: 'Only include groups with at least this net sales amount'}),
    'max-upt': Flags.string({description: 'Only include groups at or below this UPT'}),
    refresh: Flags.boolean({description: 'Force recalculation of stored daily metrics'}),
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(MetricsSales)
    const date = flags.today ? today() : flags.date

    try {
      const summary = await salesSummary(await this.client(flags.host), {
        date,
        from: flags.from,
        to: flags.to,
        compare: flags.compare,
        compare_from: flags['compare-from'],
        compare_to: flags['compare-to'],
        channel: flags.channel,
        location_id: flags['location-id'],
        location_ids: flags['location-ids'],
        location: flags.location,
        short_name: flags['short-name'],
        location_group: flags['location-group'],
        location_group_id: flags['location-group-id'],
        location_group_ids: flags['location-group-ids'],
        city: flags.city,
        state: flags.state,
        all_pos: flags['all-pos'],
        gender: flags.gender,
        group_by: flags['group-by'],
        sort: flags.sort,
        under_plan: flags['under-plan'],
        min_sales: flags['min-sales'],
        max_upt: flags['max-upt'],
        refresh: flags.refresh,
      })

      if (flags.json) {
        this.log(JSON.stringify(summary, null, 2))
      } else if (flags['group-by']) {
        this.printList(flatSalesSummaryGroups(summary), columnsFor(flags['group-by']), flags)
      } else {
        this.printRecord(flatSalesSummary(summary), flags)
      }
    } catch (error) {
      this.fail(error)
    }
  }
}

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

function columnsFor(groupBy: string) {
  return [
    {key: groupBy, label: groupLabel(groupBy)},
    {key: 'net_sales', label: 'Net Sales'},
    {key: 'sales', label: 'Sales'},
    {key: 'total_revenue', label: 'Total Revenue'},
    {key: 'net_plan', label: 'Net Plan'},
    {key: 'plan_attainment', label: 'Plan %'},
    {key: 'orders', label: 'Orders'},
    {key: 'units', label: 'Units'},
    {key: 'aov', label: 'AOV'},
    {key: 'upt', label: 'UPT'},
    {key: 'visits', label: 'Visits'},
    {key: 'conversion_rate', label: 'Conv %'},
    {key: 'sales_per_hour', label: 'SPH'},
  ]
}

function groupLabel(groupBy: string): string {
  switch (groupBy) {
    case 'location_group':
    case 'region':
      return 'Location Group'
    case 'location':
      return 'Location'
    case 'city':
      return 'City'
    case 'state':
      return 'State'
    default:
      return 'Group'
  }
}
