import fs from 'node:fs';
import path from 'node:path';
import {
  type BoardMatrix,
  type Move,
  type PieceColor,
  type ScoreBreakdown,
  type WinReason,
} from '../schada/types';
import { createInitialGameState, executeMove } from '../schada/engine';
import { evaluateGameResult } from '../schada/scoring';
import { FastBoard } from './fastBoard';
import { searchBestMove } from './search';
import { getOpeningBookMove } from './openingBook';
import { getBotTier } from './botTiers';
import { calculateEloUpdate, type EloCalculationResult } from '../elo/eloService';
import {
  TOURNAMENT_SIMULATION_CONFIG,
  type TournamentSimulationConfig,
} from './tournamentConfig';

export interface BotParticipant {
  readonly tier: number;
  readonly name: string;
  currentElo: number;
  peakElo: number;
  lowestElo: number;
  gamesPlayed: number;
  wins: number;
  losses: number;
  draws: number;
  whiteWins: number;
  whiteGames: number;
  blackWins: number;
  blackGames: number;
  championships: number;
  winReasons: Record<string, number>;
  totalMovesPlayed: number;
  headToHead: Record<number, { wins: number; losses: number; draws: number }>;
}

export interface MatchSimulationResult {
  readonly tournamentId: number;
  readonly matchId: number;
  readonly roundName: string;
  readonly isRematch: boolean;
  readonly whiteBotTier: number;
  readonly whiteBotName: string;
  readonly blackBotTier: number;
  readonly blackBotName: string;
  readonly whiteEloBefore: number;
  readonly blackEloBefore: number;
  readonly winnerColor: PieceColor | 'draw';
  readonly winnerTier: number;
  readonly winnerName: string;
  readonly winReason: WinReason;
  readonly whiteScore: number;
  readonly blackScore: number;
  readonly movesCount: number;
  readonly eloUpdate: EloCalculationResult;
  readonly notationText: string;
  readonly filename: string;
  readonly durationMs: number;
}

export interface TournamentParticipantRanking {
  readonly rank: number;
  readonly name: string;
  readonly tier: number;
  readonly finalElo: number;
  readonly wins: number;
  readonly losses: number;
  readonly cumulativeWins: number;
  readonly cumulativeLosses: number;
  readonly stage: string;
}

export interface TournamentResult {
  readonly tournamentId: number;
  readonly initialSeeds: readonly { tier: number; name: string }[];
  readonly matches: readonly MatchSimulationResult[];
  readonly championTier: number;
  readonly championName: string;
  readonly finalRankings: readonly TournamentParticipantRanking[];
  readonly durationMs: number;
}

export interface OverallTournamentRanking {
  readonly rank: number;
  readonly tier: number;
  readonly name: string;
  readonly championships: number;
  readonly championshipPct: number;
  readonly wins: number;
  readonly losses: number;
  readonly draws: number;
  readonly winRatePct: number;
  readonly finalElo: number;
  readonly peakElo: number;
}

export interface SimulationSummary {
  readonly totalTournaments: number;
  readonly totalMatches: number;
  readonly totalDurationMs: number;
  readonly outputDir: string;
  readonly bots: readonly BotParticipant[];
  readonly tournamentRankings: readonly OverallTournamentRanking[];
  readonly overallWhiteWins: number;
  readonly overallBlackWins: number;
  readonly overallDraws: number;
  readonly winReasonsDistribution: Record<string, number>;
}

export interface RunTournamentOptions {
  readonly tournamentsCount?: number;
  readonly timeLimitMs?: number;
  readonly maxMovesPerGame?: number;
  readonly outputDir?: string;
  readonly config?: TournamentSimulationConfig;
}

export type ProgressCallback = (progress: {
  currentTournament: number;
  totalTournaments: number;
  matchesCompleted: number;
  elapsedMs: number;
  currentLeader: { name: string; elo: number; championships: number };
}) => void;

/**
 * Extracts numeric score from either a ScoreBreakdown object or primitive number.
 *
 * Algorithmic Complexity:
 * - Time Complexity: O(1) constant time property lookup.
 * - Auxiliary Space Complexity: O(1) constant auxiliary space.
 *
 * Growth Rate:
 * - O(1) invariant across all board positions.
 */
export function extractTotalScore(score: ScoreBreakdown | number | undefined | null): number {
  if (typeof score === 'number') return score;
  if (score && typeof score.totalScore === 'number') return score.totalScore;
  return 0;
}

/**
 * Selects a bot move using direct time budget for rapid headless simulations.
 * Bypasses interactive delay intervals while preserving tree search fidelity.
 *
 * Algorithmic Complexity:
 * - Time Complexity:
 *   - Opening Book hit: O(1) lookup.
 *   - Tree Search: O(b^d) where b <= 18 branching factor and d <= tier.maxDepth,
 *     strictly bounded by timeLimitMs.
 * - Auxiliary Space Complexity: O(d + TT_SIZE) = O(1) fixed preallocated transposition tables.
 *
 * Growth Rate:
 * - O(1) per move bounded by the wall-clock search budget.
 */
