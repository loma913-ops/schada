import type { TimeControlCategory } from '@/components/lobby/lobbyConfig';
import type { WinReason } from '@/core/schada/types';

/**
 * Match History View Configuration and Validator.
 *
 * Centralizes layout parameters, tab filters, win reason badges,
 * routing paths, and copy strings for match history cards and navigation.
 * Validates configuration at startup to strictly eliminate hardcoded fallbacks.
 */

export class MatchHistoryConfigError extends Error {
  constructor(message: string) {
    super(`MatchHistoryConfigError: ${message}`);
    this.name = 'MatchHistoryConfigError';
  }
}

export type MatchHistoryTabCategory = 'all' | TimeControlCategory;

export interface MatchHistoryTabItem {
  readonly id: MatchHistoryTabCategory;
  readonly label: string;
  readonly icon: string;
}

export interface MatchHistoryConfig {
  readonly routes: {
    readonly matches: string;
    readonly userMatches: (userId: string) => string;
    readonly analysis: (gameId: string) => string;
  };
  readonly tabs: readonly MatchHistoryTabItem[];
  readonly copy: {
    readonly defaultPageTitle: string;
    readonly userPageTitleSuffix: string;
    readonly viewPastGamesButtonText: string;
    readonly loadMoreButtonText: string;
    readonly loadingMatchesText: string;
    readonly analyzeButtonText: string;
    readonly backButtonText: string;
    readonly returnToLobbyText: string;
    readonly emptyTitle: string;
    readonly emptyDescription: string;
    readonly emptyFilteredDescription: string;
    readonly victoryBadge: string;
    readonly defeatBadge: string;
    readonly drawBadge: string;
    readonly ratedBadge: string;
    readonly casualBadge: string;
    readonly botBadge: string;
    readonly whiteColorBadge: string;
    readonly blackColorBadge: string;
    readonly movesSuffix: string;
    readonly winReasons: Readonly<Record<WinReason, string>>;
  };
}

export function validateMatchHistoryConfig(config: MatchHistoryConfig): void {
  if (!config) {
    throw new MatchHistoryConfigError('Configuration object is missing or null.');
  }

  if (!config.routes || typeof config.routes !== 'object') {
    throw new MatchHistoryConfigError('Routes object is missing or invalid.');
  }

  if (typeof config.routes.matches !== 'string' || !config.routes.matches.startsWith('/')) {
    throw new MatchHistoryConfigError('Invalid routes.matches: expected non-empty absolute path.');
  }

  if (typeof config.routes.userMatches !== 'function') {
    throw new MatchHistoryConfigError('Invalid routes.userMatches: expected generator function.');
  }

  if (typeof config.routes.analysis !== 'function') {
    throw new MatchHistoryConfigError('Invalid routes.analysis: expected generator function.');
  }

  if (!Array.isArray(config.tabs) || config.tabs.length === 0) {
    throw new MatchHistoryConfigError('Invalid tabs: expected non-empty array of MatchHistoryTabItem.');
  }

  const validTabCategories = new Set<string>([
    'all',
    'bullet',
    'blitz',
    'rapid',
    'classical',
    'correspondence',
  ]);

  for (let i = 0; i < config.tabs.length; i++) {
    const tab = config.tabs[i];
    if (!tab || typeof tab !== 'object') {
      throw new MatchHistoryConfigError(`Invalid tabs[${i}]: expected object.`);
    }
    if (!validTabCategories.has(tab.id)) {
      throw new MatchHistoryConfigError(`Invalid tabs[${i}].id: "${tab.id}" is not a recognized category.`);
    }
    if (typeof tab.label !== 'string' || tab.label.trim().length === 0) {
      throw new MatchHistoryConfigError(`Invalid tabs[${i}].label: expected non-empty string.`);
    }
    if (typeof tab.icon !== 'string' || tab.icon.trim().length === 0) {
      throw new MatchHistoryConfigError(`Invalid tabs[${i}].icon: expected non-empty string.`);
    }
  }

  const copy = config.copy;
  if (!copy || typeof copy !== 'object') {
    throw new MatchHistoryConfigError('Copy section is missing or invalid.');
  }

  const requiredCopyKeys: (keyof Omit<MatchHistoryConfig['copy'], 'winReasons'>)[] = [
    'defaultPageTitle',
    'userPageTitleSuffix',
    'viewPastGamesButtonText',
    'loadMoreButtonText',
    'loadingMatchesText',
    'analyzeButtonText',
    'backButtonText',
    'returnToLobbyText',
    'emptyTitle',
    'emptyDescription',
    'emptyFilteredDescription',
    'victoryBadge',
    'defeatBadge',
    'drawBadge',
    'ratedBadge',
    'casualBadge',
    'botBadge',
    'whiteColorBadge',
    'blackColorBadge',
    'movesSuffix',
  ];

  for (const key of requiredCopyKeys) {
    if (typeof copy[key] !== 'string' || (copy[key] as string).trim().length === 0) {
      throw new MatchHistoryConfigError(`Invalid copy.${key}: expected non-empty string.`);
    }
  }

  if (!copy.winReasons || typeof copy.winReasons !== 'object') {
    throw new MatchHistoryConfigError('Copy winReasons section is missing or invalid.');
  }

  const requiredWinReasons: WinReason[] = [
    'goal_reached',
    'elimination',
    'timeout',
    'resignation',
    'repetition',
    'blocked',
    'mutual_shuffle',
    'agreement',
    'abandonment',
  ];

  for (const reason of requiredWinReasons) {
    if (typeof copy.winReasons[reason] !== 'string' || copy.winReasons[reason].trim().length === 0) {
      throw new MatchHistoryConfigError(`Invalid copy.winReasons.${reason}: expected non-empty string.`);
    }
  }
}

