#!/usr/bin/env node
/**
 * Standalone Schada Game Analysis CLI.
 *
 * Evaluates played moves turn-by-turn against the Tier 8 Master engine,
 * classifies move quality into 10 tiers (Brilliant, Great, Best, Excellent,
 * Good, Book, Inaccuracy, Mistake, Miss, Blunder), computes player accuracy %,
 * and predicts the next best continuation move for unfinished games.
 *
 * Usage:
 *   npx tsx scripts/analyzeGame.ts [options] [game-file-or-notation]
 *   npm run analyze -- [options] [game-file-or-notation]
 *
 * Options:
 *   -d, --depth <number>       Engine search depth (default: 6)
 *   -t, --time-limit <ms>      Per-move search budget in ms (default: 100)
 *   -j, --json                 Output machine-readable JSON to stdout
 *   -o, --output <path>        Write analysis report to output file
 *   -h, --help                 Display this help message
 */

import fs from 'node:fs';
import process from 'node:process';
import {
  CANONICAL_ANALYSIS_CONFIG,
  validateAnalysisConfig,
  type AnalysisConfig,
  type MoveQuality,
} from '../src/core/analysis/analysisConfig';
import { analyzeGame } from '../src/core/analysis/analysisEngine';
import type { GameAnalysisReport } from '../src/core/analysis/analysisTypes';

interface CliArgs {
  inputSource: string | null;
  depth: number;
  timeLimitMs: number;
  isJson: boolean;
  outputPath: string | null;
}

const RESET_COLOR = '\x1b[0m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';

function printHelp(): void {
  console.log(`
╔════════════════════════════════════════════════════════════════════════════╗
║                      SCHADA GAME ANALYSIS ENGINE                           ║
╚════════════════════════════════════════════════════════════════════════════╝

Performs deep, post-game move evaluation and next-move prediction powered
by the Master Schada AI engine.

Usage:
  npm run analyze -- [options] [game-file-or-notation]
  npx tsx scripts/analyzeGame.ts [options] [game-file-or-notation]

Options:
  -d, --depth <number>      Search depth per move (default: ${CANONICAL_ANALYSIS_CONFIG.search.defaultDepth})
  -t, --time-limit <ms>     Time budget per move in ms (default: ${CANONICAL_ANALYSIS_CONFIG.search.defaultTimeLimitMs}ms)
  -j, --json                Output pure JSON report to stdout
  -o, --output <path>       Save analysis report to a file (.json or .txt)
  -h, --help                Show this help message

Input Formats Supported:
  • File path to PGN-style tournament text file (.txt)
  • File path to tournament match log (.json)
  • Raw inline notation string: "1. Fe1-e3 Pc7-e5 2. Fc1-c3 Fb8-b6 ..."
  • Piped standard input (cat game.txt | npm run analyze --)
`);
}

/**
 * Parses command-line arguments into structured configuration.
 *
 * Algorithmic Complexity:
 * - Time Complexity: O(A) where A is the argument count.
 * - Auxiliary Space Complexity: O(1).
 *
 * Growth Rate:
 * - O(A) strictly linear.
 */
function parseArgs(args: string[]): CliArgs {
  let depth = CANONICAL_ANALYSIS_CONFIG.search.defaultDepth;
  let timeLimitMs = CANONICAL_ANALYSIS_CONFIG.search.defaultTimeLimitMs;
  let isJson = false;
  let outputPath: string | null = null;
  let inputSource: string | null = null;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '-h' || arg === '--help') {
      printHelp();
      process.exit(0);
    } else if (arg === '-j' || arg === '--json') {
      isJson = true;
    } else if (arg === '-d' || arg === '--depth') {
      const val = parseInt(args[++i], 10);
      if (isNaN(val)) throw new Error(`Invalid depth argument: ${arg} must be an integer.`);
      depth = val;
    } else if (arg === '-t' || arg === '--time-limit') {
      const val = parseInt(args[++i], 10);
      if (isNaN(val)) throw new Error(`Invalid time limit argument: ${arg} must be an integer.`);
      timeLimitMs = val;
    } else if (arg === '-o' || arg === '--output') {
      outputPath = args[++i];
      if (!outputPath || outputPath.startsWith('-')) {
        throw new Error('Invalid output file path specified.');
      }
    } else if (!arg.startsWith('-')) {
      inputSource = arg;
    }
  }

  return { inputSource, depth, timeLimitMs, isJson, outputPath };
}

