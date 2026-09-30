import React, { useState } from 'react';
import { Cpu, Users, Settings2, Share2 } from 'lucide-react';
import { OnlinePlayersCount } from './OnlinePlayersCount';

import { FORMAT_CONFIG, type TimeControlPreset } from '@/core/schada/formatConfig';

export type TimeControlOption = TimeControlPreset;

interface QuickPairingGridProps {
  onSelectTimeControl: (minutes: number, increment: number, isRanked: boolean) => Promise<void> | void;
  onStartPassAndPlay: () => void;
  onOpenCustomModal: () => void;
  onOpenComputerModal: () => void;
  onOpenCreateRoomModal: () => void;
}

export const TIME_CONTROL_PRESETS: readonly TimeControlOption[] = FORMAT_CONFIG.presets;


export const QuickPairingGrid: React.FC<QuickPairingGridProps> = ({
  onSelectTimeControl,
  onStartPassAndPlay,
  onOpenCustomModal,
  onOpenComputerModal,
  onOpenCreateRoomModal,
}) => {
  const [pairingDisplay, setPairingDisplay] = useState<string | null>(null);

  const handleCardClick = async (opt: TimeControlOption) => {
    if (pairingDisplay) return;
    setPairingDisplay(opt.display);
    try {
      await onSelectTimeControl(opt.minutes, opt.increment, true);
    } finally {
      setPairingDisplay(null);
    }
  };

  return (
    <div className="quick-pairing-container">
      {/* Real-time Players Online Indicator */}
      <OnlinePlayersCount />

      {/* 3x4 Quick Pairing Grid */}
      <div className="pairing-grid">
        {TIME_CONTROL_PRESETS.map((opt) => (
          <div
            key={opt.display}
            className={`pairing-card ${pairingDisplay === opt.display ? 'active' : ''}`}
            onClick={() => handleCardClick(opt)}
            style={{
              opacity: pairingDisplay && pairingDisplay !== opt.display ? 0.6 : 1,
              pointerEvents: pairingDisplay ? 'none' : 'auto',
            }}
          >
            <div className="time">{opt.display}</div>
            <div className="label">{pairingDisplay === opt.display ? 'Joining...' : opt.name}</div>
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
    </div>
  );
};
