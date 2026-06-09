import {Flags} from '@oclif/core'
import {BaseCommand} from '../../lib/base.js'
import {flatProductPerformanceRows, productPerformance, type ProductPerformanceParams} from '../../lib/metrics.js'

export default class MetricsProducts extends BaseCommand {
  static description = 'Fetch optimized product, SKU, and style performance metrics. Requires scope: reports:read.'
  static examples = [
    '<%= config.bin %> metrics products --date 2026-06-06 --location-ids 12,34 --group-by style',
    '<%= config.bin %> metrics products --today --group-by product_type --location-group-by city',
    '<%= config.bin %> metrics products --today --location-group-id 12 --group-by sku',
    '<%= config.bin %> metrics products --from 2026-05-01 --to 2026-05-31 --sort return_rate --min-units 10',
    '<%= config.bin %> metrics products --today --channel pos --city "Los Angeles" --group-by sku --limit 20',
    '<%= config.bin %> metrics products --from 2026-06-01 --to 2026-06-08 --state CA --group-by product --sort units',
  ]

  static flags = {
    today: Flags.boolean({description: 'Use today as the date'}),
    date: Flags.string({description: 'Single date, YYYY-MM-DD'}),
    from: Flags.string({description: 'Start date, YYYY-MM-DD'}),
    to: Flags.string({description: 'End date, YYYY-MM-DD'}),
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
      options: ['sku', 'product', 'style', 'product_line', 'category', 'product_type', 'gender'],
      default: 'sku',
      description: 'Breakdown grain. Use style for business Style/ProductLine.',
    }),
    'location-group-by': Flags.string({
      options: ['location_group', 'region', 'location', 'city', 'state', 'all'],
      description: 'Nest product rankings under a location grouping. location_group uses Pima LocationGroup; city/state/location are ad-hoc dimensions.',
    }),
    sort: Flags.string({
      options: ['revenue', 'net_revenue', 'units', 'returns', 'return_revenue', 'return_rate', 'auv'],
      default: 'revenue',
      description: 'Ranking metric',
    }),
    'min-units': Flags.integer({description: 'Only include groups with at least this many sold units'}),
    'min-revenue': Flags.string({description: 'Only include groups with at least this revenue amount'}),
    'min-return-rate': Flags.string({description: 'Only include groups at or above this return rate (0.25 or 25)'}),
    'max-return-rate': Flags.string({description: 'Only include groups at or below this return rate (0.25 or 25)'}),
    limit: Flags.integer({description: 'Maximum rows to return, up to the server limit'}),
    refresh: Flags.boolean({description: 'Force recalculation of stored daily SKU metrics'}),
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(MetricsProducts)
    const date = flags.today ? today() : flags.date

    try {
      const payload = await productPerformance(await this.client(flags.host), paramsFromFlags(flags, date))
      if (flags.json) {
        this.log(JSON.stringify(payload, null, 2))
        return
      }

      this.printList(flatProductPerformanceRows(payload), columnsFor(payload.group_by, payload.location_group_by), flags)
    } catch (error) {
      this.fail(error)
    }
  }
}

function paramsFromFlags(flags: Record<string, any>, date?: string): ProductPerformanceParams {
  return {
    date,
    from: flags.from,
    to: flags.to,
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
    location_group_by: flags['location-group-by'],
    sort: flags.sort,
    min_units: flags['min-units'],
    min_revenue: flags['min-revenue'],
    min_return_rate: flags['min-return-rate'],
    max_return_rate: flags['max-return-rate'],
    limit: flags.limit,
    refresh: flags.refresh,
  }
}

function columnsFor(groupBy: string, locationGroupBy?: string) {
  return [
    ...(locationGroupBy ? [{key: locationGroupBy, label: groupLabel(locationGroupBy)}] : []),
    {key: 'rank', label: '#'},
    {key: groupBy, label: groupLabel(groupBy)},
    {key: 'revenue', label: 'Revenue'},
    {key: 'net_revenue', label: 'Net Revenue'},
    {key: 'units', label: 'Units'},
    {key: 'returns', label: 'Returns'},
    {key: 'return_revenue', label: 'Return Revenue'},
    {key: 'return_rate', label: 'Return Rate'},
    {key: 'auv', label: 'AUV'},
  ]
}

function groupLabel(groupBy: string): string {
  switch (groupBy) {
    case 'sku':
      return 'SKU'
    case 'product':
      return 'Product'
    case 'style':
    case 'product_line':
      return 'Style'
    case 'product_type':
      return 'Product Type'
    case 'gender':
      return 'Gender'
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

function today(): string {
  return new Date().toISOString().slice(0, 10)
}