export function selectTournamentMove(
  board: BoardMatrix,
  color: PieceColor,
  level: number,
  recentMoves?: Move[],
  moveBudgetMs?: number
): Move | null {
  // 1. Opening book check (0ms)
  const bookMove = getOpeningBookMove(board, color, level, recentMoves);
  if (bookMove) {
    return bookMove;
  }

  // 2. Tree search with exact move budget
  const tier = getBotTier(level);
  const budget = typeof moveBudgetMs === 'number' && moveBudgetMs > 0 ? moveBudgetMs : tier.timeLimitMs;

  const fastBoard = FastBoard.fromBoardMatrix(board, color);
  const fastMove = searchBestMove(fastBoard, tier, budget, recentMoves ? recentMoves.length : 0);
  if (!fastMove) return null;

  return fastBoard.toStandardMove(fastMove);
}

/**
 * Initializes the canonical bots starting with initial Elo and empty match history.
 *
 * Algorithmic Complexity:
 * - Time Complexity: O(N^2) where N is botTierCount (N = 8, constant N^2 = 64 iterations).
 * - Auxiliary Space Complexity: O(N^2) to initialize head-to-head tracking matrices.
 *
 * Growth Rate:
 * - O(1) constant, perfectly stable since tier hierarchy is invariant.
 */
export function initializeBotParticipants(
  configOrElo: TournamentSimulationConfig | number = TOURNAMENT_SIMULATION_CONFIG
): BotParticipant[] {
  const config =
    typeof configOrElo === 'number'
      ? { ...TOURNAMENT_SIMULATION_CONFIG, initialBotElo: configOrElo }
      : configOrElo;
  const bots: BotParticipant[] = [];

  for (let tierLevel = 1; tierLevel <= config.botTierCount; tierLevel++) {
    const tierConfig = getBotTier(tierLevel);
    const headToHead: Record<number, { wins: number; losses: number; draws: number }> = {};
    for (let opp = 1; opp <= config.botTierCount; opp++) {
      if (opp !== tierLevel) {
        headToHead[opp] = { wins: 0, losses: 0, draws: 0 };
      }
    }

    bots.push({
      tier: tierLevel,
      name: tierConfig.name,
      currentElo: config.initialBotElo,
      peakElo: config.initialBotElo,
      lowestElo: config.initialBotElo,
      gamesPlayed: 0,
      wins: 0,
      losses: 0,
      draws: 0,
      whiteWins: 0,
      whiteGames: 0,
      blackWins: 0,
      blackGames: 0,
      championships: 0,
      winReasons: {
        goal_reached: 0,
        elimination: 0,
        blocked: 0,
        repetition: 0,
        mutual_shuffle: 0,
        timeout: 0,
        resignation: 0,
      },
      totalMovesPlayed: 0,
      headToHead,
    });
  }

  return bots;
}

/**
 * Formats a move history array into standard numbered notation text with event headers.
 *
 * Algorithmic Complexity:
 * - Time Complexity: O(M) where M is moveHistory.length (M <= maxMovesPerGame).
 * - Auxiliary Space Complexity: O(M) to buffer notation lines.
 *
 * Growth Rate:
 * - O(M) linear scaling with match move depth.
 */
export function formatNotationFileContent(
  header: {
    tournamentId: number;
    roundName: string;
    matchId: number;
    whiteBot: BotParticipant;
    blackBot: BotParticipant;
    whiteEloBefore: number;
    blackEloBefore: number;
    eloUpdate: EloCalculationResult;
    winnerColor: PieceColor | 'draw';
    winnerName: string;
    winReason: WinReason;
    whiteScore: number;
    blackScore: number;
    durationMs: number;
  },
  moveHistory: Move[]
): string {
  const lines: string[] = [];
  lines.push(`[Event "Schada Championship Tournament #${header.tournamentId}"]`);
  lines.push(`[Round "${header.roundName} Match ${header.matchId}"]`);
  lines.push(`[White "${header.whiteBot.name} (Tier ${header.whiteBot.tier})"]`);
  lines.push(`[Black "${header.blackBot.name} (Tier ${header.blackBot.tier})"]`);
  lines.push(`[WhiteEloBefore "${header.whiteEloBefore}"]`);
  lines.push(`[BlackEloBefore "${header.blackEloBefore}"]`);
  const whiteSign = header.eloUpdate.whiteDelta >= 0 ? `+${header.eloUpdate.whiteDelta}` : `${header.eloUpdate.whiteDelta}`;
  const blackSign = header.eloUpdate.blackDelta >= 0 ? `+${header.eloUpdate.blackDelta}` : `${header.eloUpdate.blackDelta}`;
  lines.push(`[WhiteEloAfter "${header.eloUpdate.newWhiteRating} (${whiteSign})"]`);
  lines.push(`[BlackEloAfter "${header.eloUpdate.newBlackRating} (${blackSign})"]`);

  let resultScore = '1/2-1/2';
  if (header.winnerColor === 'white') resultScore = '1-0';
  else if (header.winnerColor === 'black') resultScore = '0-1';

  lines.push(`[Result "${resultScore}"]`);
  lines.push(`[Winner "${header.winnerName}"]`);
  lines.push(`[WinReason "${header.winReason}"]`);
  lines.push(`[WhiteFinalScore "${header.whiteScore.toFixed(2)}"]`);
  lines.push(`[BlackFinalScore "${header.blackScore.toFixed(2)}"]`);
  lines.push(`[TotalPlies "${moveHistory.length}"]`);
  lines.push(`[DurationMs "${header.durationMs}"]`);
  lines.push(`[Date "${new Date().toISOString()}"]`);
  lines.push('');

  // Format moves in turns (turnNumber. WhiteMove BlackMove)
  for (let i = 0; i < moveHistory.length; i += 2) {
    const turnNumber = Math.floor(i / 2) + 1;
    const whiteMove = moveHistory[i].notation ?? `${moveHistory[i].from}-${moveHistory[i].to}`;
    const blackMove =
      i + 1 < moveHistory.length
        ? moveHistory[i + 1].notation ?? `${moveHistory[i + 1].from}-${moveHistory[i + 1].to}`
        : '';
    lines.push(`${turnNumber.toString().padStart(3, ' ')}. ${whiteMove.padEnd(12, ' ')} ${blackMove}`);
  }

  lines.push('');
  lines.push(`{Result: ${resultScore} - ${header.winnerName} wins via ${header.winReason}}`);
  return lines.join('\n');
}

