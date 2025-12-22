import { useLocation, useSearchParams } from 'react-router-dom';
import { useLoginModal } from '@/hooks/useLoginModal';
import { LoginModal } from './LoginModal';

/**
 * Global login modal component.
 *
 * Connects to the global login modal state and displays LoginModal when needed.
 * Automatically hides on production home page unless dev mode is enabled.
 * Uses Zustand store for global state management.
 *
 * @returns Global login modal element or null if hidden/not open
 */
export function GlobalLoginModal() {
  const { isOpen, closeLoginModal, title, message } = useLoginModal();
  const [searchParams] = useSearchParams();
  const location = useLocation();

  // Check if dev mode is enabled via URL parameter
  const isDevMode = searchParams.get('dev') === 'true';

  // Hide on production (babylon.market) on home page unless ?dev=true
  const isProduction = window.location.hostname === 'babylon.market';
  const isHomePage = location.pathname === '/';
  const shouldHide = isProduction && isHomePage && !isDevMode;

  // If should be hidden, don't render anything
  if (shouldHide) {
    return null;
  }

  return (
    <LoginModal
      isOpen={isOpen}
      onClose={closeLoginModal}
      title={title}
      message={message}
    />
  );
}
