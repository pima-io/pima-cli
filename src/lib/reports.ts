export const SALES_REPORT_REPLACEMENT_MESSAGE =
  '`sales_report` JSON only returns the legacy UI/build scaffold and does not expose computed sales totals. Use `pima metrics sales --today --channel pos --json`, or `pima metrics sales --from YYYY-MM-DD --to YYYY-MM-DD --channel pos --json` for dated sales answers.'

export function assertSupportedReportPayload(name: string): void {
  if (name.trim().toLowerCase() === 'sales_report') {
    const error = new Error(SALES_REPORT_REPLACEMENT_MESSAGE)
    ;(error as Error & {exitCode?: number}).exitCode = 5
    throw error
  }
}
