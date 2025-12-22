import { Calendar, Clock, X } from 'lucide-react';
import { useEffect } from 'react';

interface UpcomingEventDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  event: {
    id: string;
    title: string;
    date: string;
    time?: string;
    isLive?: boolean;
    hint?: string;
    fullDescription?: string;
    source?: string;
    relatedQuestion?: number;
    imageUrl?: string;
    relatedActorId?: string;
    relatedOrganizationId?: string;
  } | null;
}

/**
 * Upcoming event detail modal component for displaying full event information.
 * Converted from Next.js to plain React.
 */
export function UpcomingEventsDetailModal({
  isOpen,
  onClose,
  event,
}: UpcomingEventDetailModalProps) {
  // Handle escape key and body scroll lock
  useEffect(() => {
    if (!isOpen) {
      document.body.style.overflow = '';
      return;
    }

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  if (!isOpen || !event) return null;

  const formatFullDate = (date: string, time?: string) => {
    const dateObj = new Date(date);
    if (!isNaN(dateObj.getTime())) {
      return dateObj.toLocaleString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
    }

    return time ? `${date}, ${time}` : date;
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed top-1/2 left-1/2 z-50 w-full max-w-2xl -translate-x-1/2 -translate-y-1/2">
        <div className="fade-in zoom-in-95 m-4 max-h-[90vh] animate-in overflow-y-auto rounded-lg border border-white/10 bg-[#1e1e1e] p-6 shadow-2xl duration-200">
          {/* Header */}
          <div className="mb-6 flex items-start justify-between">
            <div className="flex flex-1 items-start gap-4">
              <div className="mt-1 shrink-0 text-[#0066FF]">
                <Calendar className="h-8 w-8" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="mb-3 font-bold text-2xl text-foreground leading-tight sm:text-3xl">
                  {event.title}
                </h2>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 text-gray-400 text-sm">
                    <Clock className="h-4 w-4" />
                    <span>{formatFullDate(event.date, event.time)}</span>
                  </div>
                  {event.isLive && (
                    <span className="shrink-0 rounded bg-[#0066FF]/10 px-3 py-1 font-semibold text-[#0066FF] text-sm">
                      LIVE
                    </span>
                  )}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="-mt-2 -mr-2 p-2 text-gray-400 transition-colors hover:text-foreground"
            >
              <X size={24} />
            </button>
          </div>

          {/* Image - using regular img instead of next/image */}
          {event.imageUrl && (
            <div className="mb-6 overflow-hidden rounded-lg">
              <img
                src={event.imageUrl}
                alt={event.title}
                className="h-auto w-full object-cover"
              />
            </div>
          )}

          {/* Content */}
          <div className="space-y-4">
            {event.fullDescription && (
              <div className="rounded-lg border border-white/5 bg-[#2d2d2d] p-4">
                <p className="whitespace-pre-wrap text-base text-foreground leading-relaxed sm:text-lg">
                  {event.fullDescription}
                </p>
              </div>
            )}

            {event.hint && (
              <div className="rounded-lg border border-white/5 bg-[#2d2d2d] p-4">
                <p className="mb-2 font-semibold text-gray-400 text-sm">Hint</p>
                <p className="text-base text-gray-300 italic leading-relaxed">
                  {event.hint}
                </p>
              </div>
            )}

            {/* Metadata */}
            <div className="space-y-3 border-white/10 border-t pt-4">
              {event.relatedQuestion && (
                <div>
                  <p className="text-foreground text-sm">
                    <span className="font-semibold text-gray-400">
                      Related Question:
                    </span>{' '}
                    #{event.relatedQuestion}
                  </p>
                </div>
              )}

              {event.source && (
                <div>
                  <p className="text-foreground text-sm">
                    <span className="font-semibold text-gray-400">Source:</span>{' '}
                    {event.source}
                  </p>
                </div>
              )}

              <div>
                <p className="text-gray-500 text-xs">Event ID: {event.id}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
