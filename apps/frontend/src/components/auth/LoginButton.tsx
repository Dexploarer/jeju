/**
 * Login Button Component
 */

import { useAuth } from '../../hooks/useAuth';
import { Button } from '../ui/button';

export function LoginButton() {
  const { login } = useAuth();

  return (
    <Button onClick={login} className="bg-[#0066FF] hover:bg-[#2952d9]">
      Sign In
    </Button>
  );
}
