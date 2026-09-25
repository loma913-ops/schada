import React from 'react';
import { Cpu, Users, Settings2, Share2 } from 'lucide-react';
import { OpenRoomsList } from './OpenRoomsList';
import { OnlinePlayersCount } from './OnlinePlayersCount';

export interface TimeControlOption {
  display: string;
  name: string;
  minutes: number;
  increment: number;
  type: 'bullet' | 'blitz' | 'rapid' | 'classical';
}

interface QuickPairingGridProps {
  onSelectTimeControl: (minutes: number, increment: number, isRanked: boolean) => void;
  onStartPassAndPlay: () => void;
  onOpenCustomModal: () => void;
  onOpenComputerModal: () => void;
  onOpenCreateRoomModal: () => void;
}

export const TIME_CONTROL_PRESETS: TimeControlOption[] = [
  { display: '1+0', name: 'Bullet', minutes: 1, increment: 0, type: 'bullet' },
  { display: '2+1', name: 'Bullet', minutes: 2, increment: 1, type: 'bullet' },
  { display: '3+0', name: 'Blitz', minutes: 3, increment: 0, type: 'blitz' },
  { display: '3+2', name: 'Blitz', minutes: 3, increment: 2, type: 'blitz' },
  { display: '5+0', name: 'Blitz', minutes: 5, increment: 0, type: 'blitz' },
  { display: '5+3', name: 'Blitz', minutes: 5, increment: 3, type: 'blitz' },
  { display: '10+0', name: 'Rapid', minutes: 10, increment: 0, type: 'rapid' },
  { display: '10+5', name: 'Rapid', minutes: 10, increment: 5, type: 'rapid' },
  { display: '15+10', name: 'Rapid', minutes: 15, increment: 10, type: 'rapid' },
  { display: '30+0', name: 'Classical', minutes: 30, increment: 0, type: 'classical' },
  { display: '30+20', name: 'Classical', minutes: 30, increment: 20, type: 'classical' },
];

export const QuickPairingGrid: React.FC<QuickPairingGridProps> = ({
  onSelectTimeControl,
  onStartPassAndPlay,
  onOpenCustomModal,
  onOpenComputerModal,
  onOpenCreateRoomModal,
}) => {
  return (
    <div className="quick-pairing-container">
      {/* Real-time Players Online Indicator */}
      <OnlinePlayersCount />

      {/* 3x4 Quick Pairing Grid */}
      <div className="pairing-grid">
        {TIME_CONTROL_PRESETS.map((opt) => (
          <div
            key={opt.display}
            className="pairing-card"
            onClick={() => onSelectTimeControl(opt.minutes, opt.increment, true)}
          >
            <div className="time">{opt.display}</div>
            <div className="label">{opt.name}</div>
          </div>
        ))}

        {/* 12th Slot: Custom */}
        <div className="pairing-card custom-card" onClick={onOpenCustomModal}>
          <div className="time" style={{ fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Settings2 size={18} style={{ opacity: 0.8 }} />
            <span>Custom</span>
          </div>
        </div>
      </div>

      {/* Prominent Action Buttons: Play with a Friend & Play Computer */}
      <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '100%' }}>
        <button
          type="button"
          className="lichess-cta-btn"
          onClick={onOpenCreateRoomModal}
          style={{
            width: '100%',
            padding: '0.85rem 1.25rem',
            fontSize: '1.05rem',
            fontWeight: 600,
            background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.15), rgba(34, 197, 94, 0.15))',
            borderColor: 'rgba(56, 189, 248, 0.4)',
            color: 'var(--text-primary)',
          }}
        >
          <Share2 size={22} className="lichess-cta-icon" color="var(--accent-blue)" />
          <span>Play with a Friend</span>
        </button>

        <button
          type="button"
          className="lichess-cta-btn"
          onClick={onOpenComputerModal}
          style={{ width: '100%', padding: '0.85rem 1.25rem', fontSize: '1.05rem', fontWeight: 600 }}
        >
          <Cpu size={22} className="lichess-cta-icon" />
          <span>Play Against Computer</span>
        </button>
      </div>

      {/* Secondary Pass & Play Action */}
      <div style={{ marginTop: '0.75rem', textAlign: 'center' }}>
        <button
          type="button"
          className="pass-play-btn"
          onClick={onStartPassAndPlay}
        >
          <Users size={16} />
          <span>Pass & Play (Local 2-Player)</span>
        </button>
      </div>

      {/* Open Rooms Section */}
      <OpenRoomsList />
    </div>
  );
};
