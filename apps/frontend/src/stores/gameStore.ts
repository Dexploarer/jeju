/**
 * Game Store
 */
import { create } from 'zustand'

interface GameState {
  currentGameId: string | null
  dayNumber: number
  setCurrentGame: (gameId: string) => void
  setDayNumber: (day: number) => void
}

export const useGameStore = create<GameState>((set) => ({
  currentGameId: null,
  dayNumber: 1,
  setCurrentGame: (gameId) => set({ currentGameId: gameId }),
  setDayNumber: (day) => set({ dayNumber: day }),
}))
