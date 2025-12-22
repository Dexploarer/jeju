/**
 * Widget Cache Store
 *
 * Zustand store for caching widget data
 */

import { create } from 'zustand'

interface ProfileWidgetData {
  balance: unknown
  predictions: unknown[]
  perps: unknown[]
  stats: unknown
}

interface WidgetCacheState {
  profileWidgets: Record<string, ProfileWidgetData>
  setProfileWidget: (userId: string, data: ProfileWidgetData) => void
  getProfileWidget: (userId: string) => ProfileWidgetData | null
  clearCache: () => void
}

export const useWidgetCacheStore = create<WidgetCacheState>((set, get) => ({
  profileWidgets: {},

  setProfileWidget: (userId, data) => {
    set((state) => ({
      profileWidgets: {
        ...state.profileWidgets,
        [userId]: data,
      },
    }))
  },

  getProfileWidget: (userId) => {
    return get().profileWidgets[userId] || null
  },

  clearCache: () => {
    set({ profileWidgets: {} })
  },
}))
