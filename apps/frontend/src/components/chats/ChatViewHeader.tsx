import {
  ArrowLeft,
  Loader2,
  LogOut,
  MoreVertical,
  Settings,
  Users,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Avatar } from '@/components/shared/Avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { ChatDetails } from './types';
import { getProfilePath } from './types';

interface ChatViewHeaderProps {
  chatDetails: ChatDetails;
  sseConnected: boolean;
  showBackButton?: boolean;
  onBack?: () => void;
  onManageGroup: () => void;
  onLeaveChat: () => void;
}

export function ChatViewHeader({
  chatDetails,
  sseConnected,
  showBackButton = false,
  onBack,
  onManageGroup,
  onLeaveChat,
}: ChatViewHeaderProps) {
  return (
    <div className="bg-background px-4 py-4">
      <div className="flex items-center gap-3">
        {showBackButton && (
          <button
            onClick={onBack}
            className="flex items-center gap-2 rounded-md px-3 py-1.5 font-medium text-foreground text-sm transition-colors hover:bg-sidebar-accent/50 lg:hidden"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
        )}

        {/* Avatar */}
        {chatDetails.chat.isGroup ? (
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-sidebar-accent/50">
            <Users className="h-5 w-5 text-primary" />
          </div>
        ) : chatDetails.chat.otherUser ? (
          <Link
            to={getProfilePath(chatDetails.chat.otherUser)}
            className="transition-opacity hover:opacity-80"
          >
            <Avatar
              id={chatDetails.chat.otherUser.id}
              name={chatDetails.chat.otherUser.displayName || 'User'}
              type="user"
              size="md"
              imageUrl={chatDetails.chat.otherUser.profileImageUrl || undefined}
            />
          </Link>
        ) : (
          <Avatar id="" name="User" type="user" size="md" />
        )}

        {/* Chat name and status */}
        <div className="flex-1">
          <div className="flex items-center gap-2">
            {chatDetails.chat.isGroup ? (
              <h3 className="font-bold text-foreground text-lg">
                {chatDetails.chat.name || 'Chat'}
              </h3>
            ) : chatDetails.chat.otherUser ? (
              <Link
                to={getProfilePath(chatDetails.chat.otherUser)}
                className="font-bold text-foreground text-lg transition-colors hover:text-primary"
              >
                {chatDetails.chat.otherUser.displayName || 'Chat'}
              </Link>
            ) : (
              <h3 className="font-bold text-foreground text-lg">Chat</h3>
            )}

            {/* SSE status */}
            {sseConnected ? (
              <span
                className="flex items-center gap-1 font-medium text-green-500 text-xs"
                data-testid="chat-sse-status"
              >
                <span className="h-2 w-2 animate-pulse rounded-full bg-green-500" />
                Live
              </span>
            ) : (
              <span
                className="flex items-center gap-1 font-medium text-xs text-yellow-500"
                data-testid="chat-sse-status"
              >
                <Loader2 className="h-3 w-3 animate-spin" />
                Connecting
              </span>
            )}
          </div>

          {chatDetails.chat.isGroup && (
            <p className="text-muted-foreground text-xs">
              {chatDetails.participants.length} participants
            </p>
          )}
        </div>

        {/* Group actions */}
        {chatDetails.chat.isGroup && (
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={onManageGroup}
              title="Manage Group"
            >
              <Settings className="h-5 w-5" />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <MoreVertical className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={onLeaveChat}
                  className="text-red-500"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Leave Chat</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>
    </div>
  );
}