/**
 * Simulates a single head-to-head game between White and Black bots, updating Elo and game metrics.
 *
 * Algorithmic Complexity:
 * - Time Complexity: O(M * T_search) where M <= maxMoves and T_search is bounded by timeLimitMs.
 * - Auxiliary Space Complexity: O(M) for storing board history states and legal moves.
 *
 * Growth Rate:
 * - O(M) strictly linear in move length per match.
 */
export function simulateSingleGame(
  whiteBot: BotParticipant,
  blackBot: BotParticipant,
  tournamentId: number,
  matchId: number,
  roundName: string,
  timeLimitMs: number,
  maxMoves: number,
  isRematch = false,
  config: TournamentSimulationConfig = TOURNAMENT_SIMULATION_CONFIG
): MatchSimulationResult {
  const startTime = Date.now();
  let state = createInitialGameState();
  let moveCount = 0;

  while (!state.isGameOver && moveCount < maxMoves) {
    const currentTier = state.currentTurn === 'white' ? whiteBot.tier : blackBot.tier;
    const move = selectTournamentMove(
      state.board,
      state.currentTurn,
      currentTier,
      state.moveHistory,
      timeLimitMs
    );

    if (!move) {
      // Fallback: If no move could be generated, tactical resignation
      const resigningColor = state.currentTurn;
      const winner = resigningColor === 'white' ? 'black' : 'white';
      const evaluated = evaluateGameResult(state.board, 'resignation');
      state = {
        ...state,
        isGameOver: true,
        result: {
          winner,
          winReason: 'resignation',
          whiteScore: evaluated.whiteScore,
          blackScore: evaluated.blackScore,
        },
      };
      break;
    }

    state = executeMove(state, move);
    moveCount++;
  }

  // If match exceeded move limit without game over, evaluate terminal score
  if (!state.isGameOver) {
    const evaluated = evaluateGameResult(state.board, 'timeout');
    state = {
      ...state,
      isGameOver: true,
      result: {
        winner: evaluated.winner,
        winReason: 'timeout',
        whiteScore: evaluated.whiteScore,
        blackScore: evaluated.blackScore,
      },
    };
  }

  const durationMs = Date.now() - startTime;
  const winnerColor = state.result?.winner ?? 'draw';
  const winReason: WinReason = state.result?.winReason ?? 'timeout';
  const whiteScore = extractTotalScore(state.result?.whiteScore);
  const blackScore = extractTotalScore(state.result?.blackScore);

  let winnerTier = 0;
  let winnerName = 'Draw';
  if (winnerColor === 'white') {
    winnerTier = whiteBot.tier;
    winnerName = whiteBot.name;
  } else if (winnerColor === 'black') {
    winnerTier = blackBot.tier;
    winnerName = blackBot.name;
  }

  const whiteEloBefore = whiteBot.currentElo;
  const blackEloBefore = blackBot.currentElo;

  // Calculate Elo update
  const eloOutcome = winnerColor === 'white' ? 'white' : winnerColor === 'black' ? 'black' : 'draw';
  const eloUpdate = calculateEloUpdate(
    { rating: whiteEloBefore, gamesPlayed: whiteBot.gamesPlayed },
    { rating: blackEloBefore, gamesPlayed: blackBot.gamesPlayed },
    eloOutcome
  );

  // Update bot participant stats
  whiteBot.gamesPlayed++;
  blackBot.gamesPlayed++;
  whiteBot.whiteGames++;
  blackBot.blackGames++;
  whiteBot.totalMovesPlayed += Math.ceil(moveCount / 2);
  blackBot.totalMovesPlayed += Math.floor(moveCount / 2);

  whiteBot.currentElo = eloUpdate.newWhiteRating;
  blackBot.currentElo = eloUpdate.newBlackRating;

  if (whiteBot.currentElo > whiteBot.peakElo) whiteBot.peakElo = whiteBot.currentElo;
  if (whiteBot.currentElo < whiteBot.lowestElo) whiteBot.lowestElo = whiteBot.currentElo;
  if (blackBot.currentElo > blackBot.peakElo) blackBot.peakElo = blackBot.currentElo;
  if (blackBot.currentElo < blackBot.lowestElo) blackBot.lowestElo = blackBot.currentElo;

  if (winnerColor === 'white') {
    whiteBot.wins++;
    whiteBot.whiteWins++;
    blackBot.losses++;
    whiteBot.winReasons[winReason] = (whiteBot.winReasons[winReason] ?? 0) + 1;
    whiteBot.headToHead[blackBot.tier].wins++;
    blackBot.headToHead[whiteBot.tier].losses++;
  } else if (winnerColor === 'black') {
    blackBot.wins++;
    blackBot.blackWins++;
    whiteBot.losses++;
    blackBot.winReasons[winReason] = (blackBot.winReasons[winReason] ?? 0) + 1;
    blackBot.headToHead[whiteBot.tier].wins++;
    whiteBot.headToHead[blackBot.tier].losses++;
  } else {
    whiteBot.draws++;
    blackBot.draws++;
    whiteBot.headToHead[blackBot.tier].draws++;
    blackBot.headToHead[whiteBot.tier].draws++;
  }

  const padTourney = tournamentId.toString().padStart(config.defaultIdPaddingDigits, '0');
  const roundPrefix = roundName.toLowerCase().replace(/[^a-z0-9]/g, '');
  const rematchSuffix = isRematch ? '_rematch' : '';
  const filename = `t${padTourney}_m${matchId}_${roundPrefix}_${whiteBot.name.toLowerCase()}_vs_${blackBot.name.toLowerCase()}${rematchSuffix}.txt`;

  const notationText = formatNotationFileContent(
    {
      tournamentId,
      roundName,
      matchId,
      whiteBot,
      blackBot,
      whiteEloBefore,
      blackEloBefore,
      eloUpdate,
      winnerColor,
      winnerName,
      winReason,
      whiteScore,
      blackScore,
      durationMs,
    },
    state.moveHistory
  );

  return {
    tournamentId,
    matchId,
    roundName,
    isRematch,
    whiteBotTier: whiteBot.tier,
    whiteBotName: whiteBot.name,
    blackBotTier: blackBot.tier,
    blackBotName: blackBot.name,
    whiteEloBefore,
    blackEloBefore,
    winnerColor,
    winnerTier,
    winnerName,
    winReason,
    whiteScore,
    blackScore,
    movesCount: moveCount,
    eloUpdate,
    notationText,
    filename,
    durationMs,
  };
}

