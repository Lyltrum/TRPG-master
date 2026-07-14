// 前端脱离后端时的假数据库 —— 存 localStorage，多个浏览器标签页共享同一份状态
// （方便手动开两个 tab 模拟房主+访客）。只在 VITE_USE_MOCK 模式下被用到，见 api-client.ts。

export interface MockPlayer {
  playerId: string
  userId: string | null
  nickname: string
  isHost: boolean
  ready: boolean
  hasCharacter: boolean
}

export interface MockCharacter {
  characterId: string
  playerId: string
  status: 'draft' | 'complete'
}

export interface MockRoom {
  roomId: string
  roomCode: string
  phase: 'Lobby' | 'InGame'
  moduleTitle: string | null
  maxPlayers: number
  players: MockPlayer[]
  characters: MockCharacter[]
  companionTimersStarted: boolean
}

export interface MockUser {
  userId: string
  account: string
  password: string
  nickname: string
}

interface MockDbShape {
  users: MockUser[]
  tokens: Record<string, string> // token -> userId
  rooms: Record<string, MockRoom> // key: roomCode
  seq: number
}

const STORAGE_KEY = 'aidm-mock-db'

function emptyDb(): MockDbShape {
  return { users: [], tokens: {}, rooms: {}, seq: 1 }
}

function load(): MockDbShape {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return emptyDb()
    return JSON.parse(raw) as MockDbShape
  } catch {
    return emptyDb()
  }
}

function save(db: MockDbShape) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(db))
}

function nextId(db: MockDbShape, prefix: string): string {
  return `${prefix}-${db.seq++}`
}

function randomRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)]
  return code
}

const COMPANION_NAMES = ['测试队友·陈探员', '测试队友·艾米丽']

// 房主创建房间后自动进来一个"假队友"，过一段时间自己就绪/建完卡——
// 否则大厅/建卡准备页这两个"全员到齐才能继续"的等待界面，单人在 mock 模式下永远走不到底。
function scheduleCompanionProgress(roomCode: string) {
  setTimeout(() => {
    const db = load()
    const room = db.rooms[roomCode]
    if (!room) return
    const companion = room.players.find((p) => !p.isHost)
    if (companion) companion.ready = true
    save(db)
  }, 3000)

  setTimeout(() => {
    const db = load()
    const room = db.rooms[roomCode]
    if (!room) return
    const companion = room.players.find((p) => !p.isHost)
    if (companion) companion.hasCharacter = true
    save(db)
  }, 7000)
}

export const mockDb = {
  createUser(account: string, password: string, nickname: string): MockUser {
    const db = load()
    if (db.users.some((u) => u.account === account)) {
      throw new Error('ACCOUNT_EXISTS')
    }
    const user: MockUser = { userId: nextId(db, 'user'), account, password, nickname: nickname || account }
    db.users.push(user)
    save(db)
    return user
  },

  verifyLogin(account: string, password: string): MockUser {
    const db = load()
    const user = db.users.find((u) => u.account === account && u.password === password)
    if (!user) throw new Error('INVALID_CREDENTIALS')
    return user
  },

  issueToken(userId: string): string {
    const db = load()
    const token = `mock-token-${userId}-${Date.now()}`
    db.tokens[token] = userId
    save(db)
    return token
  },

  revokeToken(token: string) {
    const db = load()
    delete db.tokens[token]
    save(db)
  },

  findUserByToken(token: string | null): MockUser | null {
    if (!token) return null
    const db = load()
    const userId = db.tokens[token]
    if (!userId) return null
    return db.users.find((u) => u.userId === userId) ?? null
  },

  createRoom(hostNickname: string, hostUserId: string | null): { room: MockRoom; player: MockPlayer } {
    const db = load()
    const player: MockPlayer = {
      playerId: nextId(db, 'player'),
      userId: hostUserId,
      nickname: hostNickname || '房主',
      isHost: true,
      ready: false,
      hasCharacter: false,
    }
    const companion: MockPlayer = {
      playerId: nextId(db, 'player'),
      userId: null,
      nickname: COMPANION_NAMES[Math.floor(Math.random() * COMPANION_NAMES.length)],
      isHost: false,
      ready: false,
      hasCharacter: false,
    }
    const room: MockRoom = {
      roomId: nextId(db, 'room'),
      roomCode: randomRoomCode(),
      phase: 'Lobby',
      moduleTitle: null,
      maxPlayers: 6,
      players: [player, companion],
      characters: [],
      companionTimersStarted: false,
    }
    db.rooms[room.roomCode] = room
    save(db)
    return { room, player }
  },

  joinRoom(roomCode: string, nickname: string, userId: string | null): { room: MockRoom; player: MockPlayer } {
    const db = load()
    const room = db.rooms[roomCode]
    if (!room) throw new Error('ROOM_NOT_FOUND')
    const existing = userId ? room.players.find((p) => p.userId === userId) : undefined
    if (existing) return { room, player: existing }
    if (room.players.length >= room.maxPlayers) throw new Error('ROOM_FULL')
    const player: MockPlayer = {
      playerId: nextId(db, 'player'),
      userId,
      nickname: nickname || '玩家',
      isHost: false,
      ready: false,
      hasCharacter: false,
    }
    room.players.push(player)
    save(db)
    return { room, player }
  },

  findPlayerByUserId(room: MockRoom, userId: string | null): MockPlayer | undefined {
    return room.players.find((p) => p.userId === userId)
  },

  getRoomByCode(roomCode: string): MockRoom | null {
    const db = load()
    return db.rooms[roomCode] ?? null
  },

  getRoomById(roomId: string): MockRoom | null {
    const db = load()
    return Object.values(db.rooms).find((r) => r.roomId === roomId) ?? null
  },

  setModule(roomId: string, moduleTitle: string) {
    const db = load()
    const room = Object.values(db.rooms).find((r) => r.roomId === roomId)
    if (!room) throw new Error('ROOM_NOT_FOUND')
    room.moduleTitle = moduleTitle
    if (!room.companionTimersStarted) {
      room.companionTimersStarted = true
      scheduleCompanionProgress(room.roomCode)
    }
    save(db)
  },

  setReady(roomCode: string, playerId: string, ready: boolean) {
    const db = load()
    const room = db.rooms[roomCode]
    if (!room) return
    const player = room.players.find((p) => p.playerId === playerId)
    if (player) player.ready = ready
    save(db)
  },

  createCharacterDraft(roomId: string, playerId: string): string {
    const db = load()
    const room = Object.values(db.rooms).find((r) => r.roomId === roomId)
    if (!room) throw new Error('ROOM_NOT_FOUND')
    const characterId = nextId(db, 'char')
    room.characters.push({ characterId, playerId, status: 'draft' })
    save(db)
    return characterId
  },

  completeCharacter(roomId: string, characterId: string) {
    const db = load()
    const room = Object.values(db.rooms).find((r) => r.roomId === roomId)
    if (!room) throw new Error('ROOM_NOT_FOUND')
    const character = room.characters.find((c) => c.characterId === characterId)
    if (!character) throw new Error('CHARACTER_NOT_FOUND')
    character.status = 'complete'
    const player = room.players.find((p) => p.playerId === character.playerId)
    if (player) player.hasCharacter = true
    save(db)
  },

  startGame(roomCode: string) {
    const db = load()
    const room = db.rooms[roomCode]
    if (!room) return
    room.phase = 'InGame'
    save(db)
  },
}
