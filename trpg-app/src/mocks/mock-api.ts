// 假 REST 接口路由 —— 覆盖前端目前真实用到的全部 HTTP 端点（见 services/*.ts）。
// 路径匹配用最简单的 split('/') 判段数，端点一共十来个，没必要引入路由库。

import { ApiError } from '../services/api-client-error'
import { mockDb } from './mock-db'
import { getAuthToken } from '../services/api-client'

interface RequestOptions {
  method?: string
  body?: unknown
  headers?: Record<string, string>
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function currentUser() {
  return mockDb.findUserByToken(getAuthToken())
}

function requireUser() {
  const user = currentUser()
  if (!user) throw new ApiError(401, { detail: '未登录' })
  return user
}

const MODULE = {
  id: 'whateley',
  title: '惠特利旧宅',
  version: '1.0',
  authors: ['AIDM'],
  playersMin: 1,
  playersMax: 6,
  difficulty: 2,
  estimatedDuration: '2-3 小时',
}

export async function mockApiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  await sleep(150 + Math.random() * 250)

  const method = (options.method || 'GET').toUpperCase()
  const body = (options.body || {}) as Record<string, unknown>
  const segments = path.split('?')[0].split('/').filter(Boolean)

  try {
    // ── auth ──
    if (segments[0] === 'auth') {
      if (segments[1] === 'register' && method === 'POST') {
        const user = mockDb.createUser(body.account as string, body.password as string, body.nickname as string)
        const token = mockDb.issueToken(user.userId)
        return { userId: user.userId, token } as T
      }
      if (segments[1] === 'login' && method === 'POST') {
        const user = mockDb.verifyLogin(body.account as string, body.password as string)
        const token = mockDb.issueToken(user.userId)
        return { userId: user.userId, token } as T
      }
      if (segments[1] === 'logout' && method === 'POST') {
        const token = getAuthToken()
        if (token) mockDb.revokeToken(token)
        return undefined as T
      }
      if (segments[1] === 'me' && method === 'GET') {
        const user = requireUser()
        return { userId: user.userId, account: user.account, nickname: user.nickname } as T
      }
    }

    // ── modules ──
    if (segments[0] === 'modules' && method === 'GET') {
      return { modules: [MODULE] } as T
    }

    // ── rooms ──
    if (segments[0] === 'rooms') {
      if (segments.length === 1 && method === 'POST') {
        const user = requireUser()
        const { room, player } = mockDb.createRoom(body.nickname as string, user.userId)
        return { roomId: room.roomId, roomCode: room.roomCode, reconnectToken: `reconnect-${player.playerId}`, playerId: player.playerId } as T
      }

      if (segments.length === 2 && method === 'GET') {
        const room = mockDb.getRoomByCode(segments[1])
        if (!room) throw new ApiError(404, { detail: '房间不存在' })
        return {
          roomId: room.roomId,
          roomCode: room.roomCode,
          phase: room.phase,
          moduleTitle: room.moduleTitle,
          playerCount: room.players.length,
          maxPlayers: room.maxPlayers,
          players: room.players.map((p) => ({
            playerId: p.playerId,
            nickname: p.nickname,
            isHost: p.isHost,
            ready: p.ready,
            hasCharacter: p.hasCharacter,
          })),
        } as T
      }

      if (segments.length === 3 && segments[2] === 'module' && method === 'POST') {
        mockDb.setModule(segments[1], MODULE.title)
        return undefined as T
      }

      if (segments.length === 3 && segments[2] === 'join' && method === 'POST') {
        const user = requireUser()
        const { room, player } = mockDb.joinRoom(segments[1], body.nickname as string, user.userId)
        return { roomId: room.roomId, roomCode: room.roomCode, reconnectToken: `reconnect-${player.playerId}`, playerId: player.playerId } as T
      }

      if (segments.length === 3 && segments[2] === 'characters' && method === 'POST') {
        const user = requireUser()
        const room = mockDb.getRoomById(segments[1])
        if (!room) throw new ApiError(404, { detail: '房间不存在' })
        const player = mockDb.findPlayerByUserId(room, user.userId)
        if (!player) throw new ApiError(403, { detail: '你不在这个房间里' })
        const characterId = mockDb.createCharacterDraft(segments[1], player.playerId)
        return { characterId, status: 'draft' } as T
      }

      if (segments.length === 4 && segments[2] === 'characters' && method === 'PATCH') {
        // mock 模式不需要真的落库角色详情——CharacterReadyPage/RoomPage 都读本地
        // useCharacterStore，只有"是否建完卡"这个状态需要服务端知道，交给 complete 端点处理。
        return undefined as T
      }

      if (segments.length === 5 && segments[2] === 'characters' && segments[4] === 'complete' && method === 'POST') {
        mockDb.completeCharacter(segments[1], segments[3])
        return undefined as T
      }
    }
  } catch (err) {
    if (err instanceof ApiError) throw err
    const message = err instanceof Error ? err.message : 'MOCK_ERROR'
    const statusMap: Record<string, number> = {
      ACCOUNT_EXISTS: 409,
      INVALID_CREDENTIALS: 401,
      ROOM_NOT_FOUND: 404,
      ROOM_FULL: 409,
      CHARACTER_NOT_FOUND: 404,
    }
    throw new ApiError(statusMap[message] || 500, { detail: message })
  }

  throw new ApiError(404, { detail: `mock 未实现该接口: ${method} ${path}` })
}