/**
 * Conducts a single-elimination match between two bots, handling rare draws via immediate rematch.
 *
 * Algorithmic Complexity:
 * - Time Complexity: O(R * M * T_search) where R <= maxDrawRematches + 1.
 * - Auxiliary Space Complexity: O(R * M) auxiliary space.
 *
 * Growth Rate:
 * - O(M) linear time per match, bounded by maxDrawRematches.
 */
export function playMatchWithDrawResolution(
  botA: BotParticipant,
  botB: BotParticipant,
  tournamentId: number,
  matchId: number,
  roundName: string,
  timeLimitMs: number,
  maxMoves: number,
  config: TournamentSimulationConfig = TOURNAMENT_SIMULATION_CONFIG
): { matchResults: MatchSimulationResult[]; winner: BotParticipant } {
  const matchResults: MatchSimulationResult[] = [];
  let isAColorWhite = Math.random() < 0.5;
  let attempts = 0;

  while (attempts <= config.maxDrawRematches) {
    const whiteBot = isAColorWhite ? botA : botB;
    const blackBot = isAColorWhite ? botB : botA;
    const isRematch = attempts > 0;

    const result = simulateSingleGame(
      whiteBot,
      blackBot,
      tournamentId,
      matchId,
      roundName,
      timeLimitMs,
      maxMoves,
      isRematch,
      config
    );
    matchResults.push(result);

    if (result.winnerColor !== 'draw') {
      const winner = result.winnerColor === 'white' ? whiteBot : blackBot;
      return { matchResults, winner };
    }

    // On draw, swap colors and attempt rematch
    isAColorWhite = !isAColorWhite;
    attempts++;
  }

  // Safety fallback if consecutive draws reach maxDrawRematches: compare score or coin flip
  const lastResult = matchResults[matchResults.length - 1];
  let winner = botA;
  if (lastResult.whiteScore > lastResult.blackScore) {
    winner = lastResult.whiteBotTier === botA.tier ? botA : botB;
  } else if (lastResult.blackScore > lastResult.whiteScore) {
    winner = lastResult.blackBotTier === botA.tier ? botA : botB;
  } else {
    winner = Math.random() < 0.5 ? botA : botB;
  }

  return { matchResults, winner };
}

/**
 * Shuffles an array randomly using the Fisher-Yates algorithm.
 *
 * Algorithmic Complexity:
 * - Time Complexity: O(N) where N is array length.
 * - Auxiliary Space Complexity: O(N) to return a cloned permutation.
 *
 * Growth Rate:
 * - O(N) linear time.
 */
function shuffle<T>(array: readonly T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Computes ordered tournament rankings (#1 through #8) for a single championship bracket.
 * Ranks by tournament wins/stage progression, breaking ties by final updated Elo.
 *
 * Algorithmic Complexity:
 * - Time Complexity: O(N log N) where N = botTierCount (N = 8, constant time).
 * - Auxiliary Space Complexity: O(N) auxiliary space.
 *
 * Growth Rate:
 * - O(1) invariant across all tournaments.
 */
export function computeTournamentFinalRankings(
  bots: readonly BotParticipant[],
  tournamentRecords: ReadonlyMap<number, { wins: number; losses: number; stage: string }>
): TournamentParticipantRanking[] {
  const participantList = bots.map((bot) => {
    const rec = tournamentRecords.get(bot.tier) ?? { wins: 0, losses: 0, stage: '' };
    return {
      name: bot.name,
      tier: bot.tier,
      finalElo: bot.currentElo,
      wins: rec.wins,
      losses: rec.losses,
      cumulativeWins: bot.wins,
      cumulativeLosses: bot.losses,
      stage: rec.stage,
    };
  });

  // Sort: 1st by tournament wins descending, 2nd by finalElo descending, 3rd by tier descending
  participantList.sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins;
    if (b.finalElo !== a.finalElo) return b.finalElo - a.finalElo;
    return b.tier - a.tier;
  });

  return participantList.map((entry, index) => ({
    rank: index + 1,
    ...entry,
  }));
}

