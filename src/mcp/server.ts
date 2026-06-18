import {McpServer, ResourceTemplate} from '@modelcontextprotocol/sdk/server/mcp.js'
import {z} from 'zod'
import {Client} from '../lib/client.js'
import {
  listResource,
  showResource,
  createResource,
  updateResource,
  destroyResource,
  memberAction,
  resourceHistory,
  listResourceComments,
  createResourceComment,
} from '../lib/resource.js'
import {listSkills, loadSkill} from '../lib/skills.js'
import {fetchManifest, findResource} from '../lib/manifest.js'
import {resolveHost} from '../lib/config.js'
import {resourceAppUrl} from '../lib/links.js'
import {fileFeedback, followUpFeedback, getFeedback, type FeedbackKind, type FeedbackPayload} from '../lib/feedback.js'
import {productPerformance, salesSummary, teamPerformance} from '../lib/metrics.js'
import {inventoryAvailability, inventoryFulfillmentRecommendations, inventoryRisk, inventoryTransfers} from '../lib/inventory.js'
import {filterQuestionRecipes, loadQuestionCatalog} from '../lib/questions.js'
import {assertSupportedReportPayload} from '../lib/reports.js'

export interface McpOptions {
  host?: string
  write?: boolean
}

type Content = {content: Array<{type: 'text'; text: string}>; isError?: boolean}

const ok = (data: unknown): Content => ({
  content: [{type: 'text', text: typeof data === 'string' ? data : JSON.stringify(data, null, 2)}],
})
const fail = (error: any): Content => ({
  content: [{type: 'text', text: `Error: ${error?.message ?? String(error)}`}],
  isError: true,
})

