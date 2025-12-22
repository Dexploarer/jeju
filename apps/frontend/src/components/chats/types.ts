/**
 * Chat Types
 */

export interface Chat {
  id: string
  type: 'dm' | 'group'
  name?: string
  participants: ChatParticipant[]
  lastMessage?: ChatMessage
  unreadCount: number
  createdAt: string
  updatedAt: string
}

export interface ChatParticipant {
  id: string
  userId: string
  username: string
  displayName?: string
  profileImageUrl?: string
  role: 'admin' | 'member'
  joinedAt: string
}

export interface ChatMessage {
  id: string
  chatId: string
  senderId: string
  content: string
  type: 'text' | 'image' | 'file'
  mediaUrl?: string
  createdAt: string
  readBy: string[]
}

export interface ChatGroup {
  id: string
  name: string
  description?: string
  imageUrl?: string
  memberCount: number
}
