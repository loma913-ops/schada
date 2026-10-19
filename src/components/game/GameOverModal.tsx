import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { GameResult, PieceColor, Move } from '@/core/schada/types';
import confetti from 'canvas-confetti';
import { soundService } from '@/services/audio/soundService';
import { haptics } from '@/services/device/haptics';
import { Trophy, Award, RefreshCw, Home, X, Eye } from 'lucide-react';
import { calculateEloUpdate } from '@/core/elo/eloService';
import { ELO_CONFIG } from '@/core/elo/eloConfig';
import type { GameAnalysisReport } from '@/core/analysis/analysisTypes';
import { CANONICAL_ANALYSIS_CONFIG } from '@/core/analysis/analysisConfig';
import { analyzeGame } from '@/core/analysis/analysisEngine';
import { createEmptyAnalysisReport } from '@/core/analysis/accuracyCalculator';
import { MoveQualityBadge } from './MoveQualityBadge';
import {
  GAME_OVER_MODAL_CONFIG,
  validateGameOverModalConfig,
  type GameOverModalConfig,
} from './gameOverConfig';
import {
  PatronBadge,
  isPatronUser,
  type PatronTier,
  type PatronSubscriptionStatus,
} from '@/components/common/PatronBadge';

export interface GameOverPlayerInfo {
  readonly id?: string;
  readonly username?: string;
  readonly elo: number;
  readonly gamesPlayed?: number;
  readonly isPatron?: boolean;
  readonly hasDonated?: boolean;
  readonly patronTier?: PatronTier;
  readonly patronExpiresAt?: string | null;
  readonly patronSubscriptionStatus?: PatronSubscriptionStatus;
}

export interface PlayerEloUpdate {
  readonly newElo: number;
  readonly delta: number;
}

export interface GameOverModalProps {
  readonly result: GameResult;
  readonly userColor?: PieceColor;
  readonly isRanked?: boolean;
  readonly whitePlayer?: GameOverPlayerInfo;
  readonly blackPlayer?: GameOverPlayerInfo;
  readonly whiteElo?: PlayerEloUpdate;
  readonly blackElo?: PlayerEloUpdate;
  /** @deprecated Backwards compatibility alias for whiteElo */
  readonly blueElo?: PlayerEloUpdate;
  /** @deprecated Backwards compatibility alias for blackElo */
  readonly greenElo?: PlayerEloUpdate;
  readonly eloDelta?: number;
  readonly config?: GameOverModalConfig;
  readonly triggerEffects?: boolean;
  readonly onEffectsPlayed?: () => void;
  readonly onRematch?: () => void;
  readonly onHome: () => void;
  readonly onClose?: () => void;
  readonly analysisReport?: GameAnalysisReport | null;
  readonly isAnalyzing?: boolean;
  readonly moveHistory?: readonly Move[];
}

/**
 * Game Over Modal Component.
 *
 * Displays match outcome, win reason, and scoring breakdown.
 * For rated matches, calculates and displays both players' updated Elo ratings
 * and delta changes formatted as ELO (GAIN/LOSS) directly underneath their respective colors.
 * Features Move Quality Distribution table with symbol graphics and player accuracy stats.
 * Allows dismissing modal via close button, review action, backdrop click, or Escape key to inspect the board.
 *
 * Algorithmic Complexity:
 * - Time Complexity: O(1) rendering static elements or O(N) when running engine analysis on N plies.
 * - Auxiliary Space Complexity: O(1) constant auxiliary space.
 *
 * Growth Rate:
 * - O(1) constant time and space complexity for rendering.
 */
