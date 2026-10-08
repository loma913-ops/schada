import React, { useEffect, useRef, useMemo, memo } from 'react';
import type { Move } from '@/core/schada/types';
import type { MoveQuality } from '@/core/analysis/analysisConfig';
import { Sparkles, Loader2 } from 'lucide-react';
import { MoveNavigator } from './MoveNavigator';
import { MoveQualityBadge } from './MoveQualityBadge';
import {
  type MoveNavigatorConfig,
  CANONICAL_MOVE_NAVIGATOR_CONFIG,
  validateMoveNavigatorConfig,
} from './moveNavigatorConfig';
import {
  type AnalysisDisplayConfig,
  CANONICAL_ANALYSIS_DISPLAY_CONFIG,
  validateAnalysisDisplayConfig,
} from './analysisDisplayConfig';

export interface MoveHistoryProps {
  readonly history: readonly Move[];
  readonly currentMoveIndex?: number;
  readonly onNavigateMove?: (index: number) => void;
  readonly isReview?: boolean;
  readonly onAnalyze?: () => void;
  readonly isAnalyzing?: boolean;
  readonly analysisProgress?: { readonly current: number; readonly total: number } | null;
  readonly analyzedQualities?: Readonly<Record<number, MoveQuality>>;
  readonly onCancelAnalysis?: () => void;
  readonly config?: MoveNavigatorConfig;
  readonly displayConfig?: AnalysisDisplayConfig;
}

interface MoveRowPair {
  readonly num: number;
  readonly blueIndex: number;
  readonly greenIndex: number;
  readonly blue?: Move;
  readonly green?: Move;
  readonly blueQuality?: MoveQuality;
  readonly greenQuality?: MoveQuality;
}

export const MoveHistory: React.FC<MoveHistoryProps> = memo(function MoveHistory({
  history,
  currentMoveIndex = history.length > 0
    ? history.length - 1
    : CANONICAL_MOVE_NAVIGATOR_CONFIG.startMoveIndex,
  onNavigateMove,
  isReview = false,
  onAnalyze,
  isAnalyzing = false,
  analysisProgress = null,
  analyzedQualities,
  onCancelAnalysis,
  config = CANONICAL_MOVE_NAVIGATOR_CONFIG,
  displayConfig = CANONICAL_ANALYSIS_DISPLAY_CONFIG,
}) {
  validateMoveNavigatorConfig(config);
  validateAnalysisDisplayConfig(displayConfig);
  const listRef = useRef<HTMLDivElement>(null);

  // Group moves into pairs (Blue, Green) with corresponding quality badges
  const movePairs: readonly MoveRowPair[] = useMemo(() => {
    const pairs: MoveRowPair[] = [];
    for (let i = 0; i < history.length; i += 2) {
      const blueIdx = i;
      const greenIdx = i + 1;
      pairs.push({
        num: Math.floor(i / 2) + 1,
        blueIndex: blueIdx,
        greenIndex: greenIdx,
        blue: history[blueIdx],
        green: history[greenIdx],
        blueQuality: analyzedQualities?.[blueIdx],
        greenQuality: analyzedQualities?.[greenIdx],
      });
    }
    return pairs;
  }, [history, analyzedQualities]);

  // Auto-scroll list when new moves are appended
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [history.length]);

  // Keep the active move visible in view when stepping through history
  useEffect(() => {
    if (listRef.current && currentMoveIndex !== undefined && currentMoveIndex >= 0) {
      const activeEl = listRef.current.querySelector<HTMLElement>('.move-cell.active');
      if (activeEl) {
        activeEl.scrollIntoView({ block: 'nearest', behavior: 'auto' });
      }
    }
  }, [currentMoveIndex]);

  const hasExistingAnalysis = useMemo(
    () => Boolean(analyzedQualities && Object.keys(analyzedQualities).length > 0),
    [analyzedQualities]
  );

  return (
    <div className="move-history-container">
      <div className="move-history-sticky-top">
        <MoveNavigator
          currentIndex={currentMoveIndex}
          totalMoves={history.length}
          onNavigate={onNavigateMove}
          config={config}
        />
        <div className="move-history-header">
          <span>{config.historyCopy.headerTitle}</span>
          {isReview && (
            isAnalyzing ? (
              <button
                type="button"
                className="move-history-analyze-btn analyzing"
                onClick={onCancelAnalysis}
                title={displayConfig.copy.cancelAriaLabel}
                aria-label={displayConfig.copy.cancelAriaLabel}
              >
                <Loader2 size={13} className="analyze-btn-icon spin" />
                <span>
                  {analysisProgress
                    ? `${displayConfig.copy.analyzingPrefix} ${analysisProgress.current}/${analysisProgress.total}...`
                    : `${displayConfig.copy.analyzingPrefix}...`}
                </span>
              </button>
            ) : (
              <button
                type="button"
                className="move-history-analyze-btn"
                onClick={onAnalyze}
                title={
                  hasExistingAnalysis
                    ? displayConfig.copy.reanalyzeButtonText
                    : config.historyCopy.analyzeButtonAriaLabel
                }
                aria-label={
                  hasExistingAnalysis
                    ? displayConfig.copy.reanalyzeButtonText
                    : config.historyCopy.analyzeButtonAriaLabel
                }
              >
                <Sparkles size={13} className="analyze-btn-icon" />
                <span>
                  {hasExistingAnalysis
                    ? displayConfig.copy.reanalyzeButtonText
                    : config.historyCopy.analyzeButtonText}
                </span>
              </button>
            )
          )}
        </div>
      </div>
      <div className="move-history-list" ref={listRef}>
        {movePairs.length === 0 ? (
          <div style={{ padding: '1rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            {config.historyCopy.emptyHistoryMessage}
          </div>
        ) : (
          movePairs.map((pair) => (
            <div key={pair.num} className="move-row">
              <span className="move-num">{pair.num}.</span>
              <span
                className={`move-cell ${currentMoveIndex === pair.blueIndex ? 'active' : ''}`}
                onClick={() => onNavigateMove && onNavigateMove(pair.blueIndex)}
              >
                <span className="move-notation-text">{pair.blue?.notation || ''}</span>
                {pair.blueQuality && (
                  <MoveQualityBadge quality={pair.blueQuality} config={displayConfig} />
                )}
              </span>
              <span
                className={`move-cell ${pair.green && currentMoveIndex === pair.greenIndex ? 'active' : ''
                  }`}
                onClick={() =>
                  pair.green && onNavigateMove && onNavigateMove(pair.greenIndex)
                }
              >
                <span className="move-notation-text">{pair.green?.notation || ''}</span>
                {pair.greenQuality && (
                  <MoveQualityBadge quality={pair.greenQuality} config={displayConfig} />
                )}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
});
