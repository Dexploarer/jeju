import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Utility function to merge Tailwind CSS classes with clsx.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/**
 * Get profile URL for a user.
 */
export function getProfileUrl(userId: string, username: string | null): string {
  if (username) {
    return `/profile/@${username}`;
  }
  return `/profile/${userId}`;
}

/**
 * Get referral URL for a user.
 */
export function getReferralUrl(referralCode: string): string {
  return `${window.location.origin}/?ref=${referralCode}`;
}

/**
 * Get display referral URL (shortened for display).
 */
export function getDisplayReferralUrl(referralCode: string): string {
  return `${window.location.host}/?ref=${referralCode}`;
}

/**
 * Sanitize ID for use in URLs and file paths.
 */
export function sanitizeId(id: string): string {
  return id.toLowerCase().replace(/[^a-z0-9-]/g, '-');
}

/**
 * Points configuration.
 */
export const POINTS = {
  REFERRAL_SIGNUP: 50,
  PROFILE_COMPLETION: 100,
} as const;
