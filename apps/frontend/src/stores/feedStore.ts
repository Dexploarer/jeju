/**
 * Feed Store
 */
import { create } from 'zustand'

interface FeedState {
  feedType: 'all' | 'following' | 'game'
  setFeedType: (type: 'all' | 'following' | 'game') => void
}

export const useFeedStore = create<FeedState>((set) => ({
  feedType: 'all',
  setFeedType: (type) => set({ feedType: type }),
}))