/**
 * Simulates a single 8-bot championship bracket tournament, calculating round winners,
 * champion, and complete #1 through #8 rankings.
 *
 * Algorithmic Complexity:
 * - Time Complexity: O(K * M * T_search) where K = 7 matches in an 8-bot single elimination bracket.
 * - Auxiliary Space Complexity: O(K * M) to store all match results and participant rankings.
 *
 * Growth Rate:
 * - O(M) linear time per tournament, constant in tournament size (8 bots).
 */
export function simulateTournament(
  tournamentId: number,
  bots: BotParticipant[],
  timeLimitMs: number,
  maxMoves: number,
  config: TournamentSimulationConfig = TOURNAMENT_SIMULATION_CONFIG
): TournamentResult {
  const tournamentStartTime = Date.now();
  const allMatches: MatchSimulationResult[] = [];
  const tournamentRecords = new Map<number, { wins: number; losses: number; stage: string }>();

  for (const bot of bots) {
    tournamentRecords.set(bot.tier, { wins: 0, losses: 0, stage: config.stageNames.quarterfinalist });
  }

  // 1. Random bracket shuffle for diverse matchup distribution
  const seededBots = shuffle(bots);
  const initialSeeds = seededBots.map((b) => ({ tier: b.tier, name: b.name }));

  const round1Name = config.bracketRounds[0];
  const round2Name = config.bracketRounds[1];
  const round3Name = config.bracketRounds[2];

  // Round 1: Quarterfinals (4 matches)
  const semiFinalists: BotParticipant[] = [];
  let matchCounter = 1;

  for (let i = 0; i < 8; i += 2) {
    const matchOutcome = playMatchWithDrawResolution(
      seededBots[i],
      seededBots[i + 1],
      tournamentId,
      matchCounter++,
      round1Name,
      timeLimitMs,
      maxMoves,
      config
    );
    allMatches.push(...matchOutcome.matchResults);
    const winner = matchOutcome.winner;
    const loser = winner.tier === seededBots[i].tier ? seededBots[i + 1] : seededBots[i];

    tournamentRecords.set(winner.tier, { wins: 1, losses: 0, stage: config.stageNames.semifinalist });
    tournamentRecords.set(loser.tier, { wins: 0, losses: 1, stage: config.stageNames.quarterfinalist });
    semiFinalists.push(winner);
  }

  // Round 2: Semifinals (2 matches)
  const finalists: BotParticipant[] = [];
  for (let i = 0; i < 4; i += 2) {
    const matchOutcome = playMatchWithDrawResolution(
      semiFinalists[i],
      semiFinalists[i + 1],
      tournamentId,
      matchCounter++,
      round2Name,
      timeLimitMs,
      maxMoves,
      config
    );
    allMatches.push(...matchOutcome.matchResults);
    const winner = matchOutcome.winner;
    const loser = winner.tier === semiFinalists[i].tier ? semiFinalists[i + 1] : semiFinalists[i];

    const currentWinnerRec = tournamentRecords.get(winner.tier)!;
    tournamentRecords.set(winner.tier, { wins: currentWinnerRec.wins + 1, losses: 0, stage: config.stageNames.finalist });

    const currentLoserRec = tournamentRecords.get(loser.tier)!;
    tournamentRecords.set(loser.tier, { wins: currentLoserRec.wins, losses: 1, stage: config.stageNames.semifinalist });

    finalists.push(winner);
  }

  // Round 3: Championship Final (1 match)
  const finalOutcome = playMatchWithDrawResolution(
    finalists[0],
    finalists[1],
    tournamentId,
    matchCounter++,
    round3Name,
    timeLimitMs,
    maxMoves,
    config
  );
  allMatches.push(...finalOutcome.matchResults);

  const champion = finalOutcome.winner;
  const runnerUp = champion.tier === finalists[0].tier ? finalists[1] : finalists[0];

  const currentChampRec = tournamentRecords.get(champion.tier)!;
  tournamentRecords.set(champion.tier, { wins: currentChampRec.wins + 1, losses: 0, stage: config.stageNames.champion });

  const currentRunnerRec = tournamentRecords.get(runnerUp.tier)!;
  tournamentRecords.set(runnerUp.tier, { wins: currentRunnerRec.wins, losses: 1, stage: config.stageNames.finalist });

  champion.championships++;

  const finalRankings = computeTournamentFinalRankings(bots, tournamentRecords);

  return {
    tournamentId,
    initialSeeds,
    matches: allMatches,
    championTier: champion.tier,
    championName: champion.name,
    finalRankings,
    durationMs: Date.now() - tournamentStartTime,
  };
}

/**
 * Computes overall tournament championship rankings across all tournament games.
 * Ranked #1 to #8 by tournament championships won, breaking ties by match win rate and final Elo.
 *
 * Algorithmic Complexity:
 * - Time Complexity: O(N log N) where N = botTierCount (N = 8, constant time).
 * - Auxiliary Space Complexity: O(N) auxiliary space.
 *
 * Growth Rate:
 * - O(1) invariant across all simulation runs.
 */
