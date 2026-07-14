// 单独拆出来，好让 mocks/mock-api.ts 也能直接用同一个 ApiError，不用绕回 api-client.ts。

export class ApiError extends Error {
  status: number
  body: unknown
  constructor(status: number, body: unknown) {
    super(`API Error ${status}: ${JSON.stringify(body)}`)
    this.status = status
    this.body = body
  }
}