export const GameOverModal: React.FC<GameOverModalProps> = ({
  result,
  userColor,
  isRanked = false,
  whitePlayer,
  blackPlayer,
  whiteElo,
  blackElo,
  blueElo,
  greenElo,
  eloDelta,
  config = GAME_OVER_MODAL_CONFIG,
  triggerEffects = true,
  onEffectsPlayed,
  onRematch,
  onHome,
  onClose,
  analysisReport,
  isAnalyzing,
  moveHistory,
}) => {
  validateGameOverModalConfig(config);

  const [internalReport, setInternalReport] = useState<GameAnalysisReport | null>(null);
  const [internalAnalyzing, setInternalAnalyzing] = useState(false);

  useEffect(() => {
    if (analysisReport !== undefined || isAnalyzing !== undefined) return;
    if (!moveHistory || moveHistory.length === 0) {
      setInternalReport(createEmptyAnalysisReport());
      return;
    }

    setInternalAnalyzing(true);
    try {
      const rep = analyzeGame(
        {
          metadata: {},
          notations: moveHistory.map((m) => m.notation),
          moves: moveHistory,
          rawText: '',
          isComplete: true,
        },
        {
          depth: CANONICAL_ANALYSIS_CONFIG.search.postGameDepth,
          timeLimitMs: CANONICAL_ANALYSIS_CONFIG.search.postGameTimeLimitMs,
        }
      );
      setInternalReport(rep);
    } catch (err) {
      console.error('Local game analysis failed in GameOverModal:', err);
    } finally {
      setInternalAnalyzing(false);
    }
  }, [analysisReport, isAnalyzing, moveHistory]);

  const effectiveAnalyzing = isAnalyzing ?? internalAnalyzing;
  const effectiveReport = analysisReport ?? internalReport;

  const isWinner = userColor && result.winner === userColor;
  const isDraw = result.winner === 'draw';

  const eloInfo = useMemo(() => {
    if (!isRanked) return null;
    const effectiveWhite = whiteElo ?? blueElo;
    const effectiveBlack = blackElo ?? greenElo;
    if (effectiveWhite && effectiveBlack) {
      return {
        white: effectiveWhite,
        black: effectiveBlack,
        blue: effectiveWhite,
        green: effectiveBlack,
      };
    }
    if (whitePlayer && blackPlayer && result.winner) {
      const outcome = result.winner;
      const calculation = calculateEloUpdate(
        {
          rating: whitePlayer.elo,
          gamesPlayed: whitePlayer.gamesPlayed ?? ELO_CONFIG.defaultAssumedGamesPlayed,
        },
        {
          rating: blackPlayer.elo,
          gamesPlayed: blackPlayer.gamesPlayed ?? ELO_CONFIG.defaultAssumedGamesPlayed,
        },
        outcome
      );
      const wUpdate = { newElo: calculation.newWhiteRating, delta: calculation.whiteDelta };
      const bUpdate = { newElo: calculation.newBlackRating, delta: calculation.blackDelta };
      return {
        white: wUpdate,
        black: bUpdate,
        blue: wUpdate,
        green: bUpdate,
      };
    }
    return null;
  }, [isRanked, whiteElo, blackElo, blueElo, greenElo, whitePlayer, blackPlayer, result.winner]);

  const effectsFiredRef = useRef(false);

  useEffect(() => {
    if (!triggerEffects || effectsFiredRef.current) return;
    effectsFiredRef.current = true;
    haptics.gameOver();
    if (isWinner) {
      soundService.playVictory();
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
      });
    }
    onEffectsPlayed?.();
  }, [isWinner, triggerEffects, onEffectsPlayed]);

  useEffect(() => {
    if (!onClose) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const getReasonText = (): string => {
    if (result.winReason && config.copy.winReasons[result.winReason]) {
      return config.copy.winReasons[result.winReason];
    }
    return config.copy.defaultGameCompletedText;
  };

  const isWhiteWinner = result.winner === 'white' || (result.winner as string) === 'blue';
  const isBlackWinner = result.winner === 'black' || (result.winner as string) === 'green';
  const winnerPlayer = isWhiteWinner ? whitePlayer : isBlackWinner ? blackPlayer : null;
  const defaultWhiteName = config.copy.defaultWhitePlayerName ?? config.copy.defaultwhitePlayerName ?? 'White';
  const defaultBlackName = config.copy.defaultBlackPlayerName ?? config.copy.defaultblackPlayerName ?? 'Black';
  const winnerDisplayName =
    winnerPlayer?.username ||
    (isWhiteWinner
      ? defaultWhiteName
      : isBlackWinner
        ? defaultBlackName
        : null);

  const modalTitle = isWinner
    ? config.copy.victoryTitle
    : isDraw
      ? config.copy.drawTitle
      : winnerDisplayName
        ? `${winnerDisplayName} ${config.copy.winnerTitleSuffix}`
        : config.copy.defaultGameOverTitle;

  const gridColumns =
    isRanked && eloInfo
      ? config.layout.gridColumnsRanked
      : config.layout.gridColumnsUnranked;

  return (
    <div
      className="modal-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="game-over-title"
    >
      <div
        className="modal-content game-over-modal-content"
        style={{
          textAlign: 'center',
          position: 'relative',
          maxHeight: `${config.layout.maxModalHeightVh}vh`,
          display: 'flex',
          flexDirection: 'column',
          padding: 0,
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Frozen Top Header */}
        <div
          className="game-over-modal-header"
          style={{
            flexShrink: 0,
            padding: '1.5rem 1.5rem 0.5rem',
            position: 'relative',
          }}
        >
          {onClose && (
            <button
              type="button"
              className="modal-close-btn"
              onClick={onClose}
              aria-label={config.copy.closeButtonAriaLabel}
              style={{
                position: 'absolute',
                top: '1rem',
                right: '1rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <X size={18} />
            </button>
          )}

          <div style={{ marginBottom: '0.75rem' }}>
            {isWinner ? (
              <Trophy size={48} color="var(--accent-gold)" style={{ margin: '0 auto' }} />
            ) : isDraw ? (
              <Award size={48} color="var(--accent-gold)" style={{ margin: '0 auto' }} />
            ) : (
              <div style={{ fontSize: '2.5rem' }}>⚔️</div>
            )}
          </div>

          <h2
            id="game-over-title"
            style={{
              fontSize: '1.6rem',
              fontWeight: 800,
              marginBottom: '0.25rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.35rem',
            }}
          >
            <span>{modalTitle}</span>
            {!isWinner && !isDraw && isPatronUser(winnerPlayer) && (
              <PatronBadge size={18} style={{ flexShrink: 0 }} />
            )}
          </h2>

          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', margin: 0 }}>
            {getReasonText()}
          </p>
        </div>

        {/* Scrollable Middle Content */}
        <div
          className="game-over-modal-body"
          style={{
            flex: '1 1 auto',
            minHeight: 0,
            overflowY: 'auto',
            padding: '0.75rem 1.5rem',
          }}
        >
          {/* Score Breakdown Table */}
          <div
            style={{
              backgroundColor: 'var(--bg-tertiary)',
              borderRadius: 'var(--radius-sm)',
              padding: '0.8rem',
              marginBottom: '0.75rem',
              fontSize: '0.85rem',
            }}
          >
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: gridColumns,
                fontWeight: 700,
                paddingBottom: '0.4rem',
                borderBottom: '1px solid var(--border-subtle)',
                alignItems: 'center',
              }}
            >
              <span>{config.copy.categoryHeader}</span>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 0 }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem', maxWidth: '100%' }}>
                  <span style={{ color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {whitePlayer?.username || defaultWhiteName}
                  </span>
                  {isPatronUser(whitePlayer) && <PatronBadge size={12} style={{ flexShrink: 0 }} />}
                </div>
                {isRanked && eloInfo && (
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      whiteSpace: 'nowrap',
                      marginTop: '0.15rem',
                    }}
                  >
                    <span style={{ color: 'var(--text-primary)' }}>{eloInfo.white.newElo}</span>{' '}
                    <span
                      style={{
                        color:
                          eloInfo.white.delta > 0
                            ? 'var(--accent-green)'
                            : eloInfo.white.delta < 0
                              ? 'var(--accent-red)'
                              : 'var(--text-muted)',
                        fontWeight: 700,
                      }}
                    >
                      ({eloInfo.white.delta >= 0 ? `+${eloInfo.white.delta}` : eloInfo.white.delta})
                    </span>
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 0 }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem', maxWidth: '100%' }}>
                  <span style={{ color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {blackPlayer?.username || defaultBlackName}
                  </span>
                  {isPatronUser(blackPlayer) && <PatronBadge size={12} style={{ flexShrink: 0 }} />}
                </div>
                {isRanked && eloInfo && (
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      whiteSpace: 'nowrap',
                      marginTop: '0.15rem',
                    }}
                  >
                    <span style={{ color: 'var(--text-primary)' }}>{eloInfo.black.newElo}</span>{' '}
                    <span
                      style={{
                        color:
                          eloInfo.black.delta > 0
                            ? 'var(--accent-green)'
                            : eloInfo.black.delta < 0
                              ? 'var(--accent-red)'
                              : 'var(--text-muted)',
                        fontWeight: 700,
                      }}
                    >
                      ({eloInfo.black.delta >= 0 ? `+${eloInfo.black.delta}` : eloInfo.black.delta})
                    </span>
                  </span>
                )}
              </div>
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: gridColumns,
                padding: '0.3rem 0',
                alignItems: 'center',
              }}
            >
              <span style={{ color: 'var(--text-secondary)' }}>{config.copy.goalScoreLabel}</span>
              <span>{(result.whiteScore ?? result.blueScore)?.goalScore ?? 0}</span>
              <span>{(result.blackScore ?? result.greenScore)?.goalScore ?? 0}</span>
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: gridColumns,
                padding: '0.3rem 0',
                alignItems: 'center',
              }}
            >
              <span style={{ color: 'var(--text-secondary)' }}>{config.copy.outsideHighPiecesLabel}</span>
              <span>{(result.whiteScore ?? result.blueScore)?.outsideGoalHighPiecesScore ?? 0}</span>
              <span>{(result.blackScore ?? result.greenScore)?.outsideGoalHighPiecesScore ?? 0}</span>
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: gridColumns,
                padding: '0.3rem 0',
                alignItems: 'center',
              }}
            >
              <span style={{ color: 'var(--text-secondary)' }}>{config.copy.rankDistanceLabel}</span>
              <span>{(result.whiteScore ?? result.blueScore)?.rankDistanceScore ?? 0}</span>
              <span>{(result.blackScore ?? result.greenScore)?.rankDistanceScore ?? 0}</span>
            </div>
          </div>

          {/* Move Quality Distribution Section */}
          <div
            style={{
              backgroundColor: 'var(--bg-tertiary)',
              borderRadius: 'var(--radius-sm)',
              padding: '0.8rem',
              marginBottom: '0.75rem',
              fontSize: '0.85rem',
            }}
            data-testid="move-quality-distribution-section"
          >
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: gridColumns,
                fontWeight: 700,
                paddingBottom: '0.4rem',
                borderBottom: '1px solid var(--border-subtle)',
                alignItems: 'center',
              }}
            >
              <span style={{ textAlign: 'left' }}>{config.copy.classificationHeader}</span>
              <span style={{ color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {whitePlayer?.username || defaultWhiteName}
              </span>
              <span style={{ color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {blackPlayer?.username || defaultBlackName}
              </span>
            </div>

            {effectiveAnalyzing ? (
              <div style={{ padding: '0.35rem 0' }} data-testid="analysis-loading-skeleton">
                {config.layout.distributionQualities.map((quality) => (
                  <div
                    key={`skeleton-${quality}`}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: gridColumns,
                      padding: '0.28rem 0',
                      alignItems: 'center',
                    }}
                  >
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem' }}>
                      <div
                        className="modal-skeleton modal-skeleton-badge"
                        style={{
                          width: config.layout.badgeSizePx,
                          height: config.layout.badgeSizePx,
                        }}
                      />
                      <div className="modal-skeleton modal-skeleton-label" />
                    </div>
                    <div className="modal-skeleton modal-skeleton-count" />
                    <div className="modal-skeleton modal-skeleton-count" />
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ padding: '0.2rem 0' }}>
                {config.layout.distributionQualities.map((quality) => {
                  const badgeConfig = CANONICAL_ANALYSIS_CONFIG.badges[quality];
                  const whiteCount = (effectiveReport?.whiteBreakdown ?? effectiveReport?.blueBreakdown)?.[quality] ?? 0;
                  const blackCount = (effectiveReport?.blackBreakdown ?? effectiveReport?.greenBreakdown)?.[quality] ?? 0;

                  return (
                    <div
                      key={quality}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: gridColumns,
                        padding: '0.25rem 0',
                        alignItems: 'center',
                      }}
                    >
                      <div
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.45rem',
                          textAlign: 'left',
                          minWidth: 0,
                        }}
                      >
                        <MoveQualityBadge quality={quality} forceRender size={config.layout.badgeSizePx} />
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {badgeConfig.label}
                        </span>
                      </div>
                      <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{whiteCount}</span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{blackCount}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Accuracy Section */}
          <div
            style={{
              backgroundColor: 'var(--bg-tertiary)',
              borderRadius: 'var(--radius-sm)',
              padding: '0.7rem 0.8rem',
              marginBottom: (!eloInfo && eloDelta !== undefined) ? '0.75rem' : '0.25rem',
              fontSize: '0.85rem',
              display: 'grid',
              gridTemplateColumns: gridColumns,
              alignItems: 'center',
              fontWeight: 700,
            }}
            data-testid="accuracy-section"
          >
            <span style={{ textAlign: 'left' }}>{config.copy.accuracyLabel}</span>
            {effectiveAnalyzing ? (
              <>
                <div className="modal-skeleton modal-skeleton-accuracy" />
                <div className="modal-skeleton modal-skeleton-accuracy" />
              </>
            ) : (
              <>
                <span
                  style={{
                    color: 'var(--text-primary)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.9rem',
                    fontWeight: 800,
                  }}
                >
                  {effectiveReport
                    ? `${((effectiveReport.whiteAccuracy ?? effectiveReport.blueAccuracy) ?? CANONICAL_ANALYSIS_CONFIG.accuracy.perfectAccuracy).toFixed(CANONICAL_ANALYSIS_CONFIG.accuracy.accuracyDecimals)}%`
                    : `${CANONICAL_ANALYSIS_CONFIG.accuracy.perfectAccuracy.toFixed(CANONICAL_ANALYSIS_CONFIG.accuracy.accuracyDecimals)}%`}
                </span>
                <span
                  style={{
                    color: 'var(--text-primary)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.9rem',
                    fontWeight: 800,
                  }}
                >
                  {effectiveReport
                    ? `${((effectiveReport.blackAccuracy ?? effectiveReport.greenAccuracy) ?? CANONICAL_ANALYSIS_CONFIG.accuracy.perfectAccuracy).toFixed(CANONICAL_ANALYSIS_CONFIG.accuracy.accuracyDecimals)}%`
                    : `${CANONICAL_ANALYSIS_CONFIG.accuracy.perfectAccuracy.toFixed(CANONICAL_ANALYSIS_CONFIG.accuracy.accuracyDecimals)}%`}
                </span>
              </>
            )}
          </div>

          {/* Elo Delta Badge (fallback when eloInfo is not available) */}
          {!eloInfo && eloDelta !== undefined && (
            <div style={{ marginBottom: '0.25rem', fontFamily: 'var(--font-mono)' }}>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginRight: '0.5rem' }}>
                {config.copy.ratingChangeLabel}
              </span>
              <span
                style={{
                  fontWeight: 700,
                  fontSize: '1.1rem',
                  color: eloDelta >= 0 ? 'var(--accent-green)' : 'var(--accent-red)',
                }}
              >
                {eloDelta >= 0 ? `+${eloDelta}` : `${eloDelta}`}
              </span>
            </div>
          )}
        </div>

        {/* Frozen Bottom Footer */}
        <div
          className="game-over-modal-footer"
          style={{
            flexShrink: 0,
            padding: '0.75rem 1.5rem 1.25rem',
            borderTop: '1px solid var(--border-subtle)',
            backgroundColor: 'var(--bg-secondary)',
          }}
        >
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            {onRematch && (
              <button
                type="button"
                className="btn-primary"
                onClick={onRematch}
                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', padding: '0.75rem' }}
              >
                <RefreshCw size={16} />
                <span>{config.copy.rematchButtonText}</span>
              </button>
            )}
            {onClose && (
              <button
                type="button"
                className="action-btn"
                style={{ flex: 1, padding: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}
                onClick={onClose}
              >
                <Eye size={16} />
                <span>{config.copy.reviewButtonText}</span>
              </button>
            )}
            <button
              type="button"
              className="action-btn"
              style={{ flex: 1, padding: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}
              onClick={onHome}
            >
              <Home size={16} />
              <span>{config.copy.lobbyButtonText}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