export function computeOverallTournamentRankings(
  bots: readonly BotParticipant[],
  totalTournaments: number,
  config: TournamentSimulationConfig = TOURNAMENT_SIMULATION_CONFIG
): OverallTournamentRanking[] {
  const { percentageMultiplier } = config.mathConstants;
  const rankings = bots.map((b) => {
    const games = b.gamesPlayed || 1;
    const winRatePct = Number(((b.wins / games) * percentageMultiplier).toFixed(1));
    const championshipPct = Number(((b.championships / (totalTournaments || 1)) * percentageMultiplier).toFixed(1));
    return {
      tier: b.tier,
      name: b.name,
      championships: b.championships,
      championshipPct,
      wins: b.wins,
      losses: b.losses,
      draws: b.draws,
      winRatePct,
      finalElo: b.currentElo,
      peakElo: b.peakElo,
    };
  });

  // Sort: 1st by championships won descending, 2nd by winRatePct descending, 3rd by finalElo descending
  rankings.sort((a, b) => {
    if (b.championships !== a.championships) return b.championships - a.championships;
    if (b.winRatePct !== a.winRatePct) return b.winRatePct - a.winRatePct;
    if (b.finalElo !== a.finalElo) return b.finalElo - a.finalElo;
    return b.tier - a.tier;
  });

  return rankings.map((entry, index) => ({
    rank: index + 1,
    ...entry,
  }));
}

/**
 * Generates the bot_summary.json and bot_summary.md contents, including overall
 * tournament championship rankings and Elo progression tables.
 *
 * Algorithmic Complexity:
 * - Time Complexity: O(N log N + N^2) where N is botTierCount (N = 8, constant time).
 * - Auxiliary Space Complexity: O(N^2) to buffer markdown cross-tables and summary structures.
 *
 * Growth Rate:
 * - O(1) constant scaling independent of tournament count.
 */
