import React, { useEffect, useRef, useMemo, memo } from 'react';
import type { Move } from '@/core/schada/types';
import { ChevronFirst, ChevronLeft, ChevronRight, ChevronLast } from 'lucide-react';

interface MoveHistoryProps {
  history: Move[];
  currentMoveIndex?: number;
  onNavigateMove?: (index: number) => void;
}

export const MoveHistory: React.FC<MoveHistoryProps> = memo(function MoveHistory({
  history,
  currentMoveIndex = history.length - 1,
  onNavigateMove,
}) {
  const listRef = useRef<HTMLDivElement>(null);

  // Group moves into pairs (Blue, Green) — only recompute when history grows
  const movePairs: { num: number; blue?: Move; green?: Move }[] = useMemo(() => {
    const pairs: { num: number; blue?: Move; green?: Move }[] = [];
    for (let i = 0; i < history.length; i += 2) {
      pairs.push({
        num: Math.floor(i / 2) + 1,
        blue: history[i],
        green: history[i + 1],
      });
    }
    return pairs;
  }, [history]);

  // Auto-scroll to bottom on new moves
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [history.length]);

  return (
    <div className="move-history-container">
      <div className="move-history-header">Moves Notation</div>
      <div className="move-history-list" ref={listRef}>
        {movePairs.length === 0 ? (
          <div style={{ padding: '1rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            No moves made yet
          </div>
        ) : (
          movePairs.map((pair) => (
            <div key={pair.num} className="move-row">
              <span className="move-num">{pair.num}.</span>
              <span
                className={`move-cell ${
                  currentMoveIndex === (pair.num - 1) * 2 ? 'active' : ''
                }`}
                onClick={() => onNavigateMove && onNavigateMove((pair.num - 1) * 2)}
              >
                {pair.blue?.notation || ''}
              </span>
              <span
                className={`move-cell ${
                  pair.green && currentMoveIndex === (pair.num - 1) * 2 + 1 ? 'active' : ''
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

      {/* Move Navigation Controls */}
      {onNavigateMove && history.length > 0 && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            gap: '0.5rem',
            padding: '0.35rem',
            borderTop: '1px solid var(--border-subtle)',
            backgroundColor: 'var(--bg-secondary)',
          }}
        >
          <button
            className="action-btn"
            style={{ padding: '0.2rem 0.5rem' }}
            onClick={() => onNavigateMove(-1)}
            title="Start"
          >
            <ChevronFirst size={16} />
          </button>
          <button
            className="action-btn"
            style={{ padding: '0.2rem 0.5rem' }}
            onClick={() => onNavigateMove(Math.max(-1, currentMoveIndex - 1))}
            title="Previous"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            className="action-btn"
            style={{ padding: '0.2rem 0.5rem' }}
            onClick={() => onNavigateMove(Math.min(history.length - 1, currentMoveIndex + 1))}
            title="Next"
          >
            <ChevronRight size={16} />
          </button>
          <button
            className="action-btn"
            style={{ padding: '0.2rem 0.5rem' }}
            onClick={() => onNavigateMove(history.length - 1)}
            title="Current"
          >
            <ChevronLast size={16} />
          </button>
        </div>
      )}
    </div>
  );
});
