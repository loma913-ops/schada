import React, { useEffect, useRef, useMemo, memo } from 'react';
import type { Move } from '@/core/schada/types';
import { MoveNavigator } from './MoveNavigator';
import {
  type MoveNavigatorConfig,
  CANONICAL_MOVE_NAVIGATOR_CONFIG,
  validateMoveNavigatorConfig,
} from './moveNavigatorConfig';

export interface MoveHistoryProps {
  readonly history: readonly Move[];
  readonly currentMoveIndex?: number;
  readonly onNavigateMove?: (index: number) => void;
  readonly config?: MoveNavigatorConfig;
}

interface MoveRowPair {
  readonly num: number;
  readonly blue?: Move;
  readonly green?: Move;
}

export const MoveHistory: React.FC<MoveHistoryProps> = memo(function MoveHistory({
  history,
  currentMoveIndex = history.length > 0
    ? history.length - 1
    : CANONICAL_MOVE_NAVIGATOR_CONFIG.startMoveIndex,
  onNavigateMove,
  config = CANONICAL_MOVE_NAVIGATOR_CONFIG,
}) {
  validateMoveNavigatorConfig(config);
  const listRef = useRef<HTMLDivElement>(null);

  // Group moves into pairs (Blue, Green) - only recompute when history grows
  const movePairs: readonly MoveRowPair[] = useMemo(() => {
    const pairs: MoveRowPair[] = [];
    for (let i = 0; i < history.length; i += 2) {
      pairs.push({
        num: Math.floor(i / 2) + 1,
        blue: history[i],
        green: history[i + 1],
      });
    }
    return pairs;
  }, [history]);

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
        activeEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }, [currentMoveIndex]);

  return (
    <div className="move-history-container">
      <div className="move-history-sticky-top">
        <MoveNavigator
          currentIndex={currentMoveIndex}
          totalMoves={history.length}
          onNavigate={onNavigateMove}
          config={config}
        />
        <div className="move-history-header">{config.historyCopy.headerTitle}</div>
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
                className={`move-cell ${currentMoveIndex === (pair.num - 1) * 2 ? 'active' : ''
                  }`}
                onClick={() => onNavigateMove && onNavigateMove((pair.num - 1) * 2)}
              >
                {pair.blue?.notation || ''}
              </span>
              <span
                className={`move-cell ${pair.green && currentMoveIndex === (pair.num - 1) * 2 + 1 ? 'active' : ''
                  }`}
                onClick={() =>
                  pair.green && onNavigateMove && onNavigateMove((pair.num - 1) * 2 + 1)
                }
              >
                {pair.green?.notation || ''}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
});
