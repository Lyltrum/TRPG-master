import { create } from 'zustand'

export type GamePhase = 'lobby' | 'playing' | 'paused' | 'ended'

interface GameState {
  gameId: string | null
  systemId: string | null
  sceneId: string | null
  phase: GamePhase
  returnFromGameSelect: boolean
  // ★ 创建房间表单的草稿字段——单独拎出来是因为它们要跨 /create<->/games 导航
  // 存活，但又不能被 reset()（选游戏那步会调用 reset() 清 gameId/systemId/
  // sceneId，不该连带清掉用户已经填好的房间名/房间号/人数）。
  roomNameDraft: string
  roomCodeDraft: string
  maxPlayersDraft: number
  setGame: (gameId: string, systemId: string) => void
  setScene: (sceneId: string) => void
  setPhase: (phase: GamePhase) => void
  setReturnFromGameSelect: (v: boolean) => void
  setRoomNameDraft: (v: string) => void
  setRoomCodeDraft: (v: string) => void
  setMaxPlayersDraft: (v: number) => void
  clearRoomDraft: () => void
  reset: () => void
}

export const useGameStore = create<GameState>((set) => ({
  gameId: null,
  systemId: null,
  sceneId: null,
  phase: 'lobby',
  returnFromGameSelect: false,
  roomNameDraft: '',
  roomCodeDraft: '',
  maxPlayersDraft: 4,
  setGame: (gameId, systemId) => set({ gameId, systemId }),
  setScene: (sceneId) => set({ sceneId }),
  setPhase: (phase) => set({ phase }),
  setReturnFromGameSelect: (v) => set({ returnFromGameSelect: v }),
  setRoomNameDraft: (v) => set({ roomNameDraft: v }),
  setRoomCodeDraft: (v) => set({ roomCodeDraft: v }),
  setMaxPlayersDraft: (v) => set({ maxPlayersDraft: v }),
  clearRoomDraft: () => set({ roomNameDraft: '', roomCodeDraft: '', maxPlayersDraft: 4 }),
  reset: () =>
    set({
      gameId: null,
      systemId: null,
      sceneId: null,
      phase: 'lobby',
      returnFromGameSelect: false,
    }),
}))
