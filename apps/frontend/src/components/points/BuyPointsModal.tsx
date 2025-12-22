/**
 * Buy Points Modal
 */

interface BuyPointsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function BuyPointsModal({
  isOpen,
  onClose,
}: BuyPointsModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-lg border border-border bg-background p-6">
        <h3 className="mb-4 font-bold text-lg">Buy Points</h3>
        <p className="mb-4 text-muted-foreground">
          Purchase points to trade and bet.
        </p>
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
