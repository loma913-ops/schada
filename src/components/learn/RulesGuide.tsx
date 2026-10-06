import React, { useState, useMemo, useCallback } from 'react';
import {
  BookOpen,
  Compass,
  Sparkles,
  Shield,
  Play,
  Crown,
  Trophy,
  Award,
  CheckCircle2,
  AlertCircle,
  Info,
  CornerDownRight,
  ArrowRight,
  Grid,
  RotateCcw,
  XCircle,
  AlertTriangle,
  Navigation,
} from 'lucide-react';
import type { BoardState, Move, Square, Piece, PieceType, MoveVector } from '@/core/schada/types';
import { createInitialGameState, executeMove, getLegalMovesForSquare, getPiecesUnderAttack } from '@/core/schada/engine';
import { SCHADA_VECTORS, squareToColRow, colRowToSquare } from '@/core/schada/vectors';
import { SCHADA_RULES_CONFIG } from '@/core/schada/rulesConfig';
import { useGamePreferences } from '@/context/GamePreferencesContext';
import { BoardSquare } from '../board/BoardSquare';
import { VectorOverlay } from '../board/VectorOverlay';
import { PieceIcon } from '../board/PieceIcon';

interface NotableSquare {
  readonly square: Square;
  readonly label: string;
  readonly badge: string;
  readonly description: string;
}

const NOTABLE_SQUARES: readonly NotableSquare[] = Object.freeze([
  {
    square: 'f2',
    label: 'Bent Path',
    badge: 'Direction Change',
    description:
      'A famous bent path: travels 2 squares right (f2 → g2 → h2) then turns down 1 square to h1, or diagonal to d4.',
  },
  {
    square: 'f4',
    label: 'Double Turn',
    badge: 'Branching Turns',
    description:
      'Commands pieces up 2 then right 1 (to g6), or down 2 then left 1 (to e2), plus 1 step left/right.',
  },
  {
    square: 'g2',
    label: 'Complex Turn',
    badge: 'Sharp Bend',
    description:
      'Up 2 then left 2 (g2 → g4 → e4), or a long slide left 3 squares (to d2), or right 1 (to h2).',
  },
  {
    square: 'h4',
    label: 'Hook Vector',
    badge: 'Edge Hook',
    description: 'Hook path: moves left 2 squares then turns up 1 to f5, or down 1 to h3.',
  },
  {
    square: 'd3',
    label: '3-Way Vector',
    badge: 'Multi-Direction',
    description:
      'Provides 3 choices: retreat down 2 (to d1), slide left 3 (to a3), or advance diagonally 2 (to f5).',
  },
]);

const EMPTY_VECTORS: readonly MoveVector[] = Object.freeze([]);