export function generateSummaryReports(
  bots: readonly BotParticipant[],
  totalTournaments: number,
  totalMatches: number,
  totalDurationMs: number,
  config: TournamentSimulationConfig = TOURNAMENT_SIMULATION_CONFIG
): { json: string; markdown: string } {
  const sortedByElo = [...bots].sort((a, b) => b.currentElo - a.currentElo);
  const overallTournamentRankings = computeOverallTournamentRankings(bots, totalTournaments, config);

  let overallWhiteWins = 0;
  let overallBlackWins = 0;
  let overallDraws = 0;
  const winReasonsDistribution: Record<string, number> = {};

  for (const bot of bots) {
    overallWhiteWins += bot.whiteWins;
    overallBlackWins += bot.blackWins;
    overallDraws += bot.draws;
    for (const [reason, count] of Object.entries(bot.winReasons)) {
      winReasonsDistribution[reason] = (winReasonsDistribution[reason] ?? 0) + count;
    }
  }

  const { msPerSecond, percentageMultiplier } = config.mathConstants;

  const jsonSummary = {
    generatedAt: new Date().toISOString(),
    totalTournaments,
    totalMatches,
    totalDurationSeconds: Number((totalDurationMs / msPerSecond).toFixed(2)),
    overallWhiteWins,
    overallBlackWins,
    overallDraws,
    winReasonsDistribution,
    tournamentRankings: overallTournamentRankings,
    standings: sortedByElo.map((b, idx) => ({
      rank: idx + 1,
      tier: b.tier,
      name: b.name,
      finalElo: b.currentElo,
      eloChange: b.currentElo - config.initialBotElo,
      peakElo: b.peakElo,
      lowestElo: b.lowestElo,
      gamesPlayed: b.gamesPlayed,
      wins: b.wins,
      losses: b.losses,
      draws: b.draws,
      winRatePct: Number(((b.wins / (b.gamesPlayed || 1)) * percentageMultiplier).toFixed(1)),
      whiteWinRatePct: Number(((b.whiteWins / (b.whiteGames || 1)) * percentageMultiplier).toFixed(1)),
      blackWinRatePct: Number(((b.blackWins / (b.blackGames || 1)) * percentageMultiplier).toFixed(1)),
      championships: b.championships,
      championshipPct: Number(((b.championships / (totalTournaments || 1)) * percentageMultiplier).toFixed(1)),
      averagePliesPerGame: Number(((b.totalMovesPlayed / (b.gamesPlayed || 1)) * 2).toFixed(1)),
      winReasons: b.winReasons,
      headToHead: b.headToHead,
    })),
  };

  const mdLines: string[] = [];
  mdLines.push('# Schada Bot Championship Tournament Simulation Report');
  mdLines.push('');
  mdLines.push(`- **Total Tournaments**: ${totalTournaments.toLocaleString()}`);
  mdLines.push(`- **Total Games Played**: ${totalMatches.toLocaleString()}`);
  mdLines.push(`- **Total Duration**: ${(totalDurationMs / msPerSecond).toFixed(1)}s`);
  mdLines.push(`- **Starting Rating**: ${config.initialBotElo} Elo across all tiers`);
  mdLines.push(`- **Side Win Split**: White ${overallWhiteWins} (${((overallWhiteWins / totalMatches) * percentageMultiplier).toFixed(1)}%) vs. Black ${overallBlackWins} (${((overallBlackWins / totalMatches) * percentageMultiplier).toFixed(1)}%)`);
  mdLines.push('');

  mdLines.push('## Final Tournament Championship Standings (Across All Tournaments)');
  mdLines.push('');
  mdLines.push('| Rank | Tier | Bot Name | Championships Won | Title Win % | Overall Match Record | Match Win % | Final Elo | Peak Elo |');
  mdLines.push('|:---:|:---:|:---|:---:|:---:|:---:|:---:|:---:|:---:|');

  overallTournamentRankings.forEach((r) => {
    mdLines.push(
      `| ${r.rank} | ${r.tier} | **${r.name}** | **${r.championships}** | ${r.championshipPct}% | ${r.wins} - ${r.losses} (${r.draws}) | ${r.winRatePct}% | **${r.finalElo}** | ${r.peakElo} |`
    );
  });

  mdLines.push('');
  mdLines.push('## Elo Rating Standings & Rating Deltas');
  mdLines.push('');
  mdLines.push('| Rank | Tier | Bot Name | Final Elo | Elo +/- | Peak / Low | W - L (D) | Win % | White Win % | Black Win % | Championships |');
  mdLines.push('|:---:|:---:|:---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|');

  sortedByElo.forEach((b, idx) => {
    const delta = b.currentElo - config.initialBotElo;
    const deltaSign = delta >= 0 ? `+${delta}` : `${delta}`;
    const winPct = ((b.wins / (b.gamesPlayed || 1)) * percentageMultiplier).toFixed(1);
    const whiteWinPct = ((b.whiteWins / (b.whiteGames || 1)) * percentageMultiplier).toFixed(1);
    const blackWinPct = ((b.blackWins / (b.blackGames || 1)) * percentageMultiplier).toFixed(1);
    const champPct = ((b.championships / totalTournaments) * percentageMultiplier).toFixed(1);

    mdLines.push(
      `| ${idx + 1} | ${b.tier} | **${b.name}** | **${b.currentElo}** | ${deltaSign} | ${b.peakElo} / ${b.lowestElo} | ${b.wins} - ${b.losses} (${b.draws}) | ${winPct}% | ${whiteWinPct}% | ${blackWinPct}% | **${b.championships}** (${champPct}%) |`
    );
  });

  mdLines.push('');
  mdLines.push('## Head-to-Head Cross Table (Row vs. Column)');
  mdLines.push('');

  // Cross table header
  const headerTiers = bots.map((b) => `T${b.tier} ${b.name.slice(0, 4)}`).join(' | ');
  mdLines.push(`| Bot | ${headerTiers} | Total Record |`);
  mdLines.push(`|:---|${bots.map(() => ':---:').join('|')}|:---:|`);

  for (const bot of bots) {
    const cells: string[] = [];
    for (const opp of bots) {
      if (opp.tier === bot.tier) {
        cells.push('—');
      } else {
        const h2h = bot.headToHead[opp.tier];
        cells.push(`${h2h.wins}-${h2h.losses}`);
      }
    }
    mdLines.push(`| **T${bot.tier} ${bot.name}** | ${cells.join(' | ')} | ${bot.wins}-${bot.losses} |`);
  }

  mdLines.push('');
  mdLines.push('## Victory Conditions Distribution');
  mdLines.push('');
  mdLines.push('| Win Condition | Total Occurrences | Frequency % | Description |');
  mdLines.push('|:---|:---:|:---:|:---|');
  const totalDecisive = Object.values(winReasonsDistribution).reduce((a, b) => a + b, 0) || 1;
  for (const [reason, count] of Object.entries(winReasonsDistribution)) {
    const pct = ((count / totalDecisive) * percentageMultiplier).toFixed(1);
    let desc = '';
    switch (reason) {
      case 'goal_reached':
        desc = 'High pieces successfully entered enemy goal line';
        break;
      case 'blocked':
        desc = 'Opponent non-goal high pieces immobilized by enemy blockade';
        break;
      case 'elimination':
        desc = 'Opponent left with zero legal moves';
        break;
      case 'repetition':
        desc = 'Position repeated threefold without progression';
        break;
      case 'mutual_shuffle':
        desc = 'High pieces repeatedly shuffled laterally';
        break;
      case 'timeout':
        desc = 'Game exceeded move safety threshold';
        break;
      case 'resignation':
        desc = 'Tactical resignation';
        break;
      default:
        desc = reason;
    }
    mdLines.push(`| **${reason}** | ${count} | ${pct}% | ${desc} |`);
  }

  mdLines.push('');
  mdLines.push('## Engine Calibration & Balance Insights');
  mdLines.push('');
  const topChamp = overallTournamentRankings[0];
  const bottomChamp = overallTournamentRankings[overallTournamentRankings.length - 1];
  mdLines.push(`- **Tournament Leader**: Tier ${topChamp.tier} **${topChamp.name}** captured **${topChamp.championships}** championship titles (${topChamp.championshipPct}%) with final Elo ${topChamp.finalElo}.`);
  mdLines.push(`- **Trailing Engine**: Tier ${bottomChamp.tier} **${bottomChamp.name}** finished with ${bottomChamp.championships} titles and Elo ${bottomChamp.finalElo}.`);
  const whiteTotalGames = overallWhiteWins + overallBlackWins;
  const whiteBias = whiteTotalGames > 0 ? (overallWhiteWins / whiteTotalGames) * percentageMultiplier : 50;
  mdLines.push(`- **First-Move (White) Advantage**: White won ${whiteBias.toFixed(1)}% of decisive matches.`);

  return {
    json: JSON.stringify(jsonSummary, null, 2),
    markdown: mdLines.join('\n'),
  };
}

