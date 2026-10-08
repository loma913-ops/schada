import type { Move, Square } from '../schada/types';
import { createInitialGameState, executeMove, getLegalMovesForSquare } from '../schada/engine';
import { getPieceShortSymbol } from '../schada/notation';
import { AnalysisConfigError } from './analysisConfig';
import type { ParsedGameData } from './analysisTypes';

const MOVE_NOTATION_REGEX = /^([FOPfop]?)([a-h][1-8])[-xX]([a-h][1-8])$/;
const PGN_HEADER_REGEX = /^\s*\[([A-Za-z0-9_]+)\s+"([^"]*)"\]\s*$/;
const MOVE_NUMBER_PREFIX_REGEX = /^\d+\.{1,3}$/;
const GAME_RESULT_TOKENS = new Set(['1-0', '0-1', '1/2-1/2', '0.5-0.5', '*']);

/**
 * Extracts PGN metadata headers and separates the move notation section.
 *
 * Algorithmic Complexity:
 * - Time Complexity: O(L) where L is the number of text lines.
 * - Auxiliary Space Complexity: O(L) for stored headers and body.
 *
 * Growth Rate:
 * - Linear O(L) scaling directly with file line count.
 */
export function extractHeadersAndBody(rawText: string): {
  metadata: Record<string, string>;
  bodyText: string;
} {
  const metadata: Record<string, string> = {};
  const lines = rawText.split(/\r?\n/);
  const bodyLines: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length === 0) continue;

    const match = trimmed.match(PGN_HEADER_REGEX);
    if (match) {
      metadata[match[1]] = match[2];
    } else {
      bodyLines.push(line);
    }
  }

  return { metadata, bodyText: bodyLines.join('\n') };
}

/**
 * Splits body text into clean move notation tokens, stripping move numbers,
 * PGN comments, annotations, and game results.
 *
 * Algorithmic Complexity:
 * - Time Complexity: O(N) where N is the character length of the body text.
 * - Auxiliary Space Complexity: O(M) where M is the count of move tokens.
 *
 * Growth Rate:
 * - Linear O(N) streaming tokenizer; scales efficiently even on multi-thousand character files.
 */
export function tokenizeGameMoves(bodyText: string): string[] {
  // Strip comments: { ... } or ( ... ) or ; ...
  let cleaned = bodyText.replace(/\{[^}]*\}/g, ' ');
  cleaned = cleaned.replace(/\([^)]*\)/g, ' ');
  cleaned = cleaned.replace(/;[^\r\n]*/g, ' ');

  const rawTokens = cleaned.trim().split(/\s+/);
  const moveTokens: string[] = [];

  for (const token of rawTokens) {
    const trimmed = token.trim();
    if (trimmed.length === 0) continue;

    // Check if move number prefix like "1.", "12.", "1..."
    if (MOVE_NUMBER_PREFIX_REGEX.test(trimmed)) {
      continue;
    }

    // Check if game termination token like 1-0
    if (GAME_RESULT_TOKENS.has(trimmed)) {
      continue;
    }

    // Strip inline move numbers like "1.Fe1-e3"
    const withoutPrefix = trimmed.replace(/^\d+\.{1,3}/, '');
    if (withoutPrefix.length === 0) continue;

    // Remove trailing annotations (?, !, ??, !?, ?!)
    const sanitized = withoutPrefix.replace(/[!?]+$/, '');

    if (MOVE_NOTATION_REGEX.test(sanitized)) {
      moveTokens.push(sanitized);
    }
  }

  return moveTokens;
}

/**
 * Validates and replays notation tokens turn-by-turn against the official Schada engine.
 * Converts notation tokens into fully qualified canonical Move objects.
 *
 * Algorithmic Complexity:
 * - Time Complexity: O(M * K) where M is move count, K <= 30 legal moves per square.
 * - Auxiliary Space Complexity: O(M) for the resulting Move array.
 *
 * Growth Rate:
 * - Linear O(M) in moves played; bounded constant work per move execution.
 */
