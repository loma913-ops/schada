import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { AnalysisModal } from '../AnalysisModal';
import {
  CANONICAL_ANALYSIS_MODAL_CONFIG,
  type AnalysisModalConfig,
} from '../analysisModalConfig';

describe('AnalysisModal Component', () => {
  it('renders nothing when isOpen is false', () => {
    const html = renderToStaticMarkup(
      <AnalysisModal
        isOpen={false}
        totalMoves={10}
        onClose={vi.fn()}
      />
    );
    expect(html).toBe('');
  });

  it('renders modal dialog with sliders and estimated time when isOpen is true', () => {
    const html = renderToStaticMarkup(
      <AnalysisModal
        isOpen={true}
        totalMoves={24}
        onClose={vi.fn()}
      />
    );

    // Dialog structure
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain('modal-overlay');
    expect(html).toContain('modal-content');

    // Title and copy
    expect(html).toContain(CANONICAL_ANALYSIS_MODAL_CONFIG.copy.title);
    expect(html).toContain(CANONICAL_ANALYSIS_MODAL_CONFIG.copy.subtitle);

    // Depth slider: 1 to 20, step 1, default 6
    expect(html).toContain('id="analysis-depth-slider"');
    expect(html).toContain('min="1"');
    expect(html).toContain('max="20"');
    expect(html).toContain('step="1"');
    expect(html).toContain('value="6"');
    expect(html).toContain('Depth');

    // Time Limit slider
    expect(html).toContain('id="analysis-time-slider"');
    expect(html).toContain(`min="${CANONICAL_ANALYSIS_MODAL_CONFIG.timeLimitSlider.min}"`);
    expect(html).toContain(`max="${CANONICAL_ANALYSIS_MODAL_CONFIG.timeLimitSlider.max}"`);
    expect(html).toContain(`step="${CANONICAL_ANALYSIS_MODAL_CONFIG.timeLimitSlider.step}"`);
    expect(html).toContain('Time Limit (seconds)');

    // Estimated Time card
    expect(html).toContain('analysis-modal-estimate');
    expect(html).toContain(CANONICAL_ANALYSIS_MODAL_CONFIG.copy.estimatedTimeLabel);
    expect(html).toContain('based on 24 moves');

    // Action buttons
    expect(html).toContain(CANONICAL_ANALYSIS_MODAL_CONFIG.copy.startButtonText);
    expect(html).toContain(CANONICAL_ANALYSIS_MODAL_CONFIG.copy.cancelButtonText);
  });

  it('renders custom initialDepth and initialTimeLimitSeconds if provided', () => {
    const html = renderToStaticMarkup(
      <AnalysisModal
        isOpen={true}
        totalMoves={30}
        initialDepth={12}
        initialTimeLimitSeconds={2.5}
        onClose={vi.fn()}
      />
    );

    expect(html).toContain('value="12"');
    expect(html).toContain('value="2.5"');
    expect(html).toContain('2.5s');
  });

  it('throws an error if an invalid configuration is provided', () => {
    const invalidConfig = {
      ...CANONICAL_ANALYSIS_MODAL_CONFIG,
      depthSlider: { min: 10, max: 5, step: 1, default: 8 },
    } as unknown as AnalysisModalConfig;

    expect(() =>
      renderToStaticMarkup(
        <AnalysisModal
          isOpen={true}
          totalMoves={10}
          config={invalidConfig}
          onClose={vi.fn()}
        />
      )
    ).toThrow('AnalysisModalConfigError');
  });
});
