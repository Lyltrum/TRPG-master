// 假 WebSocket —— 用 BroadcastChannel 在标签页之间转发消息，行为对齐真实后端
// 现有的广播范围（只有 narration.push 会广播给房间内所有连接，其它事件只影响发送者本地状态）。

import { mockDb } from './mock-db'
import { getOpeningNarration, generateNarration } from './mock-narration'

type WsHandler = (envelope: { type: string; payload: unknown }) => void

const handlers = new Set<WsHandler>()
let channel: BroadcastChannel | null = null
let currentRoomCode: string | null = null

function emitLocal(type: string, payload: unknown) {
  handlers.forEach((h) => h({ type, payload }))
}

function ensureChannel(roomCode: string) {
  if (channel && currentRoomCode === roomCode) return
  channel?.close()
  currentRoomCode = roomCode
  channel = new BroadcastChannel(`aidm-mock-ws-${roomCode}`)
  channel.onmessage = (event) => emitLocal(event.data.type, event.data.payload)
}

function broadcast(type: string, payload: unknown) {
  emitLocal(type, payload)
  channel?.postMessage({ type, payload })
}

export function mockOnWsMessage(handler: WsHandler): () => void {
  handlers.add(handler)
  return () => handlers.delete(handler)
}

export function mockConnectWebSocket(roomId: string) {
  const room = mockDb.getRoomById(roomId)
  if (room) ensureChannel(room.roomCode)
  return { readyState: 1 } as unknown as WebSocket
}

export function mockWaitForWsOpen(): Promise<void> {
  return Promise.resolve()
}

export function mockDisconnectWebSocket() {
  channel?.close()
  channel = null
  currentRoomCode = null
}

export function mockSendWsMessage(type: string, playerId: string, payload: unknown) {
  const room = currentRoomCode ? mockDb.getRoomByCode(currentRoomCode) : null
  if (!room) return

  switch (type) {
    case 'room.join':
      // 玩家身份已在 REST 层（createGameRoom/joinRoomByCode）建立，这里只是幂等的在场确认。
      break
    case 'player.ready': {
      const ready = (payload as { ready: boolean }).ready
      mockDb.setReady(room.roomCode, playerId, ready)
      break
    }
    case 'game.start': {
      mockDb.startGame(room.roomCode)
      setTimeout(() => broadcast('narration.push', { text: getOpeningNarration() }), 1500)
      break
    }
    case 'action.submit': {
      const utterance = (payload as { utterance: string }).utterance || ''
      setTimeout(() => broadcast('narration.push', { text: generateNarration(utterance) }), 1200)
      break
    }
  }
}