export function replayNotationTokens(tokens: readonly string[]): {
  moves: Move[];
  isComplete: boolean;
} {
  let currentState = createInitialGameState();
  const canonicalMoves: Move[] = [];

  for (let ply = 0; ply < tokens.length; ply++) {
    const token = tokens[ply];
    const match = token.match(MOVE_NOTATION_REGEX);
    if (!match) {
      throw new AnalysisConfigError(`Malformed move notation syntax: "${token}" at ply ${ply + 1}.`);
    }

    const pieceShort = match[1] ? match[1].toUpperCase() : undefined;
    const fromSquare = match[2].toLowerCase() as Square;
    const toSquare = match[3].toLowerCase() as Square;

    const pieceOnSquare = currentState.board[fromSquare];
    if (!pieceOnSquare || pieceOnSquare.color !== currentState.currentTurn) {
      throw new AnalysisConfigError(
        `Illegal move "${token}" at ply ${ply + 1} for ${currentState.currentTurn}: square ${fromSquare} does not contain an active player piece.`
      );
    }

    const legalFromSquare = getLegalMovesForSquare(currentState.board, fromSquare);
    const candidateMoves = legalFromSquare.filter((m) => {
      if (m.to !== toSquare) return false;
      if (pieceShort && getPieceShortSymbol(m.piece).toUpperCase() !== pieceShort) return false;
      return true;
    });

    if (candidateMoves.length === 0) {
      throw new AnalysisConfigError(
        `Illegal move "${token}" at ply ${ply + 1} for ${currentState.currentTurn}: no valid legal move from ${fromSquare} to ${toSquare}.`
      );
    }

    const matchedMove = candidateMoves[0];
    canonicalMoves.push(matchedMove);
    currentState = executeMove(currentState, matchedMove);
  }

  return {
    moves: canonicalMoves,
    isComplete: currentState.isGameOver,
  };
}

/**
 * Universally parses game records from raw strings, file text, or structured JSON objects.
 *
 * Algorithmic Complexity:
 * - Time Complexity: O(N + M * K) where N is input character length, M is move count.
 * - Auxiliary Space Complexity: O(M) for stored Move array and metadata.
 *
 * Growth Rate:
 * - Linear scaling across input size and move count.
 */
export function parseGameInput(rawInput: string | object): ParsedGameData {
  let textToParse = '';
  const initialMeta: Record<string, string> = {};

  if (typeof rawInput === 'object' && rawInput !== null) {
    const obj = rawInput as Record<string, unknown>;

    // Handle tournament JSON or match object
    if (typeof obj.gameNotation === 'string') {
      textToParse = obj.gameNotation;
    } else if (typeof obj.notation === 'string') {
      textToParse = obj.notation;
    } else if (Array.isArray(obj.moves)) {
      textToParse = obj.moves.join(' ');
    } else {
      textToParse = JSON.stringify(rawInput);
    }

    for (const [key, val] of Object.entries(obj)) {
      if (typeof val === 'string' || typeof val === 'number') {
        initialMeta[key] = String(val);
      }
    }
  } else if (typeof rawInput === 'string') {
    const trimmed = rawInput.trim();
    // Detect if input is JSON string
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      try {
        const parsedJson = JSON.parse(trimmed);
        return parseGameInput(parsedJson);
      } catch {
        textToParse = rawInput;
      }
    } else {
      textToParse = rawInput;
    }
  } else {
    throw new AnalysisConfigError('Invalid game input: expected a string or object.');
  }

  const { metadata: extractedMeta, bodyText } = extractHeadersAndBody(textToParse);
  const metadata = { ...initialMeta, ...extractedMeta };
  const notations = tokenizeGameMoves(bodyText);

  if (notations.length === 0) {
    throw new AnalysisConfigError('No valid Schada move notations found in the input data.');
  }

  const { moves, isComplete } = replayNotationTokens(notations);

  return {
    metadata,
    notations,
    moves,
    rawText: textToParse,
    isComplete,
  };
}
