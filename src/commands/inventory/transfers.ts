import {Flags} from '@oclif/core'
import {BaseCommand} from '../../lib/base.js'
import {inventoryTransfers, type InventoryTransfersParams} from '../../lib/inventory.js'

export default class InventoryTransfers extends BaseCommand {
  static description = 'Fetch transfer rows grouped by transfer and SKU. Requires scope: transfers:read.'
  static examples = [
    '<%= config.bin %> inventory transfers --sku BMSKUJY3 --short-name POS --direction inbound',
    '<%= config.bin %> inventory transfers --product "Field Spec" --all-pos --status transfering',
    '<%= config.bin %> inventory transfers --category Shirts --state CA --channel pos --json',
  ]

  static flags = {
    q: Flags.string({description: 'SKU, UPC, legacy SKU, product, or product-line search'}),
    sku: Flags.string({description: 'SKU name, UPC, legacy SKU, product, or product-line search'}),
    'sku-id': Flags.string({description: 'SKU id'}),
    'sku-ids': Flags.string({description: 'Comma-separated SKU ids'}),
    product: Flags.string({description: 'Product or product-line search'}),
    'product-id': Flags.string({description: 'Product id'}),
    'product-ids': Flags.string({description: 'Comma-separated product ids'}),
    category: Flags.string({description: 'Category name'}),
    'category-id': Flags.string({description: 'Category id'}),
    'category-ids': Flags.string({description: 'Comma-separated category ids'}),
    gender: Flags.string({options: ['m', 'w', 'u'], description: 'Product gender filter'}),
    'location-id': Flags.string({description: 'Location id'}),
    'location-ids': Flags.string({description: 'Comma-separated location ids'}),
    location: Flags.string({description: 'Location name, reporting name, or short name'}),
    'short-name': Flags.string({description: 'Location short name'}),
    'location-group': Flags.string({description: 'Location group name'}),
    city: Flags.string({description: 'Location city'}),
    state: Flags.string({description: 'Location state abbreviation'}),
    channel: Flags.string({options: ['pos', 'online', 'all'], default: 'all', description: 'Location channel'}),
    'all-pos': Flags.boolean({description: 'Restrict to all POS locations'}),
    direction: Flags.string({options: ['inbound', 'outbound', 'both'], default: 'both', description: 'Transfer direction relative to selected locations'}),
    status: Flags.string({description: 'Transfer status or comma-separated statuses'}),
    limit: Flags.integer({description: 'Maximum SKUs to resolve, up to the server limit'}),
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(InventoryTransfers)

    try {
      const payload = await inventoryTransfers(await this.client(flags.host), paramsFromFlags(flags))
      if (flags.json) {
        this.log(JSON.stringify(payload, null, 2))
        return
      }

      this.printList(payload.rows, payload.resource.columns, flags)
    } catch (error) {
      this.fail(error)
    }
  }
}

function paramsFromFlags(flags: Record<string, any>): InventoryTransfersParams {
  return {
    q: flags.q,
    sku: flags.sku,
    sku_id: flags['sku-id'],
    sku_ids: flags['sku-ids'],
    product: flags.product,
    product_id: flags['product-id'],
    product_ids: flags['product-ids'],
    category: flags.category,
    category_id: flags['category-id'],
    category_ids: flags['category-ids'],
    gender: flags.gender,
    location_id: flags['location-id'],
    location_ids: flags['location-ids'],
    location: flags.location,
    short_name: flags['short-name'],
    location_group: flags['location-group'],
    city: flags.city,
    state: flags.state,
    channel: flags.channel,
    all_pos: flags['all-pos'],
    direction: flags.direction,
    status: flags.status,
    limit: flags.limit,
  }
}
