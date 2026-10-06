import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { CustomGameModal } from '../CustomGameModal';

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ user: null, isLoading: false }),
}));

describe('CustomGameModal Component', () => {
  it('does not render when isOpen is false', () => {
    const html = renderToStaticMarkup(
      <CustomGameModal
        isOpen={false}
        onClose={vi.fn()}
        onCreateGame={vi.fn()}
      />
    );
    expect(html).toBe('');
  });

  it('renders Real Time tab by default with slider controls', () => {
    const html = renderToStaticMarkup(
      <CustomGameModal
        isOpen={true}
        onClose={vi.fn()}
        onCreateGame={vi.fn()}
      />
    );
    expect(html).toContain('Create Match');
    expect(html).toContain('Real Time');
    expect(html).toContain('Correspondence');
    expect(html).toContain('Minutes per player');
    expect(html).toContain('Increment in seconds');
    expect(html).not.toContain('Days per player');
  });

  it('renders Correspondence tab with days slider when initialTab is correspondence', () => {
    const html = renderToStaticMarkup(
      <CustomGameModal
        isOpen={true}
        onClose={vi.fn()}
        onCreateGame={vi.fn()}
        initialTab="correspondence"
      />
    );
    expect(html).toContain('Days per player');
    expect(html).toContain('2 days');
    expect(html).not.toContain('Minutes per player');
    expect(html).not.toContain('Increment in seconds');
  });

  it('preserves Match Grading and Preferred Army Color options in both modes', () => {
    const realtimeHtml = renderToStaticMarkup(
      <CustomGameModal
        isOpen={true}
        onClose={vi.fn()}
        onCreateGame={vi.fn()}
        initialTab="realtime"
      />
    );
    expect(realtimeHtml).toContain('Match Grading');
    expect(realtimeHtml).toContain('Preferred Army Color');
    expect(realtimeHtml).toContain('Create Match &amp; Add to Lobby');

    const correspondenceHtml = renderToStaticMarkup(
      <CustomGameModal
        isOpen={true}
        onClose={vi.fn()}
        onCreateGame={vi.fn()}
        initialTab="correspondence"
      />
    );
    expect(correspondenceHtml).toContain('Match Grading');
    expect(correspondenceHtml).toContain('Preferred Army Color');
    expect(correspondenceHtml).toContain('Create Match &amp; Add to Lobby');
  });
});
