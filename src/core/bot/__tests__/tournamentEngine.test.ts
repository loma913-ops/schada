import fs from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  initializeBotParticipants,
  simulateSingleGame,
  playMatchWithDrawResolution,
  simulateTournament,
  generateSummaryReports,
  runTournamentSimulation,
  extractTotalScore,
  computeOverallTournamentRankings,
} from '../tournamentEngine';
import { TOURNAMENT_SIMULATION_CONFIG } from '../tournamentConfig';

describe('Tournament Simulation Engine', () => {
  const testOutputDir = path.resolve(process.cwd(), './test_tournament_output');

  afterEach(() => {
    if (fs.existsSync(testOutputDir)) {
      fs.rmSync(testOutputDir, { recursive: true, force: true });
    }
  });

  it('extracts numeric score correctly from both numbers and ScoreBreakdown objects', () => {
    expect(extractTotalScore(42)).toBe(42);
    expect(extractTotalScore({ totalScore: 350.5 } as any)).toBe(350.5);
    expect(extractTotalScore(null)).toBe(0);
    expect(extractTotalScore(undefined)).toBe(0);
  });

  it('initializes 8 bot participants with 1200 Elo and zero games played', () => {
    const bots = initializeBotParticipants(1200);
    expect(bots).toHaveLength(8);
    for (const bot of bots) {
      expect(bot.currentElo).toBe(1200);
      expect(bot.gamesPlayed).toBe(0);
      expect(bot.wins).toBe(0);
      expect(bot.losses).toBe(0);
      expect(bot.draws).toBe(0);
      expect(bot.championships).toBe(0);
      expect(Object.keys(bot.headToHead)).toHaveLength(7);
    }
    expect(bots[0].name).toBe('Novice');
    expect(bots[7].name).toBe('Master');
  });

  it('simulates a single game between two bots, updates Elo, and generates notation', () => {
    const bots = initializeBotParticipants(1200);
    const blueBot = bots[0]; // Novice
    const greenBot = bots[1]; // Beginner

    const match = simulateSingleGame(
      blueBot,
      greenBot,
      1,
      1,
      'Quarterfinals',
      5, // 5ms budget for fast testing
      40 // 40 moves cap for test speed
    );

    expect(match.tournamentId).toBe(1);
    expect(match.matchId).toBe(1);
    expect(match.movesCount).toBeGreaterThan(0);
    expect(['blue', 'green', 'draw']).toContain(match.winnerColor);
    expect(blueBot.gamesPlayed).toBe(1);
    expect(greenBot.gamesPlayed).toBe(1);
    expect(match.notationText).toContain('[Event "Schada Championship Tournament #1"]');
    expect(match.notationText).toContain('[Round "Quarterfinals Match 1"]');
    expect(match.filename).toMatch(/^t0001_m1_quarterfinals_/);
  });

  it('conducts a match with draw resolution and determines a decisive winner', () => {
    const bots = initializeBotParticipants(1200);
    const botA = bots[2];
    const botB = bots[3];

    const matchOutcome = playMatchWithDrawResolution(
      botA,
      botB,
      1,
      2,
      'Quarterfinals',
      5,
      40
    );

    expect(matchOutcome.matchResults.length).toBeGreaterThanOrEqual(1);
    expect(matchOutcome.winner).toBeDefined();
    expect([botA.tier, botB.tier]).toContain(matchOutcome.winner.tier);
  });

  it('simulates a full 8-bot championship bracket with complete #1 through #8 final rankings', () => {
    const bots = initializeBotParticipants(1200);
    const tourneyResult = simulateTournament(1, bots, 5, 40);

    expect(tourneyResult.tournamentId).toBe(1);
    expect(tourneyResult.matches.length).toBeGreaterThanOrEqual(7);
    expect(tourneyResult.championTier).toBeGreaterThanOrEqual(1);
    expect(tourneyResult.championTier).toBeLessThanOrEqual(8);
    expect(tourneyResult.initialSeeds).toHaveLength(8);

    const winningBot = bots.find((b) => b.tier === tourneyResult.championTier);
    expect(winningBot?.championships).toBe(1);

    // Verify finalRankings in tournament result
    expect(tourneyResult.finalRankings).toHaveLength(8);
    expect(tourneyResult.finalRankings[0].rank).toBe(1);
    expect(tourneyResult.finalRankings[0].stage).toBe(TOURNAMENT_SIMULATION_CONFIG.stageNames.champion);
    expect(tourneyResult.finalRankings[0].wins).toBe(3);
    expect(tourneyResult.finalRankings[0].losses).toBe(0);

    expect(tourneyResult.finalRankings[1].rank).toBe(2);
    expect(tourneyResult.finalRankings[1].stage).toBe(TOURNAMENT_SIMULATION_CONFIG.stageNames.finalist);
    expect(tourneyResult.finalRankings[1].wins).toBe(2);

    expect(tourneyResult.finalRankings[7].rank).toBe(8);
    expect(tourneyResult.finalRankings[7].wins).toBe(0);
    expect(tourneyResult.finalRankings[7].stage).toBe(TOURNAMENT_SIMULATION_CONFIG.stageNames.quarterfinalist);

    // Verify ordering from #1 to #8
    for (let i = 0; i < 7; i++) {
      expect(tourneyResult.finalRankings[i].rank).toBe(i + 1);
      expect(tourneyResult.finalRankings[i].wins).toBeGreaterThanOrEqual(tourneyResult.finalRankings[i + 1].wins);
    }
  }, 20000);

  it('generates accurate JSON and Markdown summary reports with overall championship standings', () => {
    const bots = initializeBotParticipants(1200);
    simulateTournament(1, bots, 5, 40);

    const overallRankings = computeOverallTournamentRankings(bots, 1);
    expect(overallRankings).toHaveLength(8);
    expect(overallRankings[0].rank).toBe(1);
    expect(overallRankings[0].championships).toBe(1);

    const reports = generateSummaryReports(bots, 1, 7, 500);
    expect(reports.json).toBeDefined();
    expect(reports.markdown).toBeDefined();

    const parsedJson = JSON.parse(reports.json);
    expect(parsedJson.totalTournaments).toBe(1);
    expect(parsedJson.standings).toHaveLength(8);
    expect(parsedJson.tournamentRankings).toHaveLength(8);
    expect(parsedJson.tournamentRankings[0].rank).toBe(1);

    expect(reports.markdown).toContain('# Schada Bot Championship Tournament Simulation Report');
    expect(reports.markdown).toContain('## Final Tournament Championship Standings (Across All Tournaments)');
    expect(reports.markdown).toContain('## Elo Rating Standings & Rating Deltas');
    expect(reports.markdown).toContain('## Head-to-Head Cross Table');
  }, 20000);

  it('runs an end-to-end simulation and verifies all output files and finalRankings are generated', async () => {
    const summary = await runTournamentSimulation({
      tournamentsCount: 2,
      timeLimitMs: 5,
      maxMovesPerGame: 40,
      outputDir: testOutputDir,
    });

    expect(summary.totalTournaments).toBe(2);
    expect(summary.totalMatches).toBeGreaterThanOrEqual(14);
    expect(summary.tournamentRankings).toHaveLength(8);

    const gamesDir = path.join(testOutputDir, TOURNAMENT_SIMULATION_CONFIG.subdirectories.games);
    const tourneysDir = path.join(testOutputDir, TOURNAMENT_SIMULATION_CONFIG.subdirectories.tournaments);
    const summaryJson = path.join(testOutputDir, TOURNAMENT_SIMULATION_CONFIG.filenames.summaryJson);
    const summaryMd = path.join(testOutputDir, TOURNAMENT_SIMULATION_CONFIG.filenames.summaryMd);

    expect(fs.existsSync(gamesDir)).toBe(true);
    expect(fs.existsSync(tourneysDir)).toBe(true);
    expect(fs.existsSync(summaryJson)).toBe(true);
    expect(fs.existsSync(summaryMd)).toBe(true);

    const gameFiles = fs.readdirSync(gamesDir);
    expect(gameFiles.length).toBe(summary.totalMatches);

    const tourneyFiles = fs.readdirSync(tourneysDir);
    expect(tourneyFiles.length).toBe(2);

    // Verify tournament JSON file contains finalRankings #1 to #8
    const tourney1Content = JSON.parse(fs.readFileSync(path.join(tourneysDir, tourneyFiles[0]), 'utf-8'));
    expect(tourney1Content.finalRankings).toBeDefined();
    expect(tourney1Content.finalRankings).toHaveLength(8);
    expect(tourney1Content.finalRankings[0].rank).toBe(1);
    expect(tourney1Content.finalRankings[7].rank).toBe(8);
  }, 30000);
});
