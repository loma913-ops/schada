#!/usr/bin/env node
/**
 * Standalone Bot Championship Tournament Simulator CLI.
 *
 * Runs headless simulations pitting the 8 Schada AI bots against each other
 * in single-elimination championship brackets.
 *
 * Usage:
 *   npx tsx scripts/simulateTournaments.ts [options]
 *   npm run simulate -- [options]
 *
 * Options:
 *   -n, --tournaments <count>   Number of championship tournaments (default: 1000)
 *   -t, --time-limit <ms>       Search time limit per move in ms (default: 50)
 *   -m, --max-moves <count>     Maximum moves per game safety limit (default: 300)
 *   -o, --output-dir <path>     Directory for game notations and summaries (default: ./tournament_output)
 *   -h, --help                  Display this help message
 */

import path from 'node:path';
import {
  TOURNAMENT_SIMULATION_CONFIG,
  TournamentConfigError,
} from '../src/core/bot/tournamentConfig';
import { runTournamentSimulation } from '../src/core/bot/tournamentEngine';

interface ParsedCliArgs {
  tournamentsCount: number;
  timeLimitMs: number;
  maxMovesPerGame: number;
  outputDir: string;
}

function printHelp(): void {
  console.log(`
╔════════════════════════════════════════════════════════════════════════════╗
║                   SCHADA BOT CHAMPIONSHIP SIMULATOR                        ║
╚════════════════════════════════════════════════════════════════════════════╝

Pits the 8 Schada AI bots against each other in single-elimination tournament
brackets to calibrate Elo ratings and analyze engine performance.

Usage:
  npm run simulate -- [options]
  npx tsx scripts/simulateTournaments.ts [options]

Options:
  -n, --tournaments <number>   Number of tournaments to simulate (default: ${TOURNAMENT_SIMULATION_CONFIG.defaultTournaments})
  -t, --time-limit <ms>        Move search budget in ms (default: ${TOURNAMENT_SIMULATION_CONFIG.defaultTimeLimitMs}ms)
  -m, --max-moves <number>     Max moves per game before adjudication (default: ${TOURNAMENT_SIMULATION_CONFIG.defaultMaxMovesPerGame})
  -o, --output-dir <path>      Output directory for files (default: ${TOURNAMENT_SIMULATION_CONFIG.defaultOutputDir})
  -h, --help                   Show this help message

Output Artifacts Generated:
  • <output-dir>/games/        Individual game notation files (turn-by-turn PGN style)
  • <output-dir>/tournaments/  Individual tournament bracket result files (.json)
  • <output-dir>/bot_summary.json  Complete structured stats and head-to-head records
  • <output-dir>/bot_summary.md    Human-readable Markdown standings and cross-table
`);
}

function parseCliArgs(args: string[]): ParsedCliArgs {
  let tournamentsCount = TOURNAMENT_SIMULATION_CONFIG.defaultTournaments;
  let timeLimitMs = TOURNAMENT_SIMULATION_CONFIG.defaultTimeLimitMs;
  let maxMovesPerGame = TOURNAMENT_SIMULATION_CONFIG.defaultMaxMovesPerGame;
  let outputDir = TOURNAMENT_SIMULATION_CONFIG.defaultOutputDir;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '-h' || arg === '--help') {
      printHelp();
      process.exit(0);
    } else if (arg === '-n' || arg === '--tournaments') {
      const val = parseInt(args[++i], 10);
      if (isNaN(val)) throw new TournamentConfigError(`Invalid value for ${arg}: must be an integer.`);
      tournamentsCount = val;
    } else if (arg === '-t' || arg === '--time-limit') {
      const val = parseInt(args[++i], 10);
      if (isNaN(val)) throw new TournamentConfigError(`Invalid value for ${arg}: must be an integer.`);
      timeLimitMs = val;
    } else if (arg === '-m' || arg === '--max-moves') {
      const val = parseInt(args[++i], 10);
      if (isNaN(val)) throw new TournamentConfigError(`Invalid value for ${arg}: must be an integer.`);
      maxMovesPerGame = val;
    } else if (arg === '-o' || arg === '--output-dir') {
      const val = args[++i];
      if (!val || val.startsWith('-')) throw new TournamentConfigError(`Invalid value for ${arg}: must be a directory path.`);
      outputDir = val;
    }
  }

  return { tournamentsCount, timeLimitMs, maxMovesPerGame, outputDir };
}

