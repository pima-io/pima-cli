import {Flags} from '@oclif/core'
import {BaseCommand} from '../../lib/base.js'
import {inventoryFulfillmentRecommendations, type InventoryFulfillmentParams} from '../../lib/inventory.js'

export default class InventoryFulfillment extends BaseCommand {
  static description = 'Fetch fulfillment location recommendations for a SKU or order item. Requires inventory:read, plus orders:read with order items.'
  static examples = [
    '<%= config.bin %> inventory fulfillment --sku BMSKUJY3 --city "Los Angeles" --channel pos',
    '<%= config.bin %> inventory fulfillment --order-item-id 12345 --all-pos',
    '<%= config.bin %> inventory fulfillment --q tshirts --location-group "California Stores"',
  ]

  static flags = {
    'order-item-id': Flags.string({description: 'Order item id to evaluate for rerouting'}),
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
    'location-group': Flags.string({description: 'Pima LocationGroup name, short name, or id'}),
    'location-group-id': Flags.string({description: 'Pima LocationGroup id'}),
    'location-group-ids': Flags.string({description: 'Comma-separated Pima LocationGroup ids'}),
    city: Flags.string({description: 'Location city'}),
    state: Flags.string({description: 'Location state abbreviation'}),
    channel: Flags.string({options: ['pos', 'online', 'all'], default: 'pos', description: 'Location channel'}),
    'all-pos': Flags.boolean({description: 'Restrict to all POS locations'}),
    'include-zero': Flags.boolean({description: 'Include locations with no sellable units'}),
    limit: Flags.integer({description: 'Maximum SKUs to resolve, up to the server limit'}),
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(InventoryFulfillment)

    try {
      const payload = await inventoryFulfillmentRecommendations(await this.client(flags.host), paramsFromFlags(flags))
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

function paramsFromFlags(flags: Record<string, any>): InventoryFulfillmentParams {
  return {
    order_item_id: flags['order-item-id'],
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
    location_group_id: flags['location-group-id'],
    location_group_ids: flags['location-group-ids'],
    city: flags.city,
    state: flags.state,
    channel: flags.channel,
    all_pos: flags['all-pos'],
    include_zero: flags['include-zero'],
    limit: flags.limit,
  }
}
