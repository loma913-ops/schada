import React from 'react';
import { SchadaStar } from './SchadaStar';
import {
  isPatronActive,
  type PatronCandidate,
  type PatronTier,
  type PatronSubscriptionStatus,
} from '@/core/donate/patronService';

export type { PatronCandidate, PatronTier, PatronSubscriptionStatus };

export interface PatronBadgeProps {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
  title?: string;
}

/**
 * Universal Patron Star Badge displayed next to usernames for patrons/donors.
 *
 * Algorithmic Complexity:
 * - Time Complexity: O(1) constant time render.
 * - Auxiliary Space Complexity: O(1) constant auxiliary space.
 *
 * Growth Rate:
 * - O(1) strictly bounded.
 */
export const PatronBadge: React.FC<PatronBadgeProps> = ({
  size = 13,
  className = '',
  style,
  title = 'Schada Patron',
}) => {
  const badgeClass = className ? `patron-star-badge ${className}` : 'patron-star-badge';
  return (
    <span
      className={badgeClass}
      title={title}
      aria-label={title}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        verticalAlign: 'middle',
        flexShrink: 0,
        ...style,
      }}
    >
      <SchadaStar size={size} />
    </span>
  );
};

/**
 * Determines whether a user qualifies to display the Patron Badge.
 *
 * Strict Guest Rule:
 * Guests must NEVER have the badge next to their name, even if they donate,
 * since their session will potentially be replaced when they return to the site.
 *
 * Algorithmic Complexity:
 * - Time Complexity: O(1) constant time property lookups.
 * - Auxiliary Space Complexity: O(1) constant auxiliary space.
 *
 * Growth Rate:
 * - O(1) strictly bounded.
 *
 * @param candidate Target user profile, player record, friend request, or null/undefined.
 * @returns boolean indicating if the star badge should be rendered.
 */
export function isPatronUser(candidate?: PatronCandidate | null): boolean {
  return isPatronActive(candidate);
}
