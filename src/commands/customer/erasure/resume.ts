import ErasureSubmit from './submit.js'

export default class ErasureResume extends ErasureSubmit {
  static description = 'Resume the saved customer IDs and retry unfinished Shopify requests. Keeps successful results. Requires --yes.'
  static examples = ['<%= config.bin %> customer erasure resume preview.json --yes']
}