export const CANONICAL_MATCH_HISTORY_CONFIG: MatchHistoryConfig = Object.freeze({
  routes: Object.freeze({
    matches: '/matches',
    userMatches: (userId: string) => `/matches/${userId}`,
    analysis: (gameId: string) => `/analysis/${gameId}`,
  }),
  tabs: Object.freeze([
    Object.freeze({ id: 'all' as const, label: 'All', icon: '♟️' }),
    Object.freeze({ id: 'bullet' as const, label: 'Bullet', icon: '⚡' }),
    Object.freeze({ id: 'blitz' as const, label: 'Blitz', icon: '🔥' }),
    Object.freeze({ id: 'rapid' as const, label: 'Rapid', icon: '⏱️' }),
    Object.freeze({ id: 'classical' as const, label: 'Classical', icon: '♟️' }),
    Object.freeze({ id: 'correspondence' as const, label: 'Correspondence', icon: '✉️' }),
  ]),
  copy: Object.freeze({
    defaultPageTitle: 'Match History',
    userPageTitleSuffix: "'s Matches",
    viewPastGamesButtonText: 'View past games',
    loadMoreButtonText: 'Load More Matches',
    loadingMatchesText: 'Loading match records...',
    analyzeButtonText: 'Analyze',
    backButtonText: 'Back',
    returnToLobbyText: 'Return to Lobby',
    emptyTitle: 'No matches found',
    emptyDescription: 'No finished games recorded yet. Play a match to build your history!',
    emptyFilteredDescription: 'No finished games recorded for this time control category.',
    victoryBadge: 'VICTORY',
    defeatBadge: 'DEFEAT',
    drawBadge: 'DRAW',
    ratedBadge: 'Rated',
    casualBadge: 'Casual',
    botBadge: 'Bot',
    whiteColorBadge: 'White',
    blackColorBadge: 'Black',
    movesSuffix: 'moves',
    winReasons: Object.freeze({
      goal_reached: 'Goal Reached',
      elimination: 'Elimination',
      timeout: 'On Time',
      resignation: 'Resignation',
      repetition: '3-Fold Repetition',
      blocked: 'High Pieces Blocked',
      mutual_shuffle: 'Mutual Shuffle',
      agreement: 'Mutual Draw',
      abandonment: 'Abandonment',
    }),
  }),
});

// Self-validate canonical configuration at module initialization
validateMatchHistoryConfig(CANONICAL_MATCH_HISTORY_CONFIG);