function formatDuration(ms: number): string {
  const { msPerSecond, secondsPerMinute } = TOURNAMENT_SIMULATION_CONFIG.mathConstants;
  const totalSeconds = Math.floor(ms / msPerSecond);
  const minutes = Math.floor(totalSeconds / secondsPerMinute);
  const seconds = totalSeconds % secondsPerMinute;
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${(ms / msPerSecond).toFixed(1)}s`;
}

async function main(): Promise<void> {
  const cliArgs = parseCliArgs(process.argv.slice(2));
  const matchesPerTournament = TOURNAMENT_SIMULATION_CONFIG.botTierCount - 1;

  console.log(`
╔════════════════════════════════════════════════════════════════════════════╗
║                   SCHADA BOT CHAMPIONSHIP SIMULATOR                        ║
╚════════════════════════════════════════════════════════════════════════════╝
• Championships:   ${cliArgs.tournamentsCount.toLocaleString()} tournaments
• Expected Games:  ~${(cliArgs.tournamentsCount * matchesPerTournament).toLocaleString()} games
• Move Budget:     ${cliArgs.timeLimitMs}ms per move
• Max Plies:       ${cliArgs.maxMovesPerGame} moves per game
• Starting Rating: ${TOURNAMENT_SIMULATION_CONFIG.initialBotElo} Elo across all 8 bots
• Output Path:     ${path.resolve(cliArgs.outputDir)}
──────────────────────────────────────────────────────────────────────────────
Starting simulation...
`);

  const summary = await runTournamentSimulation(
    {
      tournamentsCount: cliArgs.tournamentsCount,
      timeLimitMs: cliArgs.timeLimitMs,
      maxMovesPerGame: cliArgs.maxMovesPerGame,
      outputDir: cliArgs.outputDir,
    },
    ({ currentTournament, totalTournaments, matchesCompleted, elapsedMs, currentLeader }) => {
      const pct = ((currentTournament / totalTournaments) * 100).toFixed(1);
      const estTotalMs = (elapsedMs / currentTournament) * totalTournaments;
      const remainingMs = Math.max(0, estTotalMs - elapsedMs);

      const statusLine =
        `[${pct.padStart(5, ' ')}%] ` +
        `Tournaments: ${currentTournament}/${totalTournaments} | ` +
        `Games: ${matchesCompleted.toLocaleString()} | ` +
        `Elapsed: ${formatDuration(elapsedMs)} | ` +
        `ETA: ${formatDuration(remainingMs)} | ` +
        `Leader: ${currentLeader.name} (${currentLeader.elo} Elo, ${currentLeader.championships} wins)`;

      process.stdout.write(`\r\x1b[K${statusLine}`);
    }
  );

  console.log('\n\n════════════════ TOURNAMENT CHAMPIONSHIP STANDINGS (OVERALL) ════════════════');
  console.log(
    'Rank  Tier  Bot Name        Championships   Title %   Record (W-L)   Win %   Final Elo'
  );
  console.log(
    '────  ────  ─────────────   ─────────────   ───────   ────────────   ─────   ─────────'
  );

  summary.tournamentRankings.forEach((r) => {
    const champStr = `${r.championships}`.padStart(13, ' ');
    const champPct = `${r.championshipPct.toFixed(1)}%`.padStart(7, ' ');
    const record = `${r.wins}-${r.losses}`.padStart(12, ' ');
    const winPct = `${r.winRatePct.toFixed(1)}%`.padStart(5, ' ');
    const eloStr = `${r.finalElo}`.padStart(9, ' ');

    console.log(
      `#${r.rank.toString().padEnd(3, ' ')} ` +
      `T${r.tier.toString().padEnd(3, ' ')} ` +
      `${r.name.padEnd(15, ' ')} ` +
      `${champStr}   ` +
      `${champPct}   ` +
      `${record}   ` +
      `${winPct}   ` +
      `${eloStr}`
    );
  });

  console.log('\n═════════════════════ ELO RATING LEADERBOARD & DELTAS ═════════════════════');
  const sortedBots = [...summary.bots].sort((a, b) => b.currentElo - a.currentElo);
  console.log(
    'Rank  Tier  Bot Name        Final Elo   Elo +/-   Peak/Low    Record (W-L)   Win %'
  );
  console.log(
    '────  ────  ─────────────   ─────────   ───────   ─────────   ────────────   ─────'
  );

  sortedBots.forEach((b, idx) => {
    const delta = b.currentElo - TOURNAMENT_SIMULATION_CONFIG.initialBotElo;
    const deltaStr = (delta >= 0 ? `+${delta}` : `${delta}`).padStart(7, ' ');
    const peakLow = `${b.peakElo}/${b.lowestElo}`.padStart(9, ' ');
    const winPct = `${((b.wins / (b.gamesPlayed || 1)) * 100).toFixed(1)}%`.padStart(5, ' ');
    const record = `${b.wins}-${b.losses}`.padStart(12, ' ');

    console.log(
      `#${(idx + 1).toString().padEnd(3, ' ')} ` +
      `T${b.tier.toString().padEnd(3, ' ')} ` +
      `${b.name.padEnd(15, ' ')} ` +
      `${b.currentElo.toString().padStart(9, ' ')}   ` +
      `${deltaStr}   ` +
      `${peakLow}   ` +
      `${record}   ` +
      `${winPct}`
    );
  });

  console.log('\n──────────────────────────────────────────────────────────────────────────────');
  console.log(`✓ Total Tournaments Simulated: ${summary.totalTournaments.toLocaleString()}`);
  console.log(`✓ Total Games Simulated:       ${summary.totalMatches.toLocaleString()}`);
  console.log(`✓ Total Duration:              ${formatDuration(summary.totalDurationMs)}`);
  console.log(`✓ Color Split:                 White ${summary.overallWhiteWins} (${((summary.overallWhiteWins / summary.totalMatches) * 100).toFixed(1)}%) vs. Black ${summary.overallBlackWins} (${((summary.overallBlackWins / summary.totalMatches) * 100).toFixed(1)}%)`);
  console.log(`\nAll files successfully generated at:`);
  console.log(`  • Notation files:    ${path.join(summary.outputDir, TOURNAMENT_SIMULATION_CONFIG.subdirectories.games)}`);
  console.log(`  • Tournament files:  ${path.join(summary.outputDir, TOURNAMENT_SIMULATION_CONFIG.subdirectories.tournaments)}`);
  console.log(`  • Summary JSON:      ${path.join(summary.outputDir, TOURNAMENT_SIMULATION_CONFIG.filenames.summaryJson)}`);
  console.log(`  • Summary Markdown:  ${path.join(summary.outputDir, TOURNAMENT_SIMULATION_CONFIG.filenames.summaryMd)}`);
  console.log('══════════════════════════════════════════════════════════════════════════════\n');
}

main().catch((err) => {
  console.error('\nSimulation failed with error:', err);
  process.exit(1);
});
