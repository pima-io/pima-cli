import {describe, it} from 'node:test'
import assert from 'node:assert/strict'
import {assertSupportedReportPayload, SALES_REPORT_REPLACEMENT_MESSAGE} from '../src/lib/reports.js'

describe('report helpers', () => {
  it('rejects the legacy sales report scaffold with a metrics replacement', () => {
    assert.throws(
      () => assertSupportedReportPayload('sales_report'),
      (error: any) => error.message === SALES_REPORT_REPLACEMENT_MESSAGE && error.exitCode === 5,
    )
  })

  it('allows other legacy report payloads', () => {
    assert.doesNotThrow(() => assertSupportedReportPayload('inventory_on_hand_report'))
  })
})
