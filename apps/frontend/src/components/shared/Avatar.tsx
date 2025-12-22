/**
 * Avatar Component
 */

import { cn } from '@babylon/shared';

interface AvatarProps {
  id: string;
  name: string;
  type?: 'user' | 'actor' | 'business';
  size?: 'sm' | 'md' | 'lg';
  src?: string;
  imageUrl?: string;
  className?: string;
  scaleFactor?: number;
}

export function Avatar({
  name,
  size = 'md',
  src,
  imageUrl,
  className,
  scaleFactor = 1,
}: AvatarProps) {
  const baseSizes = {
    sm: { h: 32, w: 32, text: 12 },
    md: { h: 40, w: 40, text: 14 },
    lg: { h: 48, w: 48, text: 16 },
  };

  const base = baseSizes[size];
  const scaledH = Math.round(base.h * scaleFactor);
  const scaledW = Math.round(base.w * scaleFactor);
  const scaledText = Math.round(base.text * scaleFactor);

  const sizeStyles = {
    height: `${scaledH}px`,
    width: `${scaledW}px`,
    fontSize: `${scaledText}px`,
  };

  const imageSrc = src || imageUrl;
  const initials = name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  if (imageSrc) {
    return (
      <img
        src={imageSrc}
        alt={name}
        style={sizeStyles}
        className={cn('rounded-full object-cover', className)}
      />
    );
  }

  return (
    <div
      style={sizeStyles}
      className={cn(
        'flex items-center justify-center rounded-full bg-primary/10 font-medium text-primary',
        className
      )}
    >
      {initials}
    </div>
  );
}