// Exposes PIMA over MCP for conversational agents. Tools reuse the same Client +
// resource layer as the CLI; the connected token's scopes bound everything. Read
// tools + skill resources are always on; write tools require `write: true`.
export function buildServer(opts: McpOptions = {}): McpServer {
  const server = new McpServer({name: 'pima', version: '0.1.0'})
  const client = () => Client.create({host: opts.host})

  // ---- Skills as resources (the agent's domain knowledge) ----
  server.registerResource(
    'skill',
    new ResourceTemplate('skill://{name}', {
      list: async () => ({
        resources: (await listSkills()).map((s) => ({
          uri: `skill://${s.name}`,
          name: s.name,
          description: s.description,
          mimeType: 'text/markdown',
        })),
      }),
    }),
    {title: 'PIMA skills', description: 'Deep domain knowledge: data model, routing, scopes, automation, recipes.'},
    async (uri, variables) => {
      const name = Array.isArray(variables.name) ? variables.name[0] : variables.name
      const skill = await loadSkill(String(name))
      if (!skill) throw new Error(`Unknown skill: ${name}`)
      return {contents: [{uri: uri.href, mimeType: 'text/markdown', text: skill.body}]}
    },
  )

  // ---- The API manifest as a resource (the full surface, on demand) ----
  server.registerResource(
    'manifest',
    'manifest://resources',
    {
      title: 'PIMA API manifest',
      description: 'The full resource surface: every resource with its scopes, search/filters, fields, and actions.',
      mimeType: 'application/json',
    },
    async (uri) => {
      const manifest = await fetchManifest({host: opts.host})
      return {contents: [{uri: uri.href, mimeType: 'application/json', text: JSON.stringify(manifest, null, 2)}]}
    },
  )

  // ---- Read tools ----
  server.registerTool(
    'pima_question_catalog',
    {
      description:
        'List example PIMA business questions and optimized command mappings. Call this before answering sales, product, team, inventory, routing, audit, or compound metric questions.',
      inputSchema: {
        match: z.string().optional().describe('Text to match against questions and guidance, e.g. "who sold tshirts"'),
        category: z.string().optional().describe('Category filter, e.g. sales, product, team, inventory'),
      },
    },
    async ({match, category}) => {
      try {
        const catalog = await loadQuestionCatalog()
        const recipes = filterQuestionRecipes(catalog.recipes, {match, category})
        return ok({source: catalog.source, count: recipes.length, total: catalog.recipes.length, recipes})
      } catch (error) {
        return fail(error)
      }
    },
  )

  server.registerTool(
    'pima_resources',
    {
      description:
        'List the full PIMA resource surface from the API manifest (id, domain, scopes, supported actions). Optionally filter by domain. Use this to discover what exists before pima_describe / pima_list.',
      inputSchema: {domain: z.string().optional().describe('Filter to one domain, e.g. orders, inventory')},
    },
    async ({domain}) => {
      try {
        const manifest = await fetchManifest({host: opts.host})
        const resources = (manifest.resources ?? []).filter((r) => !domain || r.domain === domain)
        return ok(
          resources.map((r) => ({
            id: r.id,
            domain: r.domain,
            scopes: r.scopes,
            supports: r.supports,
            capabilities: r.capabilities,
            summary: r.agent_docs?.summary,
          })),
        )
      } catch (error) {
        return fail(error)
      }
    },
  )

  server.registerTool(
    'pima_describe',
    {
      description:
        "Describe one PIMA resource from the API manifest: domain, scopes, search/filter params, create/update fields, and member/collection actions. Read this before pima_create / pima_action to know the contract.",
      inputSchema: {resource: z.string().describe('Resource id (singular or plural), e.g. orders, coupon')},
    },
    async ({resource}) => {
      try {
        const manifest = await fetchManifest({host: opts.host})
        const entry = findResource(manifest, resource)
        if (!entry) return fail(new Error(`Unknown resource: ${resource}`))
        return ok(entry)
      } catch (error) {
        return fail(error)
      }
    },
  )

  server.registerTool(
    'pima_list',
    {
      description:
        'List any PIMA resource (orders, skus, customers, transfers, purchase_orders, shipments, units, coupons, ...). Requires the resource domain :read scope. Read skill "data-model" first if unsure which resource.',
      inputSchema: {
        resource: z.string().describe('Resource name, e.g. orders, skus, customers'),
        q: z.string().optional().describe('Search query'),
        page: z.number().optional(),
        variant: z.string().optional().describe('View variant, e.g. shippable'),
      },
    },
    async ({resource, q, page, variant}) => {
      try {
        const {records} = await listResource(await client(), resource, {q, page, variant})
        return ok(records)
      } catch (error) {
        return fail(error)
      }
    },
  )

  server.registerTool(
    'pima_link',
    {
      description: 'Build a direct Pima.io URL for a resource index/view/filter set or record.',
      inputSchema: {
        resource: z.string(),
        id: z.string().optional(),
        action: z.enum(['index', 'show', 'new', 'edit']).optional(),
        q: z.string().optional(),
        page: z.number().optional(),
        variant: z.string().optional(),
        sort: z.string().optional(),
        direction: z.enum(['asc', 'desc']).optional(),
        filters: z.record(z.any()).optional(),
      },
    },
    async ({resource, id, action, q, page, variant, sort, direction, filters}) => {
      try {
        const manifest = await fetchManifest({host: opts.host})
        const entry = findResource(manifest, resource)
        if (!entry) return fail(new Error(`Unknown resource: ${resource}`))
        return ok({
          url: resourceAppUrl(await resolveHost(opts.host), entry, {id, action, q, page, variant, sort, direction, filters}),
        })
      } catch (error) {
        return fail(error)
      }
    },
  )

  server.registerTool(
    'pima_show',
    {
      description: 'Show one PIMA resource record by name + id (full detail payload). Requires the domain :read scope.',
      inputSchema: {resource: z.string(), id: z.string()},
    },
    async ({resource, id}) => {
      try {
        return ok(await showResource(await client(), resource, id))
      } catch (error) {
        return fail(error)
      }
    },
  )

  server.registerTool(
    'pima_history',
    {
      description: 'Read PaperTrail history for a resource record. Requires the resource domain :read scope.',
      inputSchema: {resource: z.string(), id: z.string(), page: z.number().optional()},
    },
    async ({resource, id, page}) => {
      try {
        const manifest = await fetchManifest({host: opts.host})
        const entry = findResource(manifest, resource)
        if (!entry) return fail(new Error(`Unknown resource: ${resource}`))
        if (!entry.model) return fail(new Error(`${entry.id} does not expose a model name for history lookup.`))
        return ok(await resourceHistory(await client(), entry.model, id, page))
      } catch (error) {
        return fail(error)
      }
    },
  )

  server.registerTool(
    'pima_comments',
    {
      description: 'Read comments and @-mention metadata for a resource record. Requires the resource domain :read scope.',
      inputSchema: {resource: z.string(), id: z.string()},
    },
    async ({resource, id}) => {
      try {
        return ok(await listResourceComments(await client(), resource, id))
      } catch (error) {
        return fail(error)
      }
    },
  )

  server.registerTool(
    'pima_fields',
    {
      description: "Show a resource's create-form fields (keys, types, required) so you know what to pass to pima_create.",
      inputSchema: {resource: z.string()},
    },
    async ({resource}) => {
      try {
        const data = await (await client()).get(`/${resource}/new.json`)
        return ok((data.form?.fields ?? []).map((f: any) => ({key: f.key, type: f.type, required: !!f.required, label: f.label})))
      } catch (error) {
        return fail(error)
      }
    },
  )

  server.registerTool(
    'pima_search',
    {
      description:
        'Sitewide lookup across PIMA pages and records (orders, products, SKUs, customers). Use optimized metrics/inventory tools for business questions. Requires reports:read.',
      inputSchema: {query: z.string()},
    },
    async ({query}) => {
      try {
        return ok(await (await client()).get(`/search.json?q=${encodeURIComponent(query)}`))
      } catch (error) {
        return fail(error)
      }
    },
  )

  server.registerTool(
    'pima_routing',
    {
      description: 'The order-item routing dashboard (what is unshippable, by location). Requires orders:read.',
      inputSchema: {location: z.number().optional(), tab: z.string().optional()},
    },
    async ({location, tab}) => {
      try {
        const qs = new URLSearchParams({tab: tab ?? 'report'})
        if (location) qs.set('location_id', String(location))
        return ok(await (await client()).get(`/order_items/routing.json?${qs.toString()}`))
      } catch (error) {
        return fail(error)
      }
    },
  )

  server.registerTool(
    'pima_report',
    {
      description:
        'Fetch a legacy report payload as JSON, e.g. inventory_on_hand_report. For sales metrics, use pima_sales_summary instead of sales_report. Requires reports:read.',
      inputSchema: {name: z.string(), params: z.record(z.string()).optional()},
    },
    async ({name, params}) => {
      try {
        assertSupportedReportPayload(name)
        const qs = new URLSearchParams(params ?? {})
        return ok(await (await client()).get(`/reports/${name}.json?${qs.toString()}`))
      } catch (error) {
        return fail(error)
      }
    },
  )

  server.registerTool(
    'pima_sales_summary',
    {
      description:
        'Fetch optimized PIMA sales metrics from stored daily metrics. Use this for questions like "how are POS sales today?" before paging raw orders. Requires reports:read.',
      inputSchema: {
        date: z.string().optional().describe('Single date, YYYY-MM-DD'),
        from: z.string().optional().describe('Start date, YYYY-MM-DD'),
        to: z.string().optional().describe('End date, YYYY-MM-DD'),
        compare: z.enum(['previous_period', 'previous_week', 'previous_year']).optional().describe('Comparison range'),
        compare_from: z.string().optional().describe('Explicit comparison start date, YYYY-MM-DD'),
        compare_to: z.string().optional().describe('Explicit comparison end date, YYYY-MM-DD'),
        channel: z.enum(['pos', 'online', 'all']).optional(),
        location_id: z.number().optional(),
        location_ids: z.string().optional().describe('Comma-separated location ids'),
        location: z.string().optional().describe('Location name, reporting name, or short name'),
        short_name: z.string().optional().describe('Location short name'),
        location_group: z.string().optional().describe('Pima LocationGroup name, short name, or id'),
        location_group_id: z.union([z.string(), z.number()]).optional().describe('Pima LocationGroup id'),
        location_group_ids: z.string().optional().describe('Comma-separated Pima LocationGroup ids'),
        city: z.string().optional().describe('Location city, e.g. Los Angeles'),
        state: z.string().optional().describe('US state abbreviation, e.g. CA'),
        all_pos: z.boolean().optional().describe('Restrict to all POS locations'),
        gender: z.string().optional().describe('Optional gender filter (m, w, u)'),
        group_by: z.enum(['location_group', 'region', 'location', 'city', 'state', 'all']).optional().describe('Group sales totals by location dimension. location_group uses the actual Pima LocationGroup model; region is a legacy alias.'),
        sort: z
          .enum(['net_sales', 'sales', 'total_revenue', 'plan_attainment', 'orders', 'units', 'aov', 'auv', 'upt', 'visits', 'conversion_rate', 'sales_per_hour', 'inventory_on_hand'])
          .optional()
          .describe('Ranking metric for grouped output'),
        under_plan: z.boolean().optional().describe('Only include groups below net sales plan'),
        min_sales: z.union([z.string(), z.number()]).optional().describe('Only include groups with at least this net sales amount'),
        max_upt: z.union([z.string(), z.number()]).optional().describe('Only include groups at or below this UPT'),
        refresh: z.boolean().optional().describe('Force recalculation of stored daily metrics'),
      },
    },
    async (params) => {
      try {
        return ok(await salesSummary(await client(), params))
      } catch (error) {
        return fail(error)
      }
    },
  )

  server.registerTool(
    'pima_product_performance',
    {
      description:
        'Fetch optimized top product, SKU, and business Style metrics from stored daily SKU metrics. Use this for questions like "top selling styles for these stores on Saturday" before raw orders/units. In PIMA, business Style = ProductLine. Requires reports:read.',
      inputSchema: {
        date: z.string().optional().describe('Single date, YYYY-MM-DD'),
        from: z.string().optional().describe('Start date, YYYY-MM-DD'),
        to: z.string().optional().describe('End date, YYYY-MM-DD'),
        channel: z.enum(['pos', 'online', 'all']).optional(),
        location_id: z.number().optional(),
        location_ids: z.string().optional().describe('Comma-separated location ids'),
        location: z.string().optional().describe('Location name, reporting name, or short name'),
        short_name: z.string().optional().describe('Location short name'),
        location_group: z.string().optional().describe('Pima LocationGroup name, short name, or id'),
        location_group_id: z.union([z.string(), z.number()]).optional().describe('Pima LocationGroup id'),
        location_group_ids: z.string().optional().describe('Comma-separated Pima LocationGroup ids'),
        city: z.string().optional().describe('Location city, e.g. Los Angeles'),
        state: z.string().optional().describe('US state abbreviation, e.g. CA'),
        all_pos: z.boolean().optional().describe('Restrict to all POS locations'),
        gender: z.string().optional().describe('Optional gender filter (m, w, u)'),
        group_by: z
          .enum(['sku', 'product', 'style', 'product_line', 'category', 'product_type', 'gender'])
          .optional()
          .describe('Breakdown grain. Use style for business Style/ProductLine.'),
        location_group_by: z.enum(['location_group', 'region', 'location', 'city', 'state', 'all']).optional().describe('Nest product rankings under a location grouping. location_group uses the actual Pima LocationGroup model; city/state are ad-hoc dimensions.'),
        sort: z.enum(['revenue', 'net_revenue', 'units', 'returns', 'return_revenue', 'return_rate', 'auv']).optional().describe('Ranking metric'),
        min_units: z.number().optional().describe('Only include groups with at least this many sold units'),
        min_revenue: z.union([z.string(), z.number()]).optional().describe('Only include groups with at least this revenue amount'),
        min_return_rate: z.union([z.string(), z.number()]).optional().describe('Only include groups at or above this return rate'),
        max_return_rate: z.union([z.string(), z.number()]).optional().describe('Only include groups at or below this return rate'),
        limit: z.number().optional().describe('Maximum rows to return'),
        refresh: z.boolean().optional().describe('Force recalculation of stored daily SKU metrics'),
      },
    },
    async (params) => {
      try {
        return ok(await productPerformance(await client(), params))
      } catch (error) {
        return fail(error)
      }
    },
  )

  server.registerTool(
    'pima_team_performance',
    {
      description:
        'Fetch optimized retail team-member performance by Pima LocationGroup, location, city, state, or all selected locations. Supports product filters for questions like "who sold the most tshirts today?" Use this before raw orders/timesheets. Requires reports:read.',
      inputSchema: {
        date: z.string().optional().describe('Single date, YYYY-MM-DD'),
        from: z.string().optional().describe('Start date, YYYY-MM-DD'),
        to: z.string().optional().describe('End date, YYYY-MM-DD'),
        channel: z.enum(['pos', 'online', 'all']).optional(),
        location_id: z.number().optional(),
        location_ids: z.string().optional().describe('Comma-separated location ids'),
        location: z.string().optional().describe('Location name, reporting name, or short name'),
        short_name: z.string().optional().describe('Location short name'),
        location_group: z.string().optional().describe('Pima LocationGroup name, short name, or id'),
        location_group_id: z.union([z.string(), z.number()]).optional().describe('Pima LocationGroup id'),
        location_group_ids: z.string().optional().describe('Comma-separated Pima LocationGroup ids'),
        region: z.string().optional().describe('Legacy alias for a Pima LocationGroup name'),
        city: z.string().optional().describe('Location city, e.g. Los Angeles'),
        state: z.string().optional().describe('US state abbreviation, e.g. CA'),
        all_pos: z.boolean().optional().describe('Restrict to all POS locations'),
        gender: z.string().optional().describe('Optional gender filter (m, w, u)'),
        q: z.string().optional().describe('Product search, e.g. tshirts, tees, SKU, style, category'),
        sku: z.string().optional().describe('SKU name, UPC, legacy SKU, product, or style search'),
        sku_id: z.union([z.string(), z.number()]).optional(),
        sku_ids: z.string().optional().describe('Comma-separated SKU ids'),
        product: z.string().optional().describe('Product or style search'),
        product_id: z.union([z.string(), z.number()]).optional(),
        product_ids: z.string().optional().describe('Comma-separated product ids'),
        style: z.string().optional().describe('Business Style / ProductLine search'),
        product_line: z.string().optional().describe('Business Style / ProductLine search'),
        product_line_id: z.union([z.string(), z.number()]).optional(),
        product_line_ids: z.string().optional().describe('Comma-separated ProductLine ids'),
        category: z.string().optional().describe('Category name'),
        category_id: z.union([z.string(), z.number()]).optional(),
        category_ids: z.string().optional().describe('Comma-separated category ids'),
        product_type: z.string().optional().describe('Product type name'),
        product_type_id: z.union([z.string(), z.number()]).optional(),
        product_type_ids: z.string().optional().describe('Comma-separated product type ids'),
        group_by: z.enum(['location_group', 'region', 'location', 'city', 'state', 'all']).optional().describe('Outer grouping for ranked team members. location_group uses the actual Pima LocationGroup model; city/state are ad-hoc dimensions.'),
        sort: z
          .enum(['net_sales', 'sales', 'sold', 'returns', 'sales_per_hour', 'net_sales_per_hour', 'orders', 'units', 'hours', 'aov', 'auv', 'upt'])
          .optional()
          .describe('Ranking metric'),
        limit: z.number().optional().describe('Maximum users per group to return'),
        min_sales: z.union([z.string(), z.number()]).optional().describe('Only include users with at least this gross sales amount'),
        min_net_sales: z.union([z.string(), z.number()]).optional().describe('Only include users with at least this net sales amount'),
        max_upt: z.union([z.string(), z.number()]).optional().describe('Only include users at or below this UPT'),
        min_units: z.union([z.string(), z.number()]).optional().describe('Only include users with at least this many units'),
        min_orders: z.union([z.string(), z.number()]).optional().describe('Only include users with at least this many orders'),
        refresh: z.boolean().optional().describe('Force recalculation of stored daily user metrics'),
      },
    },
    async (params) => {
      try {
        return ok(await teamPerformance(await client(), params))
      } catch (error) {
        return fail(error)
      }
    },
  )

  const inventorySelectorInputSchema = {
    q: z.string().optional().describe('SKU, UPC, legacy SKU, product, or product-line search'),
    sku: z.string().optional().describe('SKU name, UPC, legacy SKU, product, or product-line search'),
    sku_id: z.union([z.string(), z.number()]).optional(),
    sku_ids: z.string().optional().describe('Comma-separated SKU ids'),
    product: z.string().optional().describe('Product or product-line search'),
    product_id: z.union([z.string(), z.number()]).optional(),
    product_ids: z.string().optional().describe('Comma-separated product ids'),
    category: z.string().optional().describe('Category name'),
    category_id: z.union([z.string(), z.number()]).optional(),
    category_ids: z.string().optional().describe('Comma-separated category ids'),
    gender: z.enum(['m', 'w', 'u']).optional(),
    location_id: z.union([z.string(), z.number()]).optional(),
    location_ids: z.string().optional().describe('Comma-separated location ids'),
    location: z.string().optional().describe('Location name, reporting name, or short name'),
    short_name: z.string().optional().describe('Location short name'),
    location_group: z.string().optional().describe('Pima LocationGroup name, short name, or id'),
    location_group_id: z.union([z.string(), z.number()]).optional().describe('Pima LocationGroup id'),
    location_group_ids: z.string().optional().describe('Comma-separated Pima LocationGroup ids'),
    city: z.string().optional().describe('Location city, e.g. Los Angeles'),
    state: z.string().optional().describe('US state abbreviation, e.g. CA'),
    channel: z.enum(['pos', 'online', 'all']).optional(),
    all_pos: z.boolean().optional().describe('Restrict to all POS locations'),
    limit: z.number().optional().describe('Maximum SKUs to resolve'),
  }

  server.registerTool(
    'pima_inventory_availability',
    {
      description:
        'Fetch optimized transfer-aware inventory availability. Use this for on hand, available, sellable, inbound transfer, projected availability, location group, city/state, and POS inventory questions before paging raw units. Requires inventory:read.',
      inputSchema: {
        ...inventorySelectorInputSchema,
        include_zero: z.boolean().optional().describe('Include SKU/location rows with all zero counts'),
      },
    },
    async (params) => {
      try {
        return ok(await inventoryAvailability(await client(), params))
      } catch (error) {
        return fail(error)
      }
    },
  )

  server.registerTool(
    'pima_inventory_transfers',
    {
      description:
        'Fetch inventory transfer rows grouped by transfer and SKU. Use this for transferring, inbound/outbound, pending transfer, and location-to-location movement questions. Requires transfers:read.',
      inputSchema: {
        ...inventorySelectorInputSchema,
        direction: z.enum(['inbound', 'outbound', 'both']).optional().describe('Direction relative to selected locations'),
        status: z.string().optional().describe('Transfer status or comma-separated statuses'),
      },
    },
    async (params) => {
      try {
        return ok(await inventoryTransfers(await client(), params))
      } catch (error) {
        return fail(error)
      }
    },
  )

  server.registerTool(
    'pima_inventory_risk',
    {
      description:
        'Fetch inventory risk by combining current transfer-aware availability with recent SKU sales velocity and days of cover. Use this for low stock, fast sellers, and best-selling SKUs that are almost out. Requires inventory:read and reports:read.',
      inputSchema: {
        ...inventorySelectorInputSchema,
        date: z.string().optional().describe('Velocity end date, YYYY-MM-DD'),
        from: z.string().optional().describe('Explicit velocity start date, YYYY-MM-DD'),
        to: z.string().optional().describe('Explicit velocity end date, YYYY-MM-DD'),
        recent_days: z.number().optional().describe('Recent days used for sales velocity'),
        days_of_cover: z.union([z.string(), z.number()]).optional().describe('Days-of-cover risk threshold'),
        low_stock: z.union([z.string(), z.number()]).optional().describe('Low-stock unit threshold'),
        at_risk: z.boolean().optional().describe('Only include high/medium risk rows'),
        refresh: z.boolean().optional().describe('Force recalculation of stored daily SKU metrics'),
      },
    },
    async (params) => {
      try {
        return ok(await inventoryRisk(await client(), params))
      } catch (error) {
        return fail(error)
      }
    },
  )

  server.registerTool(
    'pima_inventory_fulfillment_recommendations',
    {
      description:
        'Fetch fulfillment location recommendations for a SKU or order item, including sellable/projected availability and route eligibility/action metadata. Use this for "where can we fulfill this SKU from nearby?" Requires inventory:read, plus orders:read with order_item_id.',
      inputSchema: {
        ...inventorySelectorInputSchema,
        order_item_id: z.union([z.string(), z.number()]).optional().describe('Order item id to evaluate for rerouting'),
        include_zero: z.boolean().optional().describe('Include locations with no sellable units'),
      },
    },
    async (params) => {
      try {
        return ok(await inventoryFulfillmentRecommendations(await client(), params))
      } catch (error) {
        return fail(error)
      }
    },
  )

  server.registerTool(
    'pima_feedback_status',
    {
      description: 'Check a PIMA async feedback question thread. Requires feedback:read.',
      inputSchema: {id: z.string().describe('Question thread id, e.g. q_123')},
    },
    async ({id}) => {
      try {
        return ok(await getFeedback(await client(), id))
      } catch (error) {
        return fail(error)
      }
    },
  )

  if (!opts.write) return server

  // ---- Write tools (opt-in; still bounded by the token's :write scopes) ----
  server.registerTool(
    'pima_reroute',
    {
      description: "Reroute an order item to a different fulfillment location. Requires orders:write.",
      inputSchema: {order_item_id: z.string(), to_location_id: z.number()},
    },
    async ({order_item_id, to_location_id}) => {
      try {
        return ok(await (await client()).patch(`/order_items/${order_item_id}`, {order_item: {fulfillment_location_id: to_location_id}}))
      } catch (error) {
        return fail(error)
      }
    },
  )

  server.registerTool(
    'pima_create',
    {
      description: 'Create any PIMA resource (coupons, customer_credits, invites, memo_assignments, cycle_counts, ...). Requires the domain :write scope. Use pima_fields first.',
      inputSchema: {resource: z.string(), data: z.record(z.any()).describe('The record fields')},
    },
    async ({resource, data}) => {
      try {
        return ok(await createResource(await client(), resource, {record: data}))
      } catch (error) {
        return fail(error)
      }
    },
  )

  server.registerTool(
    'pima_update',
    {
      description: 'Update any PIMA resource record. Requires the domain :write scope.',
      inputSchema: {resource: z.string(), id: z.string(), data: z.record(z.any())},
    },
    async ({resource, id, data}) => {
      try {
        return ok(await updateResource(await client(), resource, id, {record: data}))
      } catch (error) {
        return fail(error)
      }
    },
  )

  server.registerTool(
    'pima_action',
    {
      description: 'Run a member action on a resource record, e.g. purchase_orders/13529/accept. Requires the domain :write scope.',
      inputSchema: {
        resource: z.string(),
        id: z.string(),
        verb: z.string(),
        method: z.enum(['get', 'post', 'patch']).optional(),
        data: z.record(z.any()).optional(),
      },
    },
    async ({resource, id, verb, method, data}) => {
      try {
        const m = (method ?? 'post').toUpperCase() as 'GET' | 'POST' | 'PATCH'
        return ok(await memberAction(await client(), m, resource, id, verb, data))
      } catch (error) {
        return fail(error)
      }
    },
  )

  server.registerTool(
    'pima_comment',
    {
      description: 'Create a comment on a resource record. @mentions are resolved by PIMA. Requires the resource domain :write scope.',
      inputSchema: {resource: z.string(), id: z.string(), text: z.string()},
    },
    async ({resource, id, text}) => {
      try {
        return ok(await createResourceComment(await client(), resource, id, text))
      } catch (error) {
        return fail(error)
      }
    },
  )

  const feedbackSchema = {
    title: z.string().describe('Short title'),
    description: z.string().optional(),
    expected: z.string().optional(),
    actual: z.string().optional(),
    steps: z.string().optional(),
    severity: z.string().optional(),
    request_id: z.string().optional().describe('PIMA request id, especially for 500s'),
    status: z.union([z.string(), z.number()]).optional(),
    command: z.string().optional(),
    resource: z.string().optional(),
    record_id: z.string().optional(),
    path: z.string().optional(),
    method: z.string().optional(),
    url: z.string().optional(),
    error_class: z.string().optional(),
    error_message: z.string().optional(),
    context: z.record(z.any()).optional().describe('Additional sanitized context. Do not include tokens, cookies, gift codes, credit codes, or raw PII.'),
    codex_pr: z.boolean().optional().describe('Override Codex PR automation for bugs/features. Ignored by async questions.'),
  }

  const feedbackTool = (kind: FeedbackKind, description: string) => ({
    description,
    inputSchema: feedbackSchema,
    handler: async (input: Omit<FeedbackPayload, 'kind'>) => {
      try {
        return ok(await fileFeedback(await client(), {kind, ...input}))
      } catch (error) {
        return fail(error)
      }
    },
  })

  const bugTool = feedbackTool(
    'bug',
    'File a PIMA bug as a GitHub issue. Use this when a PIMA API returns a 500; include request_id, command, status, resource/action, and sanitized context. Requires feedback:write.',
  )
  server.registerTool('pima_file_bug', {description: bugTool.description, inputSchema: bugTool.inputSchema}, bugTool.handler)

  const questionTool = feedbackTool(
    'question',
    'Ask a PIMA product or implementation question. This queues an async read-only Codex answer thread and returns a question id. Requires feedback:write.',
  )
  server.registerTool('pima_ask_question', {description: questionTool.description, inputSchema: questionTool.inputSchema}, questionTool.handler)

  server.registerTool(
    'pima_feedback_follow_up',
    {
      description: 'Ask a follow-up on an existing PIMA feedback question thread. Requires feedback:write.',
      inputSchema: {
        id: z.string().describe('Question thread id, e.g. q_123'),
        message: z.string().describe('Follow-up question'),
        context: z.record(z.any()).optional().describe('Additional sanitized context. Do not include tokens, cookies, gift codes, credit codes, or raw PII.'),
      },
    },
    async ({id, message, context}) => {
      try {
        return ok(await followUpFeedback(await client(), id, message, context))
      } catch (error) {
        return fail(error)
      }
    },
  )

  const featureTool = feedbackTool(
    'feature',
    'Request a PIMA feature as a GitHub issue. Features are Codex PR candidates by default. Requires feedback:write.',
  )
  server.registerTool('pima_request_feature', {description: featureTool.description, inputSchema: featureTool.inputSchema}, featureTool.handler)

  void destroyResource // available for a future pima_delete tool

  return server
}
