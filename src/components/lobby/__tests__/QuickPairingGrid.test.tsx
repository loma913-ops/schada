import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { QuickPairingGrid } from '../QuickPairingGrid';

vi.mock('../OnlinePlayersCount', () => ({
  OnlinePlayersCount: () => <div data-testid="online-players">Players</div>,
}));

describe('QuickPairingGrid Component', () => {
  it('renders Correspondence CTA button directly below Play Against Computer', () => {
    const html = renderToStaticMarkup(
      <QuickPairingGrid
        onSelectTimeControl={vi.fn()}
        onStartPassAndPlay={vi.fn()}
        onOpenCustomModal={vi.fn()}
        onOpenComputerModal={vi.fn()}
        onOpenCreateRoomModal={vi.fn()}
      />
    );

    expect(html).toContain('Play with a Friend');
    expect(html).toContain('Play Against Computer');
    expect(html).toContain('Correspondence');

    const computerIndex = html.indexOf('Play Against Computer');
    const correspondenceIndex = html.indexOf('Correspondence');
    expect(correspondenceIndex).toBeGreaterThan(computerIndex);
  });
});
