// HTTP / WebSocket 客户端封装。
// VITE_USE_MOCK 默认开启：不接真实后端/数据库，全部走 mocks/ 下的假实现，方便纯前端改界面；
// 设成 'false' 才切回真实后端（2026-07-13 起对接过的那一套）。

import { ApiError } from './api-client-error'
import { mockApiRequest } from '../mocks/mock-api'
import {
  mockConnectWebSocket,
  mockWaitForWsOpen,
  mockDisconnectWebSocket,
  mockSendWsMessage,
  mockOnWsMessage,
} from '../mocks/mock-ws'

export const USE_MOCK = (import.meta.env.VITE_USE_MOCK ?? 'true') !== 'false'

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'
const WS_BASE_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8000'

interface RequestOptions {
  method?: string
  body?: unknown
  headers?: Record<string, string>
}

let authToken: string | null = localStorage.getItem('aidm_token')

export function setAuthToken(token: string | null) {
  authToken = token
  if (token) {
    localStorage.setItem('aidm_token', token)
  } else {
    localStorage.removeItem('aidm_token')
  }
}

export function getAuthToken(): string | null {
  return authToken
}

export { ApiError }

// 把 ApiError/网络错误翻译成用户能看懂的提示——不要把原始 JSON/浏览器报错直接甩给用户。
export function friendlyErrorMessage(err: unknown, fallback = '操作失败，请稍后重试'): string {
  if (err instanceof ApiError) {
    const detail = (err.body as { detail?: unknown } | null)?.detail
    if (typeof detail === 'string' && detail) return detail
    if (detail && typeof detail === 'object') {
      const firstMessage = Object.values(detail as Record<string, unknown>)[0]
      if (typeof firstMessage === 'string') return firstMessage
    }
    if (err.status === 404) return '没有找到对应的内容'
    if (err.status === 409) return '操作冲突，请刷新后重试'
    if (err.status >= 500) return '服务器开小差了，请稍后重试'
    return fallback
  }
  if (err instanceof TypeError) return '网络连接失败，请检查网络后重试'
  return fallback
}

export async function apiRequest<T>(
  path: string,
  options: RequestOptions = {}
): Promise<T> {
  if (USE_MOCK) {
    return mockApiRequest<T>(path, options)
  }

  const { method = 'GET', body, headers = {} } = options

  const requestHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...headers,
  }

  if (authToken) {
    requestHeaders['Authorization'] = `Bearer ${authToken}`
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: requestHeaders,
    body: body ? JSON.stringify(body) : undefined,
  })

  if (!response.ok) {
    let errBody: unknown = null
    try {
      errBody = await response.json()
    } catch {
      // ignore
    }
    throw new ApiError(response.status, errBody)
  }

  if (response.status === 204) {
    return undefined as T
  }
  return await response.json()
}

// ── WebSocket ──────────────────────────────────────────
// 全局单例连接：跨 LobbyPage → RoomPage 导航要保持同一条连接不断开，
// connectWebSocket 做成幂等的（同一个 roomId 重复调用直接复用），既解决了
// "换页面要不要重连" 的问题，也顺带解决了 React StrictMode 开发环境下
// effect 会 mount→cleanup→remount 一次导致的重复连接/服务端 accept 冲突。
let ws: WebSocket | null = null
let wsRoomId: string | null = null
type WsHandler = (envelope: { type: string; payload: unknown }) => void
const wsHandlers = new Set<WsHandler>()

export function onWsMessage(handler: WsHandler): () => void {
  if (USE_MOCK) return mockOnWsMessage(handler)
  wsHandlers.add(handler)
  return () => wsHandlers.delete(handler)
}

export function connectWebSocket(roomId: string): WebSocket {
  if (USE_MOCK) return mockConnectWebSocket(roomId)

  if (ws && wsRoomId === roomId && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
    return ws
  }
  if (ws) {
    ws.close()
  }

  wsRoomId = roomId
  const url = `${WS_BASE_URL}/ws/${roomId}?token=${encodeURIComponent(authToken || '')}`
  ws = new WebSocket(url)
  ws.onmessage = (event) => {
    try {
      const envelope = JSON.parse(event.data)
      wsHandlers.forEach((h) => h(envelope))
    } catch (err) {
      console.error('[WS] failed to parse message', err, event.data)
    }
  }
  ws.onerror = (err) => console.error('[WS] error', err)
  return ws
}

export function waitForWsOpen(socket: WebSocket): Promise<void> {
  if (USE_MOCK) return mockWaitForWsOpen()

  if (socket.readyState === WebSocket.OPEN) return Promise.resolve()
  return new Promise((resolve, reject) => {
    socket.addEventListener('open', () => resolve(), { once: true })
    socket.addEventListener('error', (e) => reject(e), { once: true })
  })
}

export function disconnectWebSocket() {
  if (USE_MOCK) return mockDisconnectWebSocket()

  if (ws) {
    ws.close()
    ws = null
    wsRoomId = null
  }
}

export function sendWsMessage(type: string, playerId: string, payload: unknown) {
  if (USE_MOCK) return mockSendWsMessage(type, playerId, payload)

  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type, playerId, payload }))
  } else {
    console.warn(`[WS] not connected, dropped: ${type}`, payload)
  }
}
