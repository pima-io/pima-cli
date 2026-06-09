import {Flags} from '@oclif/core'
import {BaseCommand} from '../../lib/base.js'
import {flatTeamPerformanceRows, teamPerformance, type TeamPerformanceParams} from '../../lib/metrics.js'

export default class MetricsTeam extends BaseCommand {
  static description = 'Fetch optimized retail team performance metrics by LocationGroup, location, city, or state. Requires scope: reports:read.'
  static examples = [
    '<%= config.bin %> metrics team --today --group-by location_group --limit 3',
    '<%= config.bin %> metrics team --today --q tshirts --sort units --group-by all',
    '<%= config.bin %> metrics team --today --min-sales 1000 --max-upt 1.5 --group-by all',
    '<%= config.bin %> metrics team --date 2026-06-06 --group-by city --sort sales_per_hour',
    '<%= config.bin %> metrics team --from 2026-06-01 --to 2026-06-08 --location-group-id 12 --group-by location',
  ]

  static flags = {
    today: Flags.boolean({description: 'Use today as the date'}),
    date: Flags.string({description: 'Single date, YYYY-MM-DD'}),
    from: Flags.string({description: 'Start date, YYYY-MM-DD'}),
    to: Flags.string({description: 'End date, YYYY-MM-DD'}),
    channel: Flags.string({options: ['pos', 'online', 'all'], default: 'pos', description: 'Sales channel'}),
    'location-id': Flags.string({description: 'Location id'}),
    'location-ids': Flags.string({description: 'Comma-separated location ids'}),
    location: Flags.string({description: 'Location name, reporting name, or short name'}),
    'short-name': Flags.string({description: 'Location short name'}),
    'location-group': Flags.string({description: 'Pima LocationGroup name, short name, or id'}),
    'location-group-id': Flags.string({description: 'Pima LocationGroup id'}),
    'location-group-ids': Flags.string({description: 'Comma-separated Pima LocationGroup ids'}),
    region: Flags.string({description: 'Legacy alias for a Pima LocationGroup name'}),
    city: Flags.string({description: 'Location city'}),
    state: Flags.string({description: 'Location state abbreviation'}),
    'all-pos': Flags.boolean({description: 'Restrict to all POS locations'}),
    gender: Flags.string({description: 'Optional gender filter (m, w, u)'}),
    q: Flags.string({description: 'Product search, e.g. tshirts, tees, sku, style, category'}),
    sku: Flags.string({description: 'SKU name, UPC, legacy SKU, product, or style search'}),
    'sku-id': Flags.string({description: 'SKU id'}),
    'sku-ids': Flags.string({description: 'Comma-separated SKU ids'}),
    product: Flags.string({description: 'Product or style search'}),
    'product-id': Flags.string({description: 'Product id'}),
    'product-ids': Flags.string({description: 'Comma-separated product ids'}),
    style: Flags.string({description: 'Business Style / ProductLine search'}),
    'product-line': Flags.string({description: 'Business Style / ProductLine search'}),
    'product-line-id': Flags.string({description: 'ProductLine id'}),
    'product-line-ids': Flags.string({description: 'Comma-separated ProductLine ids'}),
    category: Flags.string({description: 'Category name'}),
    'category-id': Flags.string({description: 'Category id'}),
    'category-ids': Flags.string({description: 'Comma-separated category ids'}),
    'product-type': Flags.string({description: 'Product type name'}),
    'product-type-id': Flags.string({description: 'Product type id'}),
    'product-type-ids': Flags.string({description: 'Comma-separated product type ids'}),
    'group-by': Flags.string({
      options: ['location_group', 'region', 'location', 'city', 'state', 'all'],
      default: 'location_group',
      description: 'Outer grouping for ranked team members. location_group uses Pima LocationGroup; city/state/location are ad-hoc dimensions.',
    }),
    sort: Flags.string({
      options: [
        'net_sales',
        'sales',
        'sold',
        'returns',
        'sales_per_hour',
        'net_sales_per_hour',
        'orders',
        'units',
        'hours',
        'aov',
        'auv',
        'upt',
      ],
      default: 'net_sales',
      description: 'Ranking metric',
    }),
    limit: Flags.integer({description: 'Maximum users per group to return, up to the server limit'}),
    'min-sales': Flags.string({description: 'Only include users with at least this gross sales amount'}),
    'min-net-sales': Flags.string({description: 'Only include users with at least this net sales amount'}),
    'max-upt': Flags.string({description: 'Only include users at or below this UPT'}),
    'min-units': Flags.string({description: 'Only include users with at least this many units'}),
    'min-orders': Flags.string({description: 'Only include users with at least this many orders'}),
    refresh: Flags.boolean({description: 'Force recalculation of stored daily user metrics'}),
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(MetricsTeam)
    const date = flags.today ? today() : flags.date

    try {
      const payload = await teamPerformance(await this.client(flags.host), paramsFromFlags(flags, date))
      if (flags.json) {
        this.log(JSON.stringify(payload, null, 2))
        return
      }

      this.printList(flatTeamPerformanceRows(payload), columnsFor(payload.group_by), flags)
    } catch (error) {
      this.fail(error)
    }
  }
}

function paramsFromFlags(flags: Record<string, any>, date?: string): TeamPerformanceParams {
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
    region: flags.region,
    city: flags.city,
    state: flags.state,
    all_pos: flags['all-pos'],
    gender: flags.gender,
    q: flags.q,
    sku: flags.sku,
    sku_id: flags['sku-id'],
    sku_ids: flags['sku-ids'],
    product: flags.product,
    product_id: flags['product-id'],
    product_ids: flags['product-ids'],
    style: flags.style,
    product_line: flags['product-line'],
    product_line_id: flags['product-line-id'],
    product_line_ids: flags['product-line-ids'],
    category: flags.category,
    category_id: flags['category-id'],
    category_ids: flags['category-ids'],
    product_type: flags['product-type'],
    product_type_id: flags['product-type-id'],
    product_type_ids: flags['product-type-ids'],
    group_by: flags['group-by'],
    sort: flags.sort,
    limit: flags.limit,
    min_sales: flags['min-sales'],
    min_net_sales: flags['min-net-sales'],
    max_upt: flags['max-upt'],
    min_units: flags['min-units'],
    min_orders: flags['min-orders'],
    refresh: flags.refresh,
  }
}

function columnsFor(groupBy: string) {
  return [
    {key: groupBy, label: groupLabel(groupBy)},
    {key: 'rank', label: '#'},
    {key: 'team_member', label: 'Team Member'},
    {key: 'net_sales', label: 'Net Sales'},
    {key: 'sales', label: 'Sales'},
    {key: 'returns', label: 'Returns'},
    {key: 'orders', label: 'Orders'},
    {key: 'units', label: 'Units'},
    {key: 'hours', label: 'Hours'},
    {key: 'sales_per_hour', label: 'SPH'},
    {key: 'net_sales_per_hour', label: 'Net SPH'},
    {key: 'aov', label: 'AOV'},
    {key: 'auv', label: 'AUV'},
    {key: 'upt', label: 'UPT'},
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

function today(): string {
  return new Date().toISOString().slice(0, 10)
}