export const RulesGuide: React.FC = () => {
  const { gameMetadata, army, scoring, board } = SCHADA_RULES_CONFIG;

  // --- State for Vector Inspector ---
  const [selectedVectorSquare, setSelectedVectorSquare] = useState<Square>('f2');
  const [showFullGridPicker, setShowFullGridPicker] = useState<boolean>(false);

  const [vCol, vRow] = squareToColRow(selectedVectorSquare);
  const isVectorSquareLight = (vCol + vRow) % 2 === 1;
  const activeVectors = SCHADA_VECTORS[selectedVectorSquare] ?? EMPTY_VECTORS;
  const notableSquare = NOTABLE_SQUARES.find((n) => n.square === selectedVectorSquare);

  // Precomputed destination and waypoint squares for the selected vector square (O(1))
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

  // --- State for Leap Simulator ---
  const [selectedPieceType, setSelectedPieceType] = useState<PieceType>('field_officer');
  const [obstacleType, setObstacleType] = useState<'friendly' | 'enemy'>('friendly');

  const sampleFieldOfficer: Piece = {
    id: 'sample_fo',
    type: 'field_officer',
    color: 'blue',
    hasLeftBase: false,
    hasReachedGoal: false,
  };

  const sampleOfficer: Piece = {
    id: 'sample_o',
    type: 'officer',
    color: 'blue',
    hasLeftBase: false,
    hasReachedGoal: false,
  };

  const samplePawn: Piece = {
    id: 'sample_p',
    type: 'pawn',
    color: 'blue',
    hasLeftBase: false,
    hasReachedGoal: false,
  };

  const currentMovingPiece: Piece = {
    id: 'moving_sample',
    type: selectedPieceType,
    color: 'blue',
    hasLeftBase: false,
    hasReachedGoal: false,
  };

  const intermediateObstaclePiece: Piece = {
    id: 'obstacle_sample',
    type: 'pawn',
    color: obstacleType === 'friendly' ? 'blue' : 'green',
    hasLeftBase: true,
    hasReachedGoal: false,
  };

  const isLeapMoveAllowed = selectedPieceType === 'field_officer' && obstacleType === 'friendly';

  // --- State for Opening Moves Explorer ---
  const [sandboxGameState, setSandboxGameState] = useState<BoardState>(() => createInitialGameState());
  const [selectedBoardSquare, setSelectedBoardSquare] = useState<Square | null>(null);
  const [lastSandboxMove, setLastSandboxMove] = useState<Move | null>(null);
  const [sandboxFeedback, setSandboxFeedback] = useState<string>(
    'Click any Blue piece on Rank 1 or 2 to see its opening move options.'
  );

  const { showThreatIndicators } = useGamePreferences();

  const legalMovesForSelectedSquare = useMemo(() => {
    return selectedBoardSquare ? getLegalMovesForSquare(sandboxGameState.board, selectedBoardSquare) : [];
  }, [sandboxGameState.board, selectedBoardSquare]);

  const legalMoveMap = useMemo(() => {
    const map = new Map<Square, Move>();
    for (const m of legalMovesForSelectedSquare) {
      map.set(m.to, m);
    }
    return map;
  }, [legalMovesForSelectedSquare]);

  const attackedSquares = useMemo(() => {
    if (!showThreatIndicators) return new Set<Square>();
    return getPiecesUnderAttack(sandboxGameState.board);
  }, [sandboxGameState.board, showThreatIndicators]);

  const handleSquareClick = useCallback(
    (sq: Square) => {
      const move = legalMoveMap.get(sq);
      if (move) {
        const nextState = executeMove(sandboxGameState, move);
        setSandboxGameState(nextState);
        setLastSandboxMove(move);
        setSelectedBoardSquare(null);

        if (move.piece.type === 'field_officer') {
          setSandboxFeedback(`⚡ Played ${move.from} → ${move.to}. Field Officer leaped over the friendly pawn.`);
        } else {
          setSandboxFeedback(`♟️ Played ${move.from} → ${move.to}. Pawn advanced.`);
        }
        return;
      }

      const piece = sandboxGameState.board[sq];
      if (piece && piece.color === sandboxGameState.currentTurn) {
        if (selectedBoardSquare === sq) {
          setSelectedBoardSquare(null);
          setSandboxFeedback('Piece deselected.');
        } else {
          setSelectedBoardSquare(sq);
          const moves = getLegalMovesForSquare(sandboxGameState.board, sq);
          if (moves.length === 0) {
            setSandboxFeedback(`Piece on ${sq} is an Officer: forward path is blocked by the pawn on rank 2.`);
          } else {
            const formattedType = piece.type.replace('_', ' ');
            setSandboxFeedback(
              `Selected ${formattedType} on ${sq}: ${moves.length} legal move${moves.length > 1 ? 's' : ''} available.`
            );
          }
        }
        return;
      }

      setSelectedBoardSquare(null);
    },
    [sandboxGameState, legalMoveMap, selectedBoardSquare]
  );

  const handleResetSandbox = useCallback(() => {
    setSandboxGameState(createInitialGameState());
    setSelectedBoardSquare(null);
    setLastSandboxMove(null);
    setSandboxFeedback(`Board reset to opening position. Exactly ${board.openingLegalMoveCount} legal moves available for Blue.`);
  }, [board.openingLegalMoveCount]);

  // Precomputed squares in row-major order: ranks 8 to 1, files a to h (O(1) space and time)
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

  // --- State for Scoring Calculator ---
  const [blueFieldOfficers, setBlueFieldOfficers] = useState<number>(3);
  const [blueOfficers, setBlueOfficers] = useState<number>(2);
  const [greenFieldOfficers, setGreenFieldOfficers] = useState<number>(2);
  const [greenOfficers, setGreenOfficers] = useState<number>(3);

  const blueScore =
    blueFieldOfficers * scoring.fieldOfficerGoalPoints +
    blueOfficers * scoring.officerGoalPoints;

  const greenScore =
    greenFieldOfficers * scoring.fieldOfficerGoalPoints +
    greenOfficers * scoring.officerGoalPoints;

  let outcomeText = '';
  if (blueScore > greenScore) {
    outcomeText = `🏆 Blue Wins (${blueScore} vs ${greenScore}).`;
  } else if (greenScore > blueScore) {
    outcomeText = `🏆 Green Wins (${greenScore} vs ${blueScore}).`;
  } else {
    outcomeText = `⚖️ Tied (${blueScore} vs ${greenScore}). Decided by Tiebreakers.`;
  }

  const blueGoalRank = board.blueGoalRankIndex + 1; // 8
  const blueBaseRank = board.blueBaseRankIndex + 1; // 1

  return (
    <div className="rules-page-container">
      {/* Hero Header */}
      <div className="rules-hero">
        <div className="rules-hero-icon">
          <BookOpen size={28} />
        </div>
        <h1 className="rules-title">Rules of {gameMetadata.title}</h1>
        <p className="rules-subtitle">
          Invented by <strong>{gameMetadata.inventor}</strong> ({gameMetadata.cityOfOrigin},{' '}
          {gameMetadata.yearInvented})<br /><em>"{gameMetadata.tagline}"</em>
        </p>
      </div>

      {/* Complete Full Guide Content (Unified, Sequential) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {/* Section 1: Quick Start */}
        <section className="rules-card">
          <div className="rules-card-header">
            <h2 className="rules-card-title">
              <Compass size={22} color="var(--accent-gold)" />
              Quick Start: Learn Schada in 60 Seconds
            </h2>
            <span className="rules-card-badge">Crash Course</span>
          </div>

          <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '1rem' }}>
            Schada is an elegant, non-random abstract strategy game. Here are the 4 fundamental rules you need to start playing immediately:
          </p>

          {/* Pieces Overview: Row of Three */}
          <div className="quick-start-pieces-row">
            <div className="quick-start-piece-card">
              <div className="quick-start-piece-icon">
                <PieceIcon piece={sampleFieldOfficer} />
              </div>
              <span className="quick-start-piece-name">Field Officer</span>
            </div>

            <div className="quick-start-piece-card">
              <div className="quick-start-piece-icon">
                <PieceIcon piece={sampleOfficer} />
              </div>
              <span className="quick-start-piece-name">Officer</span>
            </div>

            <div className="quick-start-piece-card">
              <div className="quick-start-piece-icon">
                <PieceIcon piece={samplePawn} />
              </div>
              <span className="quick-start-piece-name">Pawn</span>
            </div>
          </div>

          <div className="quick-start-grid">
            <div className="quick-start-step">
              <div className="quick-step-num">1</div>
              <div className="quick-step-title">Squares Dictate Movement</div>
              <div className="quick-step-desc">
                In Chess, pieces have moves. In Schada, <strong>the square you stand on dictates your move</strong>. Follow the lines on your tile and count the dots. Each dot is 1 square of travel.
              </div>
            </div>

            <div className="quick-start-step">
              <div className="quick-step-num">2</div>
              <div className="quick-step-title">Full Distance Required</div>
              <div className="quick-step-desc">
                You must travel the <strong>entire designated distance</strong> of the vector. If a line shows 2 or 3 dots, you cannot stop early on an intermediate square. Bent paths also turn corners in a single turn.
              </div>
            </div>

            <div className="quick-start-step">
              <div className="quick-step-num">3</div>
              <div className="quick-step-title">Field Officers Can Leap</div>
              <div className="quick-step-desc">
                All paths require empty squares, <strong>except</strong> that <strong>Field Officers</strong> can leap over intermediate <em>friendly</em> pieces. Regular Officers and Pawns cannot jump over anything.
              </div>
            </div>

            <div className="quick-start-step">
              <div className="quick-step-num">4</div>
              <div className="quick-step-title">Enter Goal to Score & Win</div>
              <div className="quick-step-desc">
                Advance your High Pieces into the enemy back rank (Goal Line). Field Officers are worth{' '}
                <strong>{scoring.fieldOfficerGoalPoints} points</strong>; Officers are worth{' '}
                <strong>{scoring.officerGoalPoints} point</strong>. High pieces in the goal are <strong>immune to capture</strong>.
              </div>
            </div>
          </div>

          {/* Dos and Don'ts */}
          <div style={{ marginTop: '1.75rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ background: 'rgba(98, 153, 36, 0.12)', border: '1px solid rgba(98, 153, 36, 0.3)', borderRadius: 'var(--radius-sm)', padding: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--accent-green)', fontWeight: 800, marginBottom: '0.5rem' }}>
                <CheckCircle2 size={18} /> Golden Strategic Dos
              </div>
              <ul style={{ paddingLeft: '1.2rem', fontSize: '0.86rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                <li><strong>Do use Pawns as shields:</strong> Pawns have {scoring.pawnGoalPoints} goal points, making them ideal blockers and screeners for your {army.fieldOfficersCount} Field Officers.</li>
                <li><strong>Do open with Field Officers:</strong> They can jump straight over your rank-2 pawns to rank 3 on turn 1.</li>
                <li><strong>Do protect high pieces in the field:</strong> If they get captured, your potential goal score decreases.</li>
              </ul>
            </div>

            <div style={{ background: 'rgba(204, 51, 51, 0.12)', border: '1px solid rgba(204, 51, 51, 0.3)', borderRadius: 'var(--radius-sm)', padding: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--accent-red)', fontWeight: 800, marginBottom: '0.5rem' }}>
                <AlertCircle size={18} /> Critical Rookie Mistakes
              </div>
              <ul style={{ paddingLeft: '1.2rem', fontSize: '0.86rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                <li><strong>Don't return to the Base Line:</strong> Once a high piece leaves rank 1, it is strictly forbidden from returning.</li>
                <li><strong>Don't rush to end the game if trailing:</strong> The game ends the second your remaining high pieces reach the goal-only finish if you have more points.</li>
                <li><strong>Don't expect Field Officers to jump enemies:</strong> Only friendly pieces can be leaped over.</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Section 2: The Three Pieces & Their Powers */}
        <section className="rules-card">
          <div className="rules-card-header">
            <h2 className="rules-card-title">
              <Shield size={22} color="var(--accent-blue)" />
              The Three Pieces & Their Powers
            </h2>
            <span className="rules-card-badge">Armies & Roles</span>
          </div>

          <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '1.25rem' }}>
            Each player commands an army of {army.totalPiecesPerPlayer} pieces:{' '}
            {army.fieldOfficersCount} Field Officers, {army.officersCount} Officers, and {army.pawnsCount} Pawns.
            Together, Field Officers and Officers are called <strong>High Pieces</strong>.
          </p>

          <div className="pieces-grid">
            {/* Field Officer */}
            <div className="piece-showcase-card">
              <div className="piece-showcase-top">
                <div className="piece-icon-box">
                  <PieceIcon piece={sampleFieldOfficer} />
                </div>
                <div>
                  <div className="piece-name">
                    Field Officer ({army.fieldOfficersCount})
                  </div>
                  <div className="piece-dutch-name">Hoofd-Officier (Dutch)</div>
                </div>
              </div>
              <div className="piece-score-badge gold">
                <Award size={14} /> Worth {scoring.fieldOfficerGoalPoints} Points in Goal
              </div>
              <div className="piece-ability-desc">
                <strong>Superpower: Friendly Leap.</strong> The only piece on the board capable of leaping over intermediate <em>friendly</em> pieces along its path. Cannot jump enemy pieces.
              </div>
            </div>

            {/* Officer */}
            <div className="piece-showcase-card">
              <div className="piece-showcase-top">
                <div className="piece-icon-box">
                  <PieceIcon piece={sampleOfficer} />
                </div>
                <div>
                  <div className="piece-name">
                    Officer ({army.officersCount})
                  </div>
                  <div className="piece-dutch-name">Officier (Dutch)</div>
                </div>
              </div>
              <div className="piece-score-badge blue">
                <Award size={14} /> Worth {scoring.officerGoalPoints} Point in Goal
              </div>
              <div className="piece-ability-desc">
                <strong>High Piece.</strong> Must march toward the goal line to score points. Cannot leap over any piece-any intermediate piece completely blocks its movement.
              </div>
            </div>

            {/* Pawn */}
            <div className="piece-showcase-card">
              <div className="piece-showcase-top">
                <div className="piece-icon-box">
                  <PieceIcon piece={samplePawn} />
                </div>
                <div>
                  <div className="piece-name">
                    Pawn ({army.pawnsCount})
                  </div>
                  <div className="piece-dutch-name">Pion (Dutch)</div>
                </div>
              </div>
              <div className="piece-score-badge muted">
                {scoring.pawnGoalPoints} Goal Points
              </div>
              <div className="piece-ability-desc">
                <strong>Blocker & Defender.</strong> Scores 0 points in the goal, but has <em>total freedom</em>: pawns can enter and leave base and goal lines at will, capturing and blocking enemy high pieces.
              </div>
            </div>
          </div>

          {/* Interactive Leap Simulator */}
          <div className="leap-simulator-box">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <Sparkles size={18} color="var(--accent-gold)" />
              <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                Interactive Demo: Can My Piece Make the Leap?
              </h3>
            </div>

            <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
              Square <code>a1</code> instructs a piece to move 2 squares forward to <code>a3</code> (passing through <code>a2</code>).
              Test how different piece types react when <code>a2</code> is occupied:
            </p>

            <div className="leap-demo-controls">
              <div className="leap-control-group">
                <span className="leap-control-label">
                  Moving Piece:
                </span>
                <div className="leap-btn-group">
                  <button
                    type="button"
                    className={`leap-btn ${selectedPieceType === 'field_officer' ? 'active' : ''}`}
                    onClick={() => setSelectedPieceType('field_officer')}
                  >
                    Field Officer
                  </button>
                  <button
                    type="button"
                    className={`leap-btn ${selectedPieceType === 'officer' ? 'active' : ''}`}
                    onClick={() => setSelectedPieceType('officer')}
                  >
                    Officer
                  </button>
                  <button
                    type="button"
                    className={`leap-btn ${selectedPieceType === 'pawn' ? 'active' : ''}`}
                    onClick={() => setSelectedPieceType('pawn')}
                  >
                    Pawn
                  </button>
                </div>
              </div>

              <div className="leap-control-group">
                <span className="leap-control-label">
                  Blocking Piece:
                </span>
                <div className="leap-btn-group">
                  <button
                    type="button"
                    className={`leap-btn ${obstacleType === 'friendly' ? 'active' : ''}`}
                    onClick={() => setObstacleType('friendly')}
                  >
                    Friendly Piece
                  </button>
                  <button
                    type="button"
                    className={`leap-btn ${obstacleType === 'enemy' ? 'active' : ''}`}
                    onClick={() => setObstacleType('enemy')}
                  >
                    Enemy Piece
                  </button>
                </div>
              </div>
            </div>

            {/* 3-Square Visual Strip */}
            <div className="leap-visual-strip">
              <div className="leap-square-cell dark">
                <div style={{ width: '38px', height: '38px' }}>
                  <PieceIcon piece={currentMovingPiece} />
                </div>
                <span className="leap-square-coord">a1 (Start)</span>
              </div>

              <div style={{ fontSize: '1.25rem', color: 'var(--text-muted)' }}>➔</div>

              <div className="leap-square-cell light">
                <div style={{ width: '38px', height: '38px' }}>
                  <PieceIcon piece={intermediateObstaclePiece} />
                </div>
                <span className="leap-square-coord">a2 (Path)</span>
              </div>

              <div style={{ fontSize: '1.25rem', color: 'var(--text-muted)' }}>➔</div>

              <div className={`leap-square-cell dark ${isLeapMoveAllowed ? 'target-allowed' : 'target-blocked'}`}>
                <div
                  style={{
                    width: '16px',
                    height: '16px',
                    borderRadius: '50%',
                    background: isLeapMoveAllowed ? 'var(--accent-green)' : 'var(--accent-red)',
                    opacity: 0.8,
                  }}
                />
                <span className="leap-square-coord">a3 (Dest)</span>
              </div>
            </div>

            <div className={`leap-outcome-banner ${isLeapMoveAllowed ? 'success' : 'blocked'}`}>
              {isLeapMoveAllowed ? (
                <>
                  <CheckCircle2 size={20} />
                  <span>
                    <strong>Move Allowed.</strong> The Field Officer leaps over the friendly piece on <code>a2</code> and safely lands on <code>a3</code>.
                  </span>
                </>
              ) : (
                <>
                  <XCircle size={20} />
                  <span>
                    <strong>Move Blocked.</strong>{' '}
                    {selectedPieceType !== 'field_officer'
                      ? `${selectedPieceType === 'officer' ? 'Officers' : 'Pawns'} cannot leap over any pieces. Intermediate square a2 must be completely empty.`
                      : 'Field Officers can only leap over FRIENDLY pieces, never enemy pieces.'}
                  </span>
                </>
              )}
            </div>
          </div>
        </section>

        {/* Section 3: How Squares Move */}
        <section className="rules-card">
          <div className="rules-card-header">
            <h2 className="rules-card-title">
              <Sparkles size={22} color="var(--accent-gold)" />
              How to Read Movement Squares
            </h2>
            <span className="rules-card-badge">Interactive Vector Inspector</span>
          </div>

          <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '1rem' }}>
            In Schada, the <strong>square</strong> where your piece stands dictates its direction, distance, and turns.
            Inspect how different lines and dots work:
          </p>

          {/* Preset Buttons */}
          <div style={{ marginBottom: '1.25rem' }}>
            <div className="rules-example-header">
              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                Select an Example:
              </span>
              <button
                type="button"
                className={`rules-browse-gold-btn ${showFullGridPicker ? 'active' : ''}`}
                onClick={() => setShowFullGridPicker((prev) => !prev)}
                title={showFullGridPicker ? 'Hide full 64-square grid' : 'Browse all 64 squares on the board'}
              >
                <Grid size={14} /> {showFullGridPicker ? 'Hide 64-Square Grid' : 'Browse All 64 Squares'}
              </button>
            </div>

            <div className="square-selector-chips">
              {NOTABLE_SQUARES.map((n) => (
                <button
                  key={n.square}
                  type="button"
                  className={`square-chip-btn ${selectedVectorSquare === n.square ? 'active' : ''}`}
                  onClick={() => setSelectedVectorSquare(n.square)}
                >
                  {n.label}
                </button>
              ))}
            </div>

            {showFullGridPicker && (
              <div style={{ marginTop: '0.75rem', padding: '1rem', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-sm)', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                  Click any square on the 8×8 board to inspect its vector and possible moves:
                </div>
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
                        className={`rules-picker-cell ${isLight ? 'light' : 'dark'} ${isCurrent ? 'active' : isTarget ? 'is-target' : isPath ? 'is-path' : ''
                          }`}
                        onClick={() => setSelectedVectorSquare(sq)}
                        title={
                          isCurrent
                            ? `Selected origin square ${sq}`
                            : isTarget
                              ? `Possible move destination from ${selectedVectorSquare}: ${sq}`
                              : isPath
                                ? `Intermediate path waypoint for vector from ${selectedVectorSquare}`
                                : `Inspect square ${sq}`
                        }
                      >
                        {sq}
                      </button>
                    );
                  })}
                </div>

                {/* Vector Highlight Legend */}
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'center', marginTop: '0.75rem', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                    <span style={{ width: 10, height: 10, borderRadius: 2, background: 'var(--accent-gold)', display: 'inline-block' }} />
                    Selected (<strong>{selectedVectorSquare}</strong>)
                  </span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                    <span style={{ width: 10, height: 10, borderRadius: 2, background: 'var(--accent-green)', border: '1px solid var(--accent-green-hover)', display: 'inline-block' }} />
                    Possible Moves ({Array.from(targetSquares).join(', ') || 'None'})
                  </span>
                  {pathSquares.size > 0 && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                      <span style={{ width: 10, height: 10, borderRadius: 2, background: 'rgba(54, 146, 231, 0.65)', border: '1px solid var(--accent-blue)', display: 'inline-block' }} />
                      Path Waypoints
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="square-viewer-container">
            {/* Left: Zoomed Square Graphic */}
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

              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  Square <code>{selectedVectorSquare}</code>
                </div>
                {notableSquare && (
                  <span className="rules-chip highlight" style={{ marginTop: '0.4rem' }}>
                    {notableSquare.badge}
                  </span>
                )}
              </div>
            </div>

            {/* Right: Path Breakdown */}
            <div>
              {notableSquare && (
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem', lineHeight: 1.55, marginBottom: '1rem' }}>
                  {notableSquare.description}
                </p>
              )}

              <div style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.6rem' }}>
                Legal Movement Paths from {selectedVectorSquare}:
              </div>

              <div className="vector-list">
                {activeVectors.length === 0 ? (
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', fontStyle: 'italic' }}>
                    No active vectors originating from this square.
                  </div>
                ) : (
                  activeVectors.map((vec, idx) => {
                    const destCol = vCol + vec.target[0];
                    const destRow = vRow + vec.target[1];
                    const destSquare = colRowToSquare(destCol, destRow);
                    if (!destSquare) return null;

                    const totalDots = vec.path.length + 1;
                    const isBent = vec.path.length > 0 && vec.path.some((p) => {
                      const stepDirCol = Math.sign(p[0]);
                      const stepDirRow = Math.sign(p[1]);
                      const finalDirCol = Math.sign(vec.target[0] - p[0]);
                      const finalDirRow = Math.sign(vec.target[1] - p[1]);
                      return stepDirCol !== finalDirCol || stepDirRow !== finalDirRow;
                    });

                    const pathSteps = vec.path
                      .map(([dc, dr]) => colRowToSquare(vCol + dc, vRow + dr))
                      .filter((step): step is Square => step !== null);

                    return (
                      <div key={idx} className="vector-item">
                        <div className="vector-item-header">
                          <span className="vector-item-dest">
                            {isBent ? <CornerDownRight size={18} /> : <ArrowRight size={18} />}
                            Destination: {destSquare}
                          </span>
                          <span className="vector-step-badge">
                            {totalDots} {totalDots === 1 ? 'Square' : 'Squares'} ({totalDots} {totalDots === 1 ? 'Dot' : 'Dots'})
                          </span>
                        </div>

                        <div className="vector-item-path">
                          {pathSteps.length === 0 ? (
                            <span>Direct move 1 square to <strong>{destSquare}</strong>.</span>
                          ) : (
                            <span>
                              Travels through {pathSteps.join(' → ')} to land on <strong>{destSquare}</strong>.
                              {isBent && ' (Mid-move turn required.)'}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="rules-callout gold" style={{ marginTop: '1rem' }}>
                <Info size={20} />
                <div>
                  <strong>Rule: Mandatory Full Distance</strong>
                  <div style={{ fontSize: '0.86rem', marginTop: '0.2rem' }}>
                    You must travel the <em>full distance</em> indicated by the dots. A piece on <code>f2</code> moving towards <code>h1</code> cannot stop early on <code>g2</code> or <code>h2</code>.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Section 4: Opening Moves */}
        <section className="rules-card">
          <div className="rules-card-header">
            <h2 className="rules-card-title">
              <Play size={22} color="var(--accent-green)" />
              Opening Moves & Interactive Sandbox
            </h2>
            <span className="rules-card-badge">Live Mini Board</span>
          </div>

          <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '1rem' }}>
            In the starting position, there are exactly{' '}
            <strong>{board.openingLegalMoveCount} possible opening moves</strong> for Blue:
          </p>

          <ul style={{ paddingLeft: '1.25rem', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '1.25rem' }}>
            <li>
              <strong>4 Field Officer Leaps:</strong> Field Officers on <code>a1</code>, <code>c1</code>, <code>e1</code>, and <code>g1</code> can each leap forward over the intervening pawns to rank 3 (<code>a3</code>, <code>c3</code>, <code>e3</code>, <code>g3</code>).
            </li>
            <li>
              <strong>10 Pawn Moves:</strong> All 8 pawns on rank 2 can move forward, with <code>c2</code> and <code>e2</code> each having 2 branching paths.
            </li>
            <li>
              <strong>Officers are Blocked:</strong> Officers on <code>b1</code>, <code>d1</code>, <code>f1</code>, and <code>h1</code> cannot move on turn 1 because pawns block their path.
            </li>
          </ul>

          <div className="rules-mini-board-wrap">
            <div className="rules-mini-board-grid">
              {all64Squares.map((sq) => {
                const piece = sandboxGameState.board[sq];
                const isSelected = selectedBoardSquare === sq;
                const isLast = lastSandboxMove?.from === sq || lastSandboxMove?.to === sq;
                const legalTarget = legalMoveMap.get(sq);

                return (
                  <BoardSquare
                    key={sq}
                    square={sq}
                    piece={piece}
                    isSelected={isSelected}
                    isLastMove={isLast}
                    legalMoveTarget={legalTarget}
                    onClick={handleSquareClick}
                    orientation="blue"
                    isUnderAttack={attackedSquares.has(sq)}
                  />
                );
              })}
            </div>

            <div className="rules-board-feedback">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Sparkles size={16} color="var(--accent-gold)" />
                <span>{sandboxFeedback}</span>
              </div>

              <button
                type="button"
                className="rules-tab-btn"
                style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}
                onClick={handleResetSandbox}
                title="Reset Board"
              >
                <RotateCcw size={14} /> Reset
              </button>
            </div>
          </div>

          <div className="rules-callout blue">
            <Info size={20} />
            <div>
              <strong>Capturing is by Replacement (Chess style)</strong>
              <div style={{ fontSize: '0.86rem', marginTop: '0.2rem' }}>
                When a piece lands on a square occupied by an enemy piece, the enemy is captured and removed. Any piece can capture any enemy piece (Pawns can capture High Pieces.). Capturing is <strong>not compulsory</strong>.
              </div>
            </div>
          </div>
        </section>

        {/* Section 5: Zones & Safe Goal */}
        <section className="rules-card">
          <div className="rules-card-header">
            <h2 className="rules-card-title">
              <Crown size={22} color="var(--accent-gold)" />
              Board Zones & Goal Invulnerability
            </h2>
            <span className="rules-card-badge">Territory Mechanics</span>
          </div>

          <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '1.25rem' }}>
            The board is divided into three key strategic zones with critical rules governing how High Pieces may enter and exit:
          </p>

          <div className="zone-map-container">
            {/* Goal Line */}
            <div className="zone-strip goal">
              <div className="zone-info">
                <div className="zone-header-line">
                  <Crown size={20} color="var(--accent-gold)" />
                  <div className="zone-title">
                    Goal Line (Rank {blueGoalRank} for Blue / Rank {blueBaseRank} for Green)
                  </div>
                  <span className="zone-badge">Target Zone</span>
                </div>
                <div className="zone-desc">
                  Your primary destination. Each Field Officer in the goal line scores{' '}
                  <strong>{scoring.fieldOfficerGoalPoints} points</strong>, and each Officer scores{' '}
                  <strong>{scoring.officerGoalPoints} point</strong>.
                  <ul style={{ marginTop: '0.4rem', paddingLeft: '1.2rem', lineHeight: 1.5 }}>
                    <li><strong>One-Way Entry:</strong> Once a high piece enters the goal line, it <strong>can never leave</strong> it.</li>
                    <li><strong>Shuffling:</strong> It may shuffle horizontally along the goal line to make room or block.</li>
                    <li><strong>Golden Shield Invulnerability:</strong> High pieces in their goal line <strong>CANNOT BE CAPTURED</strong> by enemy pieces. (However, they can still capture enemies).</li>
                  </ul>
                </div>
              </div>
              <div className="zone-tag-pill" style={{ borderColor: 'var(--accent-gold)', color: 'var(--accent-gold)' }}>
                <Shield size={16} /> Immune to Capture
              </div>
            </div>

            {/* The Battlefield */}
            <div className="zone-strip battlefield">
              <div className="zone-info">
                <div className="zone-header-line">
                  <Navigation size={20} color="var(--accent-blue)" />
                  <div className="zone-title">
                    The Battlefield (Ranks {blueBaseRank + 1} through {blueGoalRank - 1})
                  </div>
                  <span className="zone-badge">Neutral Territory</span>
                </div>
                <div className="zone-desc">
                  Open combat and tactical navigation. Pieces execute straight vectors, bent paths, and tactical captures.
                  High pieces traversing this territory are fully vulnerable to capture by any enemy piece.
                </div>
              </div>
              <div className="zone-tag-pill">
                Standard Movement & Combat
              </div>
            </div>

            {/* Base Line */}
            <div className="zone-strip base">
              <div className="zone-info">
                <div className="zone-header-line">
                  <Shield size={20} color="var(--accent-blue)" />
                  <div className="zone-title">
                    Base Line (Rank {blueBaseRank} for Blue / Rank {blueGoalRank} for Green)
                  </div>
                  <span className="zone-badge">Home Rank</span>
                </div>
                <div className="zone-desc">
                  Where your high pieces begin the match.
                  <ul style={{ marginTop: '0.4rem', paddingLeft: '1.2rem', lineHeight: 1.5 }}>
                    <li><strong>Base Shuffling:</strong> High pieces may shuffle horizontally left and right on the base line before departing.</li>
                    <li><strong>One-Way Exit:</strong> <strong>Once a high piece leaves its base line, it can NEVER return to it.</strong></li>
                  </ul>
                </div>
              </div>
              <div className="zone-tag-pill">
                One-Way Exit Rule
              </div>
            </div>
          </div>

          <div className="rules-callout green">
            <AlertTriangle size={20} />
            <div>
              <strong>Special Exemption: Pawns Have Total Freedom</strong>
              <div style={{ fontSize: '0.86rem', marginTop: '0.2rem' }}>
                Pawns are <strong>exempt</strong> from both Base Line and Goal Line restrictions. They can enter and leave both rows freely, using their versatility to support advances, block enemy high pieces, or deliver tactical surprises.
              </div>
            </div>
          </div>
        </section>

        {/* Section 6: Scoring & Win */}
        <section className="rules-card">
          <div className="rules-card-header">
            <h2 className="rules-card-title">
              <Trophy size={22} color="var(--accent-gold)" />
              Winning, Endgames & Scoring Calculator
            </h2>
            <span className="rules-card-badge">Point System</span>
          </div>

          <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '1.25rem' }}>
            Schada does not end in checkmate. Instead, the game ends immediately the instant all remaining high pieces of a player reach the goal line, or if pieces are blocked.
          </p>

          <div style={{ background: 'var(--bg-tertiary)', padding: '1rem 1.25rem', borderRadius: 'var(--radius-sm)', marginBottom: '1.5rem' }}>
            <div style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
              When Does the Game End?
            </div>
            <ol style={{ paddingLeft: '1.25rem', color: 'var(--text-secondary)', fontSize: '0.88rem', lineHeight: 1.6 }}>
              <li>
                <strong>All High Pieces in Goal:</strong> As soon as all surviving high pieces of a player enter their goal line, the game ends immediately.
              </li>
              <li>
                <strong>Enemy Blockade:</strong> If a player has high pieces outside the goal line but cannot move any of them because they are blocked by enemy pieces.
              </li>
              <li>
                <strong>Threefold Repetition:</strong> The identical board position occurs 3 times.
              </li>
              <li>
                <strong>Repetitive Shuffle:</strong> Both players consecutively shuffle high pieces within base/goal lines.
              </li>
            </ol>
          </div>

          <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
            Interactive Goal Scoring Simulator
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1rem' }}>
            Adjust the number of high pieces that reached the goal line to see how the winner is determined:
          </p>

          <div className="calc-container">
            {/* Blue Team Controls */}
            <div className="calc-team-card blue">
              <div className="calc-team-title">
                <span style={{ color: 'var(--accent-blue)' }}>Blue Army</span>
                <span style={{ fontFamily: 'var(--font-mono)' }}>{blueScore} pts</span>
              </div>

              <div className="calc-row">
                <span>Field Officers in Goal (× {scoring.fieldOfficerGoalPoints} pts)</span>
                <div className="calc-stepper">
                  <button
                    type="button"
                    className="calc-step-btn"
                    disabled={blueFieldOfficers <= 0}
                    onClick={() => setBlueFieldOfficers((v) => Math.max(0, v - 1))}
                  >
                    -
                  </button>
                  <span className="calc-val">{blueFieldOfficers}</span>
                  <button
                    type="button"
                    className="calc-step-btn"
                    disabled={blueFieldOfficers >= army.fieldOfficersCount}
                    onClick={() => setBlueFieldOfficers((v) => Math.min(army.fieldOfficersCount, v + 1))}
                  >
                    +
                  </button>
                </div>
              </div>

              <div className="calc-row">
                <span>Officers in Goal (× {scoring.officerGoalPoints} pt)</span>
                <div className="calc-stepper">
                  <button
                    type="button"
                    className="calc-step-btn"
                    disabled={blueOfficers <= 0}
                    onClick={() => setBlueOfficers((v) => Math.max(0, v - 1))}
                  >
                    -
                  </button>
                  <span className="calc-val">{blueOfficers}</span>
                  <button
                    type="button"
                    className="calc-step-btn"
                    disabled={blueOfficers >= army.officersCount}
                    onClick={() => setBlueOfficers((v) => Math.min(army.officersCount, v + 1))}
                  >
                    +
                  </button>
                </div>
              </div>
            </div>

            {/* Green Team Controls */}
            <div className="calc-team-card green">
              <div className="calc-team-title">
                <span style={{ color: 'var(--accent-green)' }}>Green Army</span>
                <span style={{ fontFamily: 'var(--font-mono)' }}>{greenScore} pts</span>
              </div>

              <div className="calc-row">
                <span>Field Officers in Goal (× {scoring.fieldOfficerGoalPoints} pts)</span>
                <div className="calc-stepper">
                  <button
                    type="button"
                    className="calc-step-btn"
                    disabled={greenFieldOfficers <= 0}
                    onClick={() => setGreenFieldOfficers((v) => Math.max(0, v - 1))}
                  >
                    -
                  </button>
                  <span className="calc-val">{greenFieldOfficers}</span>
                  <button
                    type="button"
                    className="calc-step-btn"
                    disabled={greenFieldOfficers >= army.fieldOfficersCount}
                    onClick={() => setGreenFieldOfficers((v) => Math.min(army.fieldOfficersCount, v + 1))}
                  >
                    +
                  </button>
                </div>
              </div>

              <div className="calc-row">
                <span>Officers in Goal (× {scoring.officerGoalPoints} pt)</span>
                <div className="calc-stepper">
                  <button
                    type="button"
                    className="calc-step-btn"
                    disabled={greenOfficers <= 0}
                    onClick={() => setGreenOfficers((v) => Math.max(0, v - 1))}
                  >
                    -
                  </button>
                  <span className="calc-val">{greenOfficers}</span>
                  <button
                    type="button"
                    className="calc-step-btn"
                    disabled={greenOfficers >= army.officersCount}
                    onClick={() => setGreenOfficers((v) => Math.min(army.officersCount, v + 1))}
                  >
                    +
                  </button>
                </div>
              </div>
            </div>

            {/* Winner Banner */}
            <div className="calc-result-banner">
              {outcomeText}
            </div>
          </div>

          <div className="rules-callout gold" style={{ marginTop: '1.5rem' }}>
            <Award size={20} />
            <div>
              <strong>Official Tiebreaker Hierarchy (Boogerd 1939)</strong>
              <div style={{ fontSize: '0.86rem', marginTop: '0.35rem', lineHeight: 1.6 }}>
                <div>1. <strong>Goal Line Score:</strong> Player with highest total points in the goal line wins.</div>
                <div>
                  2. <strong>Tiebreaker 1 (Surviving High Pieces):</strong> Highest score of surviving high pieces outside the goal line (Field Officer = {scoring.fieldOfficerSurvivingPoints}, Officer = {scoring.officerSurvivingPoints}).
                </div>
                <div>
                  3. <strong>Tiebreaker 2 (Distance Advanced):</strong> Each rank advanced towards the goal line counts as{' '}
                  <strong>
                    {scoring.fieldOfficerRankDistanceNumerator}/{scoring.rankDistanceDenominator} point
                  </strong>{' '}
                  for Field Officers and{' '}
                  <strong>
                    {scoring.officerRankDistanceNumerator}/{scoring.rankDistanceDenominator} point
                  </strong>{' '}
                  for Officers.
                </div>
                <div>4. <strong>Tiebreaker 3:</strong> True draw.</div>
              </div>
            </div>
          </div>

          <div className="rules-callout blue">
            <Info size={20} />
            <div>
              <strong>Golden Tactical Tip</strong>
              <div style={{ fontSize: '0.86rem', marginTop: '0.2rem' }}>
                Do not end the game by rushing your last high piece into the goal line if your opponent has more points in their goal than you. Maneuver, capture their incoming officers, and protect your high-value Field Officers first.
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};
