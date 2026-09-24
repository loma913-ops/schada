import React from 'react';
import { Zap, Clock, Shield, Sparkles, Users, Swords } from 'lucide-react';

interface QuickPairingGridProps {
  onSelectTimeControl: (minutes: number, isRanked: boolean) => void;
  onStartPassAndPlay: () => void;
  onOpenCustomModal: () => void;
}

export const QuickPairingGrid: React.FC<QuickPairingGridProps> = ({
  onSelectTimeControl,
  onStartPassAndPlay,
  onOpenCustomModal,
}) => {
  const options = [
    {
      minutes: 3,
      label: 'Blitz',
      icon: <Zap size={22} color="var(--accent-gold)" />,
      desc: '3 min • Ranked',
      ranked: true,
    },
    {
      minutes: 5,
      label: 'Rapid',
      icon: <Clock size={22} color="var(--accent-blue)" />,
      desc: '5 min • Ranked',
      ranked: true,
    },
    {
      minutes: 10,
      label: 'Classical',
      icon: <Shield size={22} color="var(--accent-green)" />,
      desc: '10 min • Ranked',
      ranked: true,
    },
    {
      minutes: 0,
      label: 'Casual',
      icon: <Sparkles size={22} color="var(--accent-gold)" />,
      desc: 'Unlimited time',
      ranked: false,
    },
  ];

  return (
    <div>
      <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '0.25rem' }}>Quick Pair</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
          Select a time control to find a ranked opponent or start playing immediately.
        </p>
      </div>

      <div className="pairing-grid">
        {options.map((opt) => (
          <div
            key={opt.label}
            className="pairing-card"
            onClick={() => onSelectTimeControl(opt.minutes, opt.ranked)}
          >
            <div style={{ marginBottom: '0.4rem' }}>{opt.icon}</div>
            <div className="time">{opt.minutes > 0 ? `${opt.minutes} min` : '∞'}</div>
            <div className="label">{opt.label}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
              {opt.desc}
            </div>
          </div>
        ))}

        {/* Pass and Play Sandbox */}
        <div className="pairing-card" onClick={onStartPassAndPlay}>
          <div style={{ marginBottom: '0.4rem' }}>
            <Users size={22} color="var(--accent-blue)" />
          </div>
          <div className="time">Pass & Play</div>
          <div className="label">Solo Sandbox</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
            Local 2-Player / Rules Lab
          </div>
        </div>

        {/* Custom Challenge */}
        <div className="pairing-card" onClick={onOpenCustomModal}>
          <div style={{ marginBottom: '0.4rem' }}>
            <Swords size={22} color="var(--accent-green)" />
          </div>
          <div className="time">Custom</div>
          <div className="label">Create Match</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
            Bespoke clocks & friend invite
          </div>
        </div>
      </div>
    </div>
  );
};
