import { Activity, Calendar, DollarSign, TrendingUp, X } from 'lucide-react';
import { useEffect } from 'react';

/**
 * Breaking news item structure for detail modal.
 */
type BreakingNewsItem = {
  id: string;
  title: string;
  description: string;
  icon: 'chart' | 'calendar' | 'dollar' | 'trending';
  timestamp: string;
  trending?: boolean;
  source?: string;
  fullDescription?: string;
  imageUrl?: string;
  relatedQuestion?: number;
  relatedActorId?: string;
  relatedOrganizationId?: string;
};

interface BreakingNewsDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: BreakingNewsItem | null;
}

/**
 * Breaking news detail modal component for displaying full news article.
 * Converted from Next.js to plain React.
 */
export function BreakingNewsDetailModal({
  isOpen,
  onClose,
  item,
}: BreakingNewsDetailModalProps) {
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

  if (!isOpen || !item) return null;

  const getIcon = (icon: BreakingNewsItem['icon']) => {
    switch (icon) {
      case 'chart':
        return <TrendingUp className="h-8 w-8" />;
      case 'calendar':
        return <Calendar className="h-8 w-8" />;
      case 'dollar':
        return <DollarSign className="h-8 w-8" />;
      default:
        return <Activity className="h-8 w-8" />;
    }
  };

  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
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
                {getIcon(item.icon)}
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="mb-3 font-bold text-2xl text-foreground leading-tight sm:text-3xl">
                  {item.title}
                </h2>
                <div className="flex items-center gap-3 text-gray-400 text-sm">
                  <span>{formatDate(item.timestamp)}</span>
                  {item.trending && (
                    <span className="font-semibold text-[#0066FF]">
                      • Trending
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
          {item.imageUrl && (
            <div className="mb-6 overflow-hidden rounded-lg">
              <img
                src={item.imageUrl}
                alt={item.title}
                className="h-auto w-full object-cover"
              />
            </div>
          )}

          {/* Content */}
          <div className="space-y-4">
            <div className="rounded-lg border border-white/5 bg-[#2d2d2d] p-4">
              <p className="whitespace-pre-wrap text-base text-foreground leading-relaxed sm:text-lg">
                {item.fullDescription || item.description}
              </p>
            </div>

            {/* Metadata */}
            <div className="space-y-3 border-white/10 border-t pt-4">
              {item.relatedQuestion && (
                <div>
                  <p className="text-foreground text-sm">
                    <span className="font-semibold text-gray-400">
                      Related Question:
                    </span>{' '}
                    #{item.relatedQuestion}
                  </p>
                </div>
              )}

              {item.source && (
                <div>
                  <p className="text-foreground text-sm">
                    <span className="font-semibold text-gray-400">Source:</span>{' '}
                    {item.source}
                  </p>
                </div>
              )}

              <div>
                <p className="text-gray-500 text-xs">News ID: {item.id}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
