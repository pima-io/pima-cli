export interface AlterationActionResponse {
  alteration: {
    id: number
    order_item_id: number
    status: string
  }
  notice: string
}

interface AlterationClient {
  post(path: string): Promise<AlterationActionResponse>
}

export function cancelAlteration(client: AlterationClient, id: string): Promise<AlterationActionResponse> {
  return client.post(`/alterations/${encodeURIComponent(id)}/cancel.json`)
}
