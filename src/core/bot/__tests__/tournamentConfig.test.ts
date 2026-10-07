import { describe, expect, it } from 'vitest';
import {
  TOURNAMENT_SIMULATION_CONFIG,
  TournamentConfigError,
  validateTournamentSimulationConfig,
  type TournamentSimulationConfig,
} from '../tournamentConfig';

describe('Tournament Simulation Configuration', () => {
  it('validates canonical configuration without errors', () => {
    expect(() => validateTournamentSimulationConfig(TOURNAMENT_SIMULATION_CONFIG)).not.toThrow();
    expect(TOURNAMENT_SIMULATION_CONFIG.defaultTournaments).toBe(1000);
    expect(TOURNAMENT_SIMULATION_CONFIG.initialBotElo).toBe(1200);
    expect(TOURNAMENT_SIMULATION_CONFIG.botTierCount).toBe(8);
    expect(TOURNAMENT_SIMULATION_CONFIG.maxDrawRematches).toBe(3);
    expect(TOURNAMENT_SIMULATION_CONFIG.defaultIdPaddingDigits).toBe(4);
    expect(TOURNAMENT_SIMULATION_CONFIG.mathConstants.msPerSecond).toBe(1000);
  });

  it('rejects missing or null configuration', () => {
    expect(() => validateTournamentSimulationConfig(null as any)).toThrow(TournamentConfigError);
    expect(() => validateTournamentSimulationConfig(undefined as any)).toThrow(TournamentConfigError);
  });

  it('rejects invalid tournament bounds', () => {
    const invalidLow: TournamentSimulationConfig = {
      ...TOURNAMENT_SIMULATION_CONFIG,
      defaultTournaments: 0,
    };
    expect(() => validateTournamentSimulationConfig(invalidLow)).toThrow(TournamentConfigError);

    const invalidHigh: TournamentSimulationConfig = {
      ...TOURNAMENT_SIMULATION_CONFIG,
      defaultTournaments: 1_000_000,
    };
    expect(() => validateTournamentSimulationConfig(invalidHigh)).toThrow(TournamentConfigError);
  });

  it('rejects invalid time limit bounds', () => {
    const invalidTime: TournamentSimulationConfig = {
      ...TOURNAMENT_SIMULATION_CONFIG,
      defaultTimeLimitMs: 2,
    };
    expect(() => validateTournamentSimulationConfig(invalidTime)).toThrow(TournamentConfigError);
  });

  it('rejects invalid bot tier count', () => {
    const invalidTiers: TournamentSimulationConfig = {
      ...TOURNAMENT_SIMULATION_CONFIG,
      botTierCount: 7,
    };
    expect(() => validateTournamentSimulationConfig(invalidTiers)).toThrow(TournamentConfigError);
  });

  it('rejects invalid bracket rounds', () => {
    const invalidRounds: TournamentSimulationConfig = {
      ...TOURNAMENT_SIMULATION_CONFIG,
      bracketRounds: ['Round 1', 'Round 2'],
    };
    expect(() => validateTournamentSimulationConfig(invalidRounds)).toThrow(TournamentConfigError);

    const invalidEmptyRound: TournamentSimulationConfig = {
      ...TOURNAMENT_SIMULATION_CONFIG,
      bracketRounds: ['Round 1', '', 'Round 3'],
    };
    expect(() => validateTournamentSimulationConfig(invalidEmptyRound)).toThrow(TournamentConfigError);
  });

  it('rejects invalid draw rematches or padding digits', () => {
    const invalidRematches: TournamentSimulationConfig = {
      ...TOURNAMENT_SIMULATION_CONFIG,
      maxDrawRematches: 0,
    };
    expect(() => validateTournamentSimulationConfig(invalidRematches)).toThrow(TournamentConfigError);

    const invalidPadding: TournamentSimulationConfig = {
      ...TOURNAMENT_SIMULATION_CONFIG,
      defaultIdPaddingDigits: 0,
    };
    expect(() => validateTournamentSimulationConfig(invalidPadding)).toThrow(TournamentConfigError);
  });

  it('rejects invalid math constants', () => {
    const invalidMath: TournamentSimulationConfig = {
      ...TOURNAMENT_SIMULATION_CONFIG,
      mathConstants: {
        msPerSecond: 0,
        secondsPerMinute: 60,
        percentageMultiplier: 100,
      },
    };
    expect(() => validateTournamentSimulationConfig(invalidMath)).toThrow(TournamentConfigError);
  });

  it('rejects empty output directory or subdirectories', () => {
    const invalidOutputDir: TournamentSimulationConfig = {
      ...TOURNAMENT_SIMULATION_CONFIG,
      defaultOutputDir: '   ',
    };
    expect(() => validateTournamentSimulationConfig(invalidOutputDir)).toThrow(TournamentConfigError);

    const invalidSubdir: TournamentSimulationConfig = {
      ...TOURNAMENT_SIMULATION_CONFIG,
      subdirectories: { games: '', tournaments: 'tournaments' },
    };
    expect(() => validateTournamentSimulationConfig(invalidSubdir)).toThrow(TournamentConfigError);
  });
});
