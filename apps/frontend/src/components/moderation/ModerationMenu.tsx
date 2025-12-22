/**
 * ModerationMenu Component
 *
 * Dropdown menu for moderation actions on posts/users
 */

import { Flag, MoreHorizontal, UserMinus } from 'lucide-react'
import { useState } from 'react'

interface ModerationMenuProps {
  targetUserId: string
  targetUsername?: string
  targetDisplayName: string
  targetProfileImageUrl?: string
  postId?: string
  isNPC?: boolean
}

export function ModerationMenu({
  targetUserId,
  targetDisplayName,
  postId,
  isNPC,
}: ModerationMenuProps) {
  const [isOpen, setIsOpen] = useState(false)

  const handleReport = () => {
    // TODO: Implement report functionality
    setIsOpen(false)
  }

  const handleBlock = () => {
    // TODO: Implement block functionality
    setIsOpen(false)
  }

  if (isNPC) return null

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 z-50 mt-1 w-48 rounded-lg border border-border bg-card py-1 shadow-lg">
            <button
              type="button"
              onClick={handleReport}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <Flag className="h-4 w-4" />
              Report {postId ? 'post' : 'user'}
            </button>
            <button
              type="button"
              onClick={handleBlock}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-500 hover:bg-muted"
            >
              <UserMinus className="h-4 w-4" />
              Block {targetDisplayName}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
