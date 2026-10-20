import React, { useState } from 'react';
import { Cpu, Users, Settings2, Mail } from 'lucide-react';
import { OnlinePlayersCount } from './OnlinePlayersCount';

import { FORMAT_CONFIG, type TimeControlPreset } from '@/core/schada/formatConfig';
import { LOBBY_CONFIG } from './lobbyConfig';

export type TimeControlOption = TimeControlPreset;

interface QuickPairingGridProps {
  onSelectTimeControl: (minutes: number, increment: number, isRanked: boolean) => Promise<void> | void;
  onStartPassAndPlay: () => void;
  onOpenCustomModal: (initialTab?: 'realtime' | 'correspondence') => void;
  onOpenComputerModal: () => void;
}

export const TIME_CONTROL_PRESETS: readonly TimeControlOption[] = FORMAT_CONFIG.presets;


export const QuickPairingGrid: React.FC<QuickPairingGridProps> = ({
  onSelectTimeControl,
  onStartPassAndPlay,
  onOpenCustomModal,
  onOpenComputerModal,
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

      {/* Quick Match Section Title */}
      <div className="quick-match-header">
        <h2 className="quick-match-title">{LOBBY_CONFIG.sectionTitles.quickMatch}</h2>
      </div>

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
        <div className="pairing-card custom-card" onClick={() => onOpenCustomModal('realtime')}>
          <div className="time" style={{ fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Settings2 size={18} style={{ opacity: 0.8 }} />
            <span>Custom</span>
          </div>
        </div>
      </div>

      {/* Prominent Action Buttons: Play Computer & Correspondence */}
      <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '100%' }}>

        <button
          type="button"
          className="schada-cta-btn"
          onClick={onOpenComputerModal}
          style={{ width: '100%', padding: '0.85rem 1.25rem', fontSize: '1.05rem', fontWeight: 600 }}
        >
          <Cpu size={22} className="schada-cta-icon" />
          <span>Play Against Computer</span>
        </button>

        <button
          type="button"
          className="schada-cta-btn"
          onClick={() => onOpenCustomModal('correspondence')}
          style={{ width: '100%', padding: '0.85rem 1.25rem', fontSize: '1.05rem', fontWeight: 600 }}
        >
          <Mail size={22} className="schada-cta-icon" />
          <span>Correspondence</span>
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
