import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { X, Sparkles, Clock } from 'lucide-react';
import {
  type AnalysisModalConfig,
  CANONICAL_ANALYSIS_MODAL_CONFIG,
  validateAnalysisModalConfig,
  calculateEstimatedAnalysisTime,
} from './analysisModalConfig';

export interface AnalysisModalProps {
  readonly isOpen: boolean;
  readonly totalMoves: number;
  readonly initialDepth?: number;
  readonly initialTimeLimitSeconds?: number;
  readonly onClose: () => void;
  readonly onStartAnalysis?: (params: {
    readonly depth: number;
    readonly timeLimitSeconds: number;
    readonly timeLimitMs: number;
  }) => void;
  readonly config?: AnalysisModalConfig;
}

/**
 * Analysis Settings Modal Component.
 *
 * Prompts user to select search depth (1-20) and time limit per move (1.0s-5.0s),
 * showing real-time estimated analysis duration in human readable terms.
 *
 * Algorithmic Complexity:
 * - Time Complexity: O(1) constant time rendering and O(1) estimation formula.
 * - Auxiliary Space Complexity: O(1) constant auxiliary space.
 */
export const AnalysisModal: React.FC<AnalysisModalProps> = ({
  isOpen,
  totalMoves,
  initialDepth,
  initialTimeLimitSeconds,
  onClose,
  onStartAnalysis,
  config = CANONICAL_ANALYSIS_MODAL_CONFIG,
}) => {
  validateAnalysisModalConfig(config);

  const resolveInitialDepth = useCallback(
    (d?: number) => {
      if (typeof d !== 'number' || !Number.isFinite(d)) return config.depthSlider.default;
      return Math.min(config.depthSlider.max, Math.max(config.depthSlider.min, Math.round(d)));
    },
    [config.depthSlider]
  );

  const resolveInitialTimeLimit = useCallback(
    (t?: number) => {
      if (typeof t !== 'number' || !Number.isFinite(t)) return config.timeLimitSlider.default;
      return Math.min(config.timeLimitSlider.max, Math.max(config.timeLimitSlider.min, t));
    },
    [config.timeLimitSlider]
  );

  const [depth, setDepth] = useState<number>(() => resolveInitialDepth(initialDepth));
  const [timeLimitSeconds, setTimeLimitSeconds] = useState<number>(() =>
    resolveInitialTimeLimit(initialTimeLimitSeconds)
  );

  // Sync state whenever modal opens or defaults change
  useEffect(() => {
    if (isOpen) {
      setDepth(resolveInitialDepth(initialDepth));
      setTimeLimitSeconds(resolveInitialTimeLimit(initialTimeLimitSeconds));
    }
  }, [isOpen, initialDepth, initialTimeLimitSeconds, resolveInitialDepth, resolveInitialTimeLimit]);

  // Handle escape key to dismiss
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Real-time human-readable estimated calculation
  const estimated = useMemo(
    () => calculateEstimatedAnalysisTime(totalMoves, depth, timeLimitSeconds, config),
    [totalMoves, depth, timeLimitSeconds, config]
  );

  const handleStart = useCallback(() => {
    const timeLimitMs = Math.round(timeLimitSeconds * 1000);
    onStartAnalysis?.({
      depth,
      timeLimitSeconds,
      timeLimitMs,
    });
    onClose();
  }, [depth, timeLimitSeconds, onStartAnalysis, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="modal-overlay analysis-modal-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="analysis-modal-title"
    >
      <div className="modal-content analysis-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Sparkles size={20} color="var(--accent-gold)" />
            <h2 id="analysis-modal-title" className="modal-title">
              {config.copy.title}
            </h2>
          </div>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            aria-label={config.copy.closeButtonAriaLabel}
          >
            <X size={18} />
          </button>
        </div>

        <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginBottom: '1.25rem' }}>
          {config.copy.subtitle}
        </p>

        {/* Depth Slider */}
        <div className="form-group modal-slider-wrap">
          <div className="modal-slider-header">
            <label className="form-label" htmlFor="analysis-depth-slider" style={{ marginBottom: 0 }}>
              {config.copy.depthLabel}
            </label>
            <span className="modal-slider-val" data-testid="depth-val">
              {depth}
            </span>
          </div>
          <input
            id="analysis-depth-slider"
            type="range"
            className="modal-slider"
            min={config.depthSlider.min}
            max={config.depthSlider.max}
            step={config.depthSlider.step}
            value={depth}
            onChange={(e) => setDepth(Number(e.target.value))}
            aria-label={config.copy.depthLabel}
          />
        </div>

        {/* Time Limit Slider */}
        <div className="form-group modal-slider-wrap">
          <div className="modal-slider-header">
            <label className="form-label" htmlFor="analysis-time-slider" style={{ marginBottom: 0 }}>
              {config.copy.timeLimitLabel}
            </label>
            <span className="modal-slider-val" data-testid="time-limit-val">
              {timeLimitSeconds.toFixed(1)}s
            </span>
          </div>
          <input
            id="analysis-time-slider"
            type="range"
            className="modal-slider"
            min={config.timeLimitSlider.min}
            max={config.timeLimitSlider.max}
            step={config.timeLimitSlider.step}
            value={timeLimitSeconds}
            onChange={(e) => setTimeLimitSeconds(Number(e.target.value))}
            aria-label={config.copy.timeLimitLabel}
          />
        </div>

        {/* Estimated Time */}
        <div className="analysis-modal-estimate">
          <div className="analysis-estimate-header">
            <Clock size={16} className="analysis-estimate-icon" />
            <span className="analysis-estimate-label">{config.copy.estimatedTimeLabel}</span>
          </div>
          <div className="analysis-estimate-value" data-testid="estimated-time-val">
            {estimated.humanReadable}
          </div>
          <div className="analysis-estimate-footnote">
            {config.copy.movesCountPrefix} {totalMoves} {config.copy.movesCountSuffix}
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            type="button"
            className="btn-primary"
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.4rem',
              padding: '0.75rem',
            }}
            onClick={handleStart}
          >
            <Sparkles size={16} />
            <span>{config.copy.startButtonText}</span>
          </button>
          <button
            type="button"
            className="action-btn"
            style={{
              flex: 1,
              padding: '0.75rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            onClick={onClose}
          >
            <span>{config.copy.cancelButtonText}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
