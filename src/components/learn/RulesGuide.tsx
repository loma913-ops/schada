import React, { useState, useMemo } from 'react';
import {
  BookOpen,
  Shield,
  Compass,
  Crown,
  Trophy,
  Award,
  Info,
} from 'lucide-react';
import type { Square, Piece, MoveVector } from '@/core/schada/types';
import { SCHADA_VECTORS, squareToColRow, colRowToSquare } from '@/core/schada/vectors';
import { SCHADA_RULES_CONFIG } from '@/core/schada/rulesConfig';
import { VectorOverlay } from '../board/VectorOverlay';
import { PieceIcon } from '../board/PieceIcon';

const EMPTY_VECTORS: readonly MoveVector[] = Object.freeze([]);

const SAMPLE_FIELD_OFFICER: Piece = Object.freeze({
  id: 'sample_fo',
  type: 'field_officer',
  color: 'blue',
  hasLeftBase: false,
  hasReachedGoal: false,
});

const SAMPLE_OFFICER: Piece = Object.freeze({
  id: 'sample_o',
  type: 'officer',
  color: 'blue',
  hasLeftBase: false,
  hasReachedGoal: false,
});

const SAMPLE_PAWN: Piece = Object.freeze({
  id: 'sample_p',
  type: 'pawn',
  color: 'blue',
  hasLeftBase: false,
  hasReachedGoal: false,
});

