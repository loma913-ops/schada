import { describe, it, expect } from 'vitest';
import { execSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';

describe('Analyze Game CLI Script', () => {
  const cliPath = path.resolve(__dirname, '../../../../scripts/analyzeGame.ts');
  const tempOutputDir = path.resolve(__dirname, '../../../../scratch');

  it('prints help message with --help', () => {
    const stdout = execSync(`npx tsx "${cliPath}" --help`, { encoding: 'utf-8' });
    expect(stdout).toContain('SCHADA GAME ANALYSIS ENGINE');
    expect(stdout).toContain('--depth');
    expect(stdout).toContain('--time-limit');
    expect(stdout).toContain('--json');
  });

  it('analyzes moves via CLI and outputs valid JSON with --json', () => {
    const stdout = execSync(
      `npx tsx "${cliPath}" --json -d 2 -t 10 "1. Fe1-e3 Pc7-e5"`,
      { encoding: 'utf-8' }
    );
    const parsed = JSON.parse(stdout);
    expect(parsed.totalPlies).toBe(2);
    expect(parsed.blueAccuracy).toBe(100);
    expect(parsed.moves[0].quality).toBe('book');
  });

  it('saves analysis report to output file with -o', () => {
    if (!fs.existsSync(tempOutputDir)) {
      fs.mkdirSync(tempOutputDir, { recursive: true });
    }
    const outputPath = path.join(tempOutputDir, 'test_analysis_output.json');

    execSync(
      `npx tsx "${cliPath}" -d 2 -t 10 -o "${outputPath}" "1. Fe1-e3 Pc7-e5"`,
      { encoding: 'utf-8' }
    );

    expect(fs.existsSync(outputPath)).toBe(true);
    const fileContent = fs.readFileSync(outputPath, 'utf-8');
    const parsed = JSON.parse(fileContent);
    expect(parsed.totalPlies).toBe(2);

    // Clean up
    fs.unlinkSync(outputPath);
  });
});