/**
 * Runs the full tournament simulation orchestrator, writing individual match notations,
 * tournament brackets with final rankings, and summary reports to disk.
 *
 * Algorithmic Complexity:
 * - Time Complexity: O(T * K * M * T_search) where T is tournamentsCount, K = 7 matches per bracket,
 *   M <= maxMovesPerGame, and T_search is bounded by timeLimitMs.
 * - Auxiliary Space Complexity: O(K * M) transient in-memory state per tournament, immediately
 *   flushed to disk to prevent unbounded memory growth.
 *
 * Growth Rate:
 * - O(T) strictly linear with respect to tournament count, safely supporting 100,000+ championships.
 */
export async function runTournamentSimulation(
  options: RunTournamentOptions = {},
  onProgress?: ProgressCallback
): Promise<SimulationSummary> {
  const config = options.config ?? TOURNAMENT_SIMULATION_CONFIG;
  const totalTournaments = options.tournamentsCount ?? config.defaultTournaments;
  const timeLimitMs = options.timeLimitMs ?? config.defaultTimeLimitMs;
  const maxMoves = options.maxMovesPerGame ?? config.defaultMaxMovesPerGame;
  const outputDir = path.resolve(process.cwd(), options.outputDir ?? config.defaultOutputDir);

  const gamesDir = path.join(outputDir, config.subdirectories.games);
  const tournamentsDir = path.join(outputDir, config.subdirectories.tournaments);

  fs.mkdirSync(gamesDir, { recursive: true });
  fs.mkdirSync(tournamentsDir, { recursive: true });

  const bots = initializeBotParticipants(config);
  let totalMatches = 0;
  const simulationStartTime = Date.now();
  const idPadding = Math.max(config.defaultIdPaddingDigits, String(totalTournaments).length);

  for (let tId = 1; tId <= totalTournaments; tId++) {
    const tournamentResult = simulateTournament(tId, bots, timeLimitMs, maxMoves, config);
    totalMatches += tournamentResult.matches.length;

    // Write individual game notation files
    for (const match of tournamentResult.matches) {
      const matchFilePath = path.join(gamesDir, match.filename);
      fs.writeFileSync(matchFilePath, match.notationText, 'utf-8');
    }

    // Write individual tournament results file including finalRankings sorted #1 to #8
    const padT = tId.toString().padStart(idPadding, '0');
    const tourneyFilePath = path.join(tournamentsDir, `tournament_${padT}.json`);
    fs.writeFileSync(
      tourneyFilePath,
      JSON.stringify(
        {
          tournamentId: tournamentResult.tournamentId,
          championTier: tournamentResult.championTier,
          championName: tournamentResult.championName,
          durationMs: tournamentResult.durationMs,
          initialSeeds: tournamentResult.initialSeeds,
          matches: tournamentResult.matches.map((m) => ({
            matchId: m.matchId,
            roundName: m.roundName,
            isRematch: m.isRematch,
            whiteBot: `${m.whiteBotName} (${m.whiteBotTier})`,
            blackBot: `${m.blackBotName} (${m.blackBotTier})`,
            winner: m.winnerName,
            winnerColor: m.winnerColor,
            winReason: m.winReason,
            whiteScore: m.whiteScore,
            blackScore: m.blackScore,
            movesCount: m.movesCount,
            whiteEloBefore: m.whiteEloBefore,
            blackEloBefore: m.blackEloBefore,
            newWhiteRating: m.eloUpdate.newWhiteRating,
            newBlackRating: m.eloUpdate.newBlackRating,
            notationFile: m.filename,
          })),
          finalRankings: tournamentResult.finalRankings,
        },
        null,
        2
      ),
      'utf-8'
    );

    if (onProgress && (tId % config.progressLogInterval === 0 || tId === totalTournaments)) {
      const leader = [...bots].sort((a, b) => b.championships - a.championships || b.currentElo - a.currentElo)[0];
      onProgress({
        currentTournament: tId,
        totalTournaments,
        matchesCompleted: totalMatches,
        elapsedMs: Date.now() - simulationStartTime,
        currentLeader: {
          name: leader.name,
          elo: leader.currentElo,
          championships: leader.championships,
        },
      });
    }
  }

  const totalDurationMs = Date.now() - simulationStartTime;
  const reports = generateSummaryReports(bots, totalTournaments, totalMatches, totalDurationMs, config);
  const tournamentRankings = computeOverallTournamentRankings(bots, totalTournaments, config);

  // Write bot_summary.json and bot_summary.md
  fs.writeFileSync(path.join(outputDir, config.filenames.summaryJson), reports.json, 'utf-8');
  fs.writeFileSync(path.join(outputDir, config.filenames.summaryMd), reports.markdown, 'utf-8');

  let overallWhiteWins = 0;
  let overallBlackWins = 0;
  let overallDraws = 0;
  const winReasonsDistribution: Record<string, number> = {};

  for (const bot of bots) {
    overallWhiteWins += bot.whiteWins;
    overallBlackWins += bot.blackWins;
    overallDraws += bot.draws;
    for (const [reason, count] of Object.entries(bot.winReasons)) {
      winReasonsDistribution[reason] = (winReasonsDistribution[reason] ?? 0) + count;
    }
  }

  return {
    totalTournaments,
    totalMatches,
    totalDurationMs,
    outputDir,
    bots,
    tournamentRankings,
    overallWhiteWins,
    overallBlackWins,
    overallDraws,
    winReasonsDistribution,
  };
}