/**
 * Reads input game content from a file path, string argument, or piped stdin.
 *
 * Algorithmic Complexity:
 * - Time Complexity: O(B) where B is the byte length of the input.
 * - Auxiliary Space Complexity: O(B).
 *
 * Growth Rate:
 * - Linear O(B).
 */
function readInputText(inputSource: string | null): string {
  if (inputSource) {
    if (fs.existsSync(inputSource)) {
      return fs.readFileSync(inputSource, 'utf-8');
    }
    return inputSource;
  }

  // Check stdin
  if (!process.stdin.isTTY) {
    return fs.readFileSync(0, 'utf-8');
  }

  throw new Error('No game input provided. Pass a file path, notation string, or pipe via stdin.');
}

/**
 * Formats a raw score into a signed point value using configuration parameters.
 *
 * Algorithmic Complexity:
 * - Time Complexity: O(1).
 * - Auxiliary Space Complexity: O(1).
 *
 * Growth Rate:
 * - O(1) constant time.
 */
function formatEval(score: number, config: AnalysisConfig): string {
  const scaled = score / config.formatting.centipointsPerPoint;
  const sign = scaled > 0 ? '+' : '';
  return `${sign}${scaled.toFixed(config.formatting.evalDecimals)}`;
}

/**
 * Formats evaluation delta loss using configured decimal precision.
 *
 * Algorithmic Complexity:
 * - Time Complexity: O(1).
 * - Auxiliary Space Complexity: O(1).
 *
 * Growth Rate:
 * - O(1) constant time.
 */
function formatLoss(delta: number, config: AnalysisConfig): string {
  const scaled = delta / config.formatting.centipointsPerPoint;
  return `-${scaled.toFixed(config.formatting.lossDecimals)}`;
}

/**
 * Computes the visible display width of a string in monospace terminal columns,
 * correctly ignoring ANSI styling escape sequences and accounting for wide emojis.
 *
 * Algorithmic Complexity:
 * - Time Complexity: O(L) where L is the character length of the string.
 * - Auxiliary Space Complexity: O(L) for the stripped string buffer.
 *
 * Growth Rate:
 * - Linear O(L) in character length.
 */
function getVisibleWidth(str: string): number {
  const clean = str.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '');
  let width = 0;
  for (const char of clean) {
    const cp = char.codePointAt(0) ?? 0;
    // Ignore variation selectors (U+FE00..U+FE0F, U+E0100..U+E01EF) and zero-width spaces/joiners
    if (
      (cp >= 0xfe00 && cp <= 0xfe0f) ||
      (cp >= 0xe0100 && cp <= 0xe01ef) ||
      cp === 0x200b ||
      cp === 0x200c ||
      cp === 0x200d
    ) {
      continue;
    }
    // Wide emojis and East Asian Wide characters occupy 2 display cells in terminal emulators
    if (
      (cp >= 0x1f000 && cp <= 0x1faff) ||
      (cp >= 0x1100 && cp <= 0x115f) ||
      (cp >= 0x2e80 && cp <= 0xa4cf && cp !== 0x303f) ||
      (cp >= 0xac00 && cp <= 0xd7a3) ||
      (cp >= 0xf900 && cp <= 0xfaff) ||
      (cp >= 0xfe10 && cp <= 0xfe19) ||
      (cp >= 0xfe30 && cp <= 0xfe6f) ||
      (cp >= 0xff00 && cp <= 0xff60) ||
      (cp >= 0xffe0 && cp <= 0xffe6) ||
      (cp >= 0x20000 && cp <= 0x3fffd)
    ) {
      width += 2;
    } else {
      width += 1;
    }
  }
  return width;
}

/**
 * Right-pads a string with spaces until its visible terminal column width reaches targetWidth.
 * Correctly accounts for embedded ANSI escape codes and wide Unicode glyphs.
 *
 * Algorithmic Complexity:
 * - Time Complexity: O(L + W) where L is string length and W is target column width.
 * - Auxiliary Space Complexity: O(L + W).
 *
 * Growth Rate:
 * - Linear O(L + W).
 */
