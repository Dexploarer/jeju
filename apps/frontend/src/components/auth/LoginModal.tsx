/**
 * Login Modal Component
 */
export interface LoginModalProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  message?: string
}

export function LoginModal({ isOpen, onClose, title, message }: LoginModalProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-lg bg-background p-6 shadow-lg">
        <h2 className="text-lg font-semibold">{title || 'Login'}</h2>
        {message && <p className="mt-2 text-muted-foreground">{message}</p>}
        <button
          onClick={onClose}
          className="mt-4 rounded-md bg-primary px-4 py-2 text-primary-foreground"
        >
          Close
        </button>
      </div>
    </div>
  )
}
