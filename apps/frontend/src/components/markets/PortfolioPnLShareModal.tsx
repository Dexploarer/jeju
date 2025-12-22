/**
 * Portfolio PnL Share Modal
 */

interface PortfolioPnLShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: unknown;
  user: { id: string } | null;
  lastUpdated: Date | null;
}

export function PortfolioPnLShareModal({
  isOpen,
  onClose,
}: PortfolioPnLShareModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-lg border border-border bg-background p-6">
        <h3 className="mb-4 font-bold text-lg">Share Portfolio P&L</h3>
        <button
          onClick={onClose}
          className="w-full rounded-lg bg-muted px-4 py-2"
        >
          Close
        </button>
      </div>
    </div>
  );
}