function padEndVisual(str: string, targetWidth: number): string {
  const currentWidth = getVisibleWidth(str);
  const needed = Math.max(0, targetWidth - currentWidth);
  return str + ' '.repeat(needed);
}

/**
 * Left-pads a string with spaces until its visible terminal column width reaches targetWidth.
 * Correctly accounts for embedded ANSI escape codes and wide Unicode glyphs.
 *
 * Algorithmic Complexity:
 * - Time Complexity: O(L + W) where L is string length and W is target column width.
 * - Auxiliary Space Complexity: O(L + W).
 *
 * Growth Rate:
 * - Linear O(L + W).
 */
function padStartVisual(str: string, targetWidth: number): string {
  const currentWidth = getVisibleWidth(str);
  const needed = Math.max(0, targetWidth - currentWidth);
  return ' '.repeat(needed) + str;
}

/**
 * Renders the complete terminal report with formatted tables and ANSI colors.
 *
 * Algorithmic Complexity:
 * - Time Complexity: O(M) where M is the count of evaluated moves.
 * - Auxiliary Space Complexity: O(1) streaming stdout output.
 *
 * Growth Rate:
 * - Linear O(M) in total moves.
 */
function renderTerminalReport(report: GameAnalysisReport, config: AnalysisConfig): void {
  validateAnalysisConfig(config);
  const { badges, formatting } = config;
  const w = formatting.tableColumnWidths;

  console.log(`\n${BOLD}════════════════════════════════════════════════════════════════════════════${RESET_COLOR}`);
  console.log(`${BOLD}                    SCHADA POST-GAME ANALYSIS REPORT                        ${RESET_COLOR}`);
  console.log(`${BOLD}════════════════════════════════════════════════════════════════════════════${RESET_COLOR}`);

  if (Object.keys(report.metadata).length > 0) {
    console.log(`\n${DIM}Metadata:${RESET_COLOR}`);
    for (const [k, v] of Object.entries(report.metadata)) {
      console.log(`  ${BOLD}${k}:${RESET_COLOR} ${v}`);
    }
  }

  const tableHeader = `${BOLD}${padEndVisual('Ply', w.ply)} ${padEndVisual('Turn', w.turn)} ${padEndVisual(
    'Move',
    w.move
  )} ${padEndVisual('Quality', w.badge)} ${padStartVisual('Eval', w.eval)} ${padStartVisual(
    'Loss',
    w.loss
  )}  ${'Best Move'}${RESET_COLOR}`;
  const tableWidth = getVisibleWidth(tableHeader);
  const tableDivider = `${DIM}${'-'.repeat(tableWidth)}${RESET_COLOR}`;

  console.log(`\n${BOLD}Move-by-Move Analysis (${report.totalPlies} plies, ${report.durationMs}ms):${RESET_COLOR}`);
  console.log(tableDivider);
  console.log(tableHeader);
  console.log(tableDivider);

  for (const m of report.moves) {
    const badge = badges[m.quality];
    const plyLabel = m.turn === 'blue' ? `${m.moveNumber}.` : `${m.moveNumber}...`;
    const sym = padEndVisual(badge.symbol, 2);
    const qualityLabel = `${badge.ansiColor}${sym} ${badge.label}${RESET_COLOR}`;
    const evalStr = formatEval(m.evalAfter, config);
    const lossStr = m.quality === 'book' ? '-' : formatLoss(m.evalDelta, config);
    const altBest =
      m.quality !== 'best' && m.quality !== 'brilliant' && m.quality !== 'book' && m.bestNotation !== m.playedNotation
        ? `${DIM}(best: ${m.bestNotation})${RESET_COLOR}`
        : m.bookLineName
          ? `${DIM}[${m.bookLineName}]${RESET_COLOR}`
          : '';

    console.log(
      `${padEndVisual(plyLabel, w.ply)} ${padEndVisual(m.turn, w.turn)} ${BOLD}${padEndVisual(
        m.playedNotation,
        w.move
      )}${RESET_COLOR} ${padEndVisual(qualityLabel, w.badge)} ${padStartVisual(evalStr, w.eval)} ${padStartVisual(
        lossStr,
        w.loss
      )}  ${altBest}`
    );
  }

  console.log(tableDivider);

  // Next Move Prediction (if game is unfinished)
  if (report.nextMove) {
    console.log(`\n${BOLD}╔════════════════════════════════════════════════════════════════════════════╗${RESET_COLOR}`);
    console.log(`${BOLD}║                      NEXT BEST MOVE PREDICTION                             ║${RESET_COLOR}`);
    console.log(`${BOLD}╚════════════════════════════════════════════════════════════════════════════╝${RESET_COLOR}`);
    console.log(
      `  ${BOLD}Active Turn:${RESET_COLOR} ${report.nextMove.turn.toUpperCase()}`
    );
    console.log(
      `  ${BOLD}Predicted Best Move:${RESET_COLOR} ${badges.best.ansiColor}★ ${report.nextMove.notation}${RESET_COLOR} (eval: ${formatEval(report.nextMove.evaluation, config)})`
    );
    console.log(`\n  ${DIM}Top Continuation Candidates:${RESET_COLOR}`);
    report.nextMove.candidateMoves.forEach((cand, idx) => {
      console.log(
        `    ${idx + 1}. ${BOLD}${padEndVisual(cand.notation, w.move)}${RESET_COLOR} (eval: ${formatEval(
          cand.score,
          config
        )})`
      );
    });
  }

  // Player Accuracy & Summary Breakdown
  console.log(`\n${BOLD}════════════════════════════════════════════════════════════════════════════${RESET_COLOR}`);
  console.log(`${BOLD}                        ACCURACY & SUMMARY STATS                            ${RESET_COLOR}`);
  console.log(`${BOLD}════════════════════════════════════════════════════════════════════════════${RESET_COLOR}`);
  console.log(`  ${BOLD}Blue Accuracy:${RESET_COLOR}  ${report.blueAccuracy.toFixed(config.accuracy.accuracyDecimals)}%`);
  console.log(`  ${BOLD}Green Accuracy:${RESET_COLOR} ${report.greenAccuracy.toFixed(config.accuracy.accuracyDecimals)}%`);
  console.log(`\n${DIM}Move Quality Distribution:${RESET_COLOR}`);

  const qualities: MoveQuality[] = [
    'brilliant',
    'great',
    'best',
    'excellent',
    'good',
    'book',
    'inaccuracy',
    'mistake',
    'miss',
    'blunder',
  ];

  const distHeader = `  ${padEndVisual('Classification', w.distributionCol)} ${padStartVisual(
    'Blue',
    w.countCol
  )} ${padStartVisual('Green', w.countCol)}`;
  const distWidth = getVisibleWidth(distHeader) - 2;
  const distDivider = `  ${DIM}${'-'.repeat(distWidth)}${RESET_COLOR}`;

  console.log(distHeader);
  console.log(distDivider);
  for (const q of qualities) {
    const badge = badges[q];
    const blueCount = report.blueBreakdown[q];
    const greenCount = report.greenBreakdown[q];
    const sym = padEndVisual(badge.symbol, 2);
    const classText = `${badge.ansiColor}${sym}  ${badge.label}${RESET_COLOR}`;
    console.log(
      `  ${padEndVisual(classText, w.distributionCol)} ${padStartVisual(
        String(blueCount),
        w.countCol
      )} ${padStartVisual(String(greenCount), w.countCol)}`
    );
  }
  console.log(`${distDivider}\n`);
}

async function main(): Promise<void> {
  try {
    const args = parseArgs(process.argv.slice(2));
    const rawInput = readInputText(args.inputSource);

    const report = analyzeGame(rawInput, {
      depth: args.depth,
      timeLimitMs: args.timeLimitMs,
      config: CANONICAL_ANALYSIS_CONFIG,
    });

    if (args.isJson) {
      const jsonStr = JSON.stringify(report, null, 2);
      if (args.outputPath) {
        fs.writeFileSync(args.outputPath, jsonStr, 'utf-8');
      } else {
        console.log(jsonStr);
      }
      return;
    }

    renderTerminalReport(report, CANONICAL_ANALYSIS_CONFIG);

    if (args.outputPath) {
      const logContent = JSON.stringify(report, null, 2);
      fs.writeFileSync(args.outputPath, logContent, 'utf-8');
      console.log(`${BOLD}Report saved to:${RESET_COLOR} ${args.outputPath}\n`);
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`\x1b[31;1mError:\x1b[0m ${message}`);
    process.exit(1);
  }
}

main();