export const RulesGuide: React.FC = () => {
  const { gameMetadata, army, scoring, board } = SCHADA_RULES_CONFIG;

  // --- State for Vector Inspector ---
  const [selectedVectorSquare, setSelectedVectorSquare] = useState<Square>('f2');

  const [vCol, vRow] = squareToColRow(selectedVectorSquare);
  const isVectorSquareLight = (vCol + vRow) % 2 === 1;

  const { targetSquares, pathSquares } = useMemo(() => {
    const vectors = SCHADA_VECTORS[selectedVectorSquare] ?? EMPTY_VECTORS;
    const targets = new Set<Square>();
    const paths = new Set<Square>();
    const [c, r] = squareToColRow(selectedVectorSquare);
    for (const vec of vectors) {
      const dest = colRowToSquare(c + vec.target[0], r + vec.target[1]);
      if (dest) targets.add(dest);
      for (const [dc, dr] of vec.path) {
        const step = colRowToSquare(c + dc, r + dr);
        if (step) paths.add(step);
      }
    }
    return { targetSquares: targets, pathSquares: paths };
  }, [selectedVectorSquare]);

  const all64Squares: readonly Square[] = useMemo(() => {
    const result: Square[] = [];
    for (let r = board.rankCount - 1; r >= 0; r--) {
      for (let c = 0; c < board.fileCount; c++) {
        const sq = colRowToSquare(c, r);
        if (sq) result.push(sq);
      }
    }
    return Object.freeze(result);
  }, [board.rankCount, board.fileCount]);

  const blueGoalRank = board.blueGoalRankIndex + 1;
  const blueBaseRank = board.blueBaseRankIndex + 1;

  const foRankFraction = `${scoring.fieldOfficerRankDistanceNumerator}/${scoring.rankDistanceDenominator}`;
  const oRankFraction = `${scoring.officerRankDistanceNumerator}/${scoring.rankDistanceDenominator}`;

  return (
    <div className="rules-page-container">
      {/* Hero Header */}
      <div className="rules-hero">
        <div className="rules-hero-icon">
          <BookOpen size={28} />
        </div>
        <h1 className="rules-title">Rules of {gameMetadata.title}</h1>
        <p className="rules-subtitle">
          Invented by <strong>{gameMetadata.inventor}</strong> ({gameMetadata.cityOfOrigin}, {gameMetadata.yearInvented})<br />
          <em>"{gameMetadata.tagline}"</em>
        </p>
      </div>

      {/* Section 1: Objective & Scoring */}
      <section className="rules-card">
        <h2 className="rules-card-title">
          <Trophy size={20} />
          1. Objective & Scoring
        </h2>
        <p className="rules-text">
          Advance your <strong>High Pieces</strong> (Field Officers and Officers) across the board into the opponent's back rank (<strong>Goal Line</strong>). The game ends immediately when all surviving High Pieces of either player reach the Goal Line. The player with the highest total score wins.
        </p>

        <div className="rules-note">
          <Info size={16} />
          <span>
            <strong>Strategic Tip:</strong> Because the match ends immediately once all remaining High Pieces of a player reach the Goal Line, only move your final piece in when you hold the point lead.
          </span>
        </div>
      </section>

      {/* Section 2: The Armies & Pieces */}
      <section className="rules-card">
        <h2 className="rules-card-title">
          <Shield size={20} />
          2. The Armies & Pieces
        </h2>
        <p className="rules-text">
          Each player commands an army of {army.totalPiecesPerPlayer} pieces: {army.fieldOfficersCount} Field Officers,{' '}
          {army.officersCount} Officers, and {army.pawnsCount} Pawns. Field Officers and Officers are collectively called{' '}
          <strong>High Pieces</strong>.
        </p>

        <div className="pieces-grid">
          {/* Field Officer */}
          <div className="piece-showcase-card">
            <div className="piece-showcase-top">
              <div className="piece-icon-box">
                <PieceIcon piece={SAMPLE_FIELD_OFFICER} />
              </div>
              <div>
                <div className="piece-name">Field Officer</div>
                <div className="piece-count">{army.fieldOfficersCount} pieces · High Piece</div>
              </div>
            </div>
            <div className="piece-score-pill gold">
              {scoring.fieldOfficerGoalPoints} Points in Goal Line
            </div>
            <p className="piece-desc">
              <strong>Friendly Leap:</strong> The only piece that can jump over intermediate <em>friendly</em> pieces along its path. Cannot jump enemy pieces.
            </p>
          </div>

          {/* Officer */}
          <div className="piece-showcase-card">
            <div className="piece-showcase-top">
              <div className="piece-icon-box">
                <PieceIcon piece={SAMPLE_OFFICER} />
              </div>
              <div>
                <div className="piece-name">Officer</div>
                <div className="piece-count">{army.officersCount} pieces · High Piece</div>
              </div>
            </div>
            <div className="piece-score-pill blue">
              {scoring.officerGoalPoints} Point in Goal Line
            </div>
            <p className="piece-desc">
              Cannot leap. Any intermediate piece on its movement path completely blocks its progress.
            </p>
          </div>

          {/* Pawn */}
          <div className="piece-showcase-card">
            <div className="piece-showcase-top">
              <div className="piece-icon-box">
                <PieceIcon piece={SAMPLE_PAWN} />
              </div>
              <div>
                <div className="piece-name">Pawn</div>
                <div className="piece-count">{army.pawnsCount} pieces · Defender</div>
              </div>
            </div>
            <div className="piece-score-pill muted">
              {scoring.pawnGoalPoints} Points in Goal Line
            </div>
            <p className="piece-desc">
              Screens and defends High Pieces. Cannot leap. Pawns are <em>fully exempt</em> from Base Line and Goal Line entry and exit restrictions.
            </p>
          </div>
        </div>
      </section>

      {/* Section 3: How Movement Works */}
      <section className="rules-card">
        <h2 className="rules-card-title">
          <Compass size={20} />
          3. How Movement Works
        </h2>
        <p className="rules-text">
          In Chess, each piece has its own fixed moves. In Schada, <strong>the square a piece stands on dictates how it moves</strong>.
        </p>

        <div className="rules-mechanic-list">
          <div className="rules-mechanic-item">
            <strong>Reading Squares:</strong> Every square shows directional lines originating from a center point. Count the dots along a path — each dot represents 1 square of travel.
          </div>
          <div className="rules-mechanic-item">
            <strong>Full Distance Required:</strong> You must travel the <strong>entire designated distance</strong>. If a vector shows 2 or 3 dots, you cannot stop early on an intermediate square.
          </div>
          <div className="rules-mechanic-item">
            <strong>Straight & Bent Paths:</strong> Moves can be direct slides or bent paths that change direction mid-move. A bent path is completed in a single turn.
          </div>
          <div className="rules-mechanic-item">
            <strong>Capturing:</strong> Capturing is by replacement (Chess-style). When your piece lands on a square occupied by an enemy piece, the enemy is removed from the board. Any piece can capture any enemy piece (Pawns can capture High Pieces). Capturing is optional, never compulsory.
          </div>
        </div>

        {/* Vector Inspector */}
        <div className="rules-inspector-box">
          <div className="rules-inspector-header">
            <div>
              <h3 className="rules-widget-title">Vector Inspector</h3>
              <p className="rules-widget-sub">Select any square on the board to inspect its movement paths:</p>
            </div>
          </div>

          <div className="rules-inspector-layout">
            {/* Left: Vector Square Component */}
            <div className="square-zoom-panel">
              <div className={`square-zoom-box ${isVectorSquareLight ? 'light' : 'dark'}`}>
                <VectorOverlay square={selectedVectorSquare} isSelected={true} />
                <span
                  style={{
                    position: 'absolute',
                    top: '6px',
                    left: '8px',
                    fontSize: '12px',
                    fontWeight: 800,
                    fontFamily: 'var(--font-mono)',
                    color: isVectorSquareLight ? 'var(--board-coord-light)' : 'var(--board-coord-dark)',
                  }}
                >
                  {selectedVectorSquare[1]}
                </span>
                <span
                  style={{
                    position: 'absolute',
                    bottom: '6px',
                    right: '8px',
                    fontSize: '12px',
                    fontWeight: 800,
                    fontFamily: 'var(--font-mono)',
                    color: isVectorSquareLight ? 'var(--board-coord-light)' : 'var(--board-coord-dark)',
                  }}
                >
                  {selectedVectorSquare[0]}
                </span>
              </div>

              <div className="square-zoom-info">
                <div className="square-zoom-title">
                  Square <code>{selectedVectorSquare}</code>
                </div>
              </div>
            </div>

            {/* Right: Board Grid (Always Visible) */}
            <div className="rules-grid-panel">
              <div className="rules-square-picker-grid">
                {all64Squares.map((sq) => {
                  const [c, r] = squareToColRow(sq);
                  const isLight = (c + r) % 2 === 1;
                  const isCurrent = sq === selectedVectorSquare;
                  const isTarget = targetSquares.has(sq);
                  const isPath = !isTarget && pathSquares.has(sq);
                  return (
                    <button
                      key={sq}
                      type="button"
                      className={`rules-picker-cell ${isLight ? 'light' : 'dark'} ${
                        isCurrent ? 'active' : isTarget ? 'is-target' : isPath ? 'is-path' : ''
                      }`}
                      onClick={() => setSelectedVectorSquare(sq)}
                      title={
                        isCurrent
                          ? `Selected square ${sq}`
                          : isTarget
                          ? `Destination: ${sq}`
                          : isPath
                          ? `Intermediate waypoint`
                          : sq
                      }
                    >
                      {sq}
                    </button>
                  );
                })}
              </div>

              <div className="rules-grid-legend">
                <span className="legend-item">
                  <span className="legend-swatch selected" /> Selected
                </span>
                <span className="legend-item">
                  <span className="legend-swatch destination" /> Destination
                </span>
                <span className="legend-item">
                  <span className="legend-swatch waypoint" /> Waypoint
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Section 4: Board Zones & Movement Restrictions */}
      <section className="rules-card">
        <h2 className="rules-card-title">
          <Crown size={20} />
          4. Board Zones & Movement Restrictions
        </h2>
        <p className="rules-text">
          The 8×8 board is divided into three functional zones with strict rules for High Pieces:
        </p>

        <div className="zone-map-container">
          <div className="zone-row goal">
            <div className="zone-row-header">
              <span className="zone-row-title">Goal Line (Rank {blueGoalRank} for Blue / Rank {blueBaseRank} for Green)</span>
              <span className="zone-row-tag gold">Immune to Capture</span>
            </div>
            <p className="zone-row-desc">
              The primary scoring destination. Field Officers score {scoring.fieldOfficerGoalPoints} points and Officers score {scoring.officerGoalPoints} point here.
            </p>
            <ul className="zone-row-rules">
              <li><strong>One-Way Entry:</strong> Once a High Piece enters the Goal Line, it can <strong>never leave</strong> it (lateral shuffling along the rank is permitted).</li>
              <li><strong>Capture Immunity:</strong> High Pieces inside their Goal Line <strong>cannot be captured</strong> by enemy pieces. They retain the right to capture enemy pieces that enter the rank.</li>
            </ul>
          </div>

          <div className="zone-row battlefield">
            <div className="zone-row-header">
              <span className="zone-row-title">The Battlefield (Ranks 2 through 7)</span>
              <span className="zone-row-tag">Standard Combat</span>
            </div>
            <p className="zone-row-desc">
              The central board where pieces maneuver and engage. High Pieces in this territory are fully vulnerable to capture by any enemy piece.
            </p>
          </div>

          <div className="zone-row base">
            <div className="zone-row-header">
              <span className="zone-row-title">Base Line (Rank {blueBaseRank} for Blue / Rank {blueGoalRank} for Green)</span>
              <span className="zone-row-tag blue">One-Way Exit</span>
            </div>
            <p className="zone-row-desc">
              Where High Pieces begin the match. Pieces may shuffle laterally along the base line before moving out into the field.
            </p>
            <ul className="zone-row-rules">
              <li><strong>One-Way Exit:</strong> <strong>Once a High Piece departs its Base Line, it is strictly forbidden from returning.</strong></li>
            </ul>
          </div>
        </div>

        <div className="rules-note">
          <Info size={16} />
          <span>
            <strong>Pawn Exemption:</strong> Pawns are completely exempt from Base Line and Goal Line restrictions. They can enter and leave any rank on the board freely to block, defend, or capture.
          </span>
        </div>
      </section>

      {/* Section 5: Game End & Tiebreakers */}
      <section className="rules-card">
        <h2 className="rules-card-title">
          <Award size={20} />
          5. Game End & Tiebreakers
        </h2>
        <p className="rules-text">
          Schada does not use checkmate. A game concludes immediately upon any of the following triggers:
        </p>

        <div className="rules-end-conditions-grid">
          <div className="rules-end-item">
            <strong>1. Goal Reached:</strong> All surviving High Pieces of either player reach their Goal Line.
          </div>
          <div className="rules-end-item">
            <strong>2. Blockade:</strong> A player has High Pieces outside the Goal Line but has no legal moves available.
          </div>
          <div className="rules-end-item">
            <strong>3. Threefold Repetition:</strong> The exact same position occurs 3 times with the same player to move.
          </div>
          <div className="rules-end-item">
            <strong>4. Mutual Shuffling:</strong> Both players consecutively shuffle High Pieces within their base or goal lines.
          </div>
        </div>

        <h3 className="rules-subheading" style={{ marginTop: '1.25rem' }}>
          Tiebreaker Hierarchy
        </h3>
        <p className="rules-text">
          If scores are tied or a game ends by blockade, winner determination follows these official steps:
        </p>

        <ol className="rules-tiebreaker-list">
          <li>
            <strong>Goal Line Score:</strong> The player with the highest total points in the Goal Line wins (Field Officer = {scoring.fieldOfficerGoalPoints}, Officer = {scoring.officerGoalPoints}).
          </li>
          <li>
            <strong>Tiebreaker 1 (Surviving Pieces):</strong> Higher total value of surviving High Pieces outside the Goal Line (Field Officer = {scoring.fieldOfficerSurvivingPoints}, Officer = {scoring.officerSurvivingPoints}).
          </li>
          <li>
            <strong>Tiebreaker 2 (Distance Advanced):</strong> Total ranks advanced towards the Goal Line ({foRankFraction} point per rank for Field Officers, {oRankFraction} point per rank for Officers).
          </li>
          <li>
            <strong>Tiebreaker 3 (Draw):</strong> If all tiebreaker metrics remain identical, the match is declared a draw.
          </li>
        </ol>
      </section>
    </div>
  );
};
