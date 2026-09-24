import React from 'react';
import { BookOpen, Shield, Crown, Navigation, Award } from 'lucide-react';
import { PieceIcon } from '../board/PieceIcon';
import type { Piece } from '@/core/schada/types';

export const RulesGuide: React.FC = () => {
  const sampleFO: Piece = { id: 'fo', type: 'field_officer', color: 'blue', hasLeftBase: false, hasReachedGoal: false };
  const sampleO: Piece = { id: 'o', type: 'officer', color: 'blue', hasLeftBase: false, hasReachedGoal: false };
  const sampleP: Piece = { id: 'p', type: 'pawn', color: 'blue', hasLeftBase: false, hasReachedGoal: false };

  return (
    <div style={{ maxWidth: '820px', margin: '2rem auto', padding: '0 1rem' }}>
      <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <BookOpen size={40} color="var(--accent-gold)" style={{ margin: '0 auto 0.5rem' }} />
        <h1 style={{ fontSize: '2rem', fontWeight: 800 }}>Rules of Schada</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
          Invented by Jan Boogerd (1936, Rotterdam) — <em>"The Greatest Measure of Thought in the World"</em>
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {/* Core Concept */}
        <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '1.5rem' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Navigation size={20} color="var(--accent-gold)" />
            The 64 Squares Dictate Movement
          </h2>
          <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '0.75rem' }}>
            In traditional games like Chess or Checkers, the <em>piece</em> determines how you move. In <strong>Schada</strong>, the <strong>square</strong> where your piece stands dictates its direction, distance, and turns!
          </p>
          <ul style={{ paddingLeft: '1.25rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            <li><strong>Dots on lines:</strong> Each dot represents 1 square traveled in that direction.</li>
            <li><strong>Full distance required:</strong> A piece must complete its full designated path; you cannot stop early.</li>
            <li><strong>Bent paths:</strong> Several squares (such as <code>f2</code>, <code>f4</code>, <code>g2</code>, <code>h4</code>) instruct a piece to change direction mid-move.</li>
            <li><strong>180° Symmetry:</strong> The top half of the board (ranks 5–8) is an exact 180° rotation of the bottom half (ranks 1–4).</li>
          </ul>
        </div>

        {/* The Three Pieces */}
        <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '1.5rem' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Shield size={20} color="var(--accent-blue)" />
            The Three Pieces
          </h2>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
            {/* Field Officer */}
            <div style={{ background: 'var(--bg-tertiary)', padding: '1rem', borderRadius: 'var(--radius-sm)', textAlign: 'center' }}>
              <div style={{ width: '48px', height: '48px', margin: '0 auto 0.5rem' }}>
                <PieceIcon piece={sampleFO} />
              </div>
              <div style={{ fontWeight: 800, fontSize: '1rem', marginBottom: '0.25rem' }}>Field Officer (4)</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--accent-gold)', fontWeight: 700, marginBottom: '0.5rem' }}>
                Worth 2 Points in Goal
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                <strong>Special Ability:</strong> Can leap over intermediate <em>friendly</em> pieces along its path.
              </p>
            </div>

            {/* Officer */}
            <div style={{ background: 'var(--bg-tertiary)', padding: '1rem', borderRadius: 'var(--radius-sm)', textAlign: 'center' }}>
              <div style={{ width: '48px', height: '48px', margin: '0 auto 0.5rem' }}>
                <PieceIcon piece={sampleO} />
              </div>
              <div style={{ fontWeight: 800, fontSize: '1rem', marginBottom: '0.25rem' }}>Officer (4)</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--accent-blue)', fontWeight: 700, marginBottom: '0.5rem' }}>
                Worth 1 Point in Goal
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                High piece that marches towards the goal line. Cannot leap over any pieces.
              </p>
            </div>

            {/* Pawn */}
            <div style={{ background: 'var(--bg-tertiary)', padding: '1rem', borderRadius: 'var(--radius-sm)', textAlign: 'center' }}>
              <div style={{ width: '48px', height: '48px', margin: '0 auto 0.5rem' }}>
                <PieceIcon piece={sampleP} />
              </div>
              <div style={{ fontWeight: 800, fontSize: '1rem', marginBottom: '0.25rem' }}>Pawn (8)</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 700, marginBottom: '0.5rem' }}>
                0 Goal Points
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                Support & blocker. Has no restrictions on moving in or out of base or goal lines.
              </p>
            </div>
          </div>
        </div>

        {/* High Piece Restrictions & Goal Immunity */}
        <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '1.5rem' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Crown size={20} color="var(--accent-gold)" />
            Base Line & Goal Line Rules
          </h2>
          <ul style={{ paddingLeft: '1.25rem', color: 'var(--text-secondary)', lineHeight: 1.7 }}>
            <li>
              <strong>Base Line Shuffling:</strong> High pieces can shuffle horizontally on their base line before leaving, but <strong>once a high piece leaves its base line, it can never return to it</strong>.
            </li>
            <li>
              <strong>Goal Line Shuffling:</strong> Once a high piece reaches its goal line (Rank 8 for Blue, Rank 1 for Green), it can shuffle along the goal line, but <strong>can never leave the goal line</strong>.
            </li>
            <li>
              <strong>Invulnerability in Goal:</strong> <strong>High pieces in their goal line cannot be captured</strong> by enemy pieces! (However, they can still capture enemies).
            </li>
          </ul>
        </div>

        {/* Victory & Tiebreakers */}
        <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '1.5rem' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Award size={20} color="var(--accent-green)" />
            Winning & Scoring
          </h2>
          <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '0.75rem' }}>
            The game ends immediately the instant all remaining high pieces of a player reach their goal line, or if high pieces are blocked, or on 3-fold repetition.
          </p>
          <div style={{ background: 'var(--bg-tertiary)', padding: '1rem', borderRadius: 'var(--radius-sm)' }}>
            <div style={{ fontWeight: 700, marginBottom: '0.5rem' }}>Scoring Hierarchy:</div>
            <ol style={{ paddingLeft: '1.25rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              <li><strong>Goal Line Score:</strong> Field Officers = 2 points each, Officers = 1 point each. Highest score wins!</li>
              <li><strong>Tiebreaker 1:</strong> Highest score of surviving high pieces outside the goal line (FO = 2, O = 1).</li>
              <li><strong>Tiebreaker 2:</strong> Distance advanced towards goal line: each rank closer counts 2/7 point for FO and 1/7 point for Officers.</li>
              <li><strong>Tiebreaker 3:</strong> True draw.</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
};
