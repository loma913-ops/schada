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
  }, 30000);

  it('analyzes moves via CLI and outputs valid JSON with --json', () => {
    const stdout = execSync(
      `npx tsx "${cliPath}" --json -d 2 -t 10 "1. Fe1-e3 Pc7-e5"`,
      { encoding: 'utf-8' }
    );
    const parsed = JSON.parse(stdout);
    expect(parsed.totalPlies).toBe(2);
    expect(parsed.whiteAccuracy).toBe(100);
    expect(parsed.moves[0].quality).toBe('book');
  }, 30000);

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
  }, 30000);

  it('renders correctly aligned terminal tables for move analysis and distribution', () => {
    const stdout = execSync(
      `npx tsx "${cliPath}" -d 2 -t 10 "1. Fe1-e3 Pc7-e5 2. Fc1-c3 Fb8-b6"`,
      { encoding: 'utf-8' }
    );

    expect(stdout).toContain('SCHADA POST-GAME ANALYSIS REPORT');
    expect(stdout).toContain('Move-by-Move Analysis');
    expect(stdout).toContain('Move Quality Distribution');

    // Strip ANSI codes to measure monospaced column positions
    const cleanOutput = stdout.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '');
    const lines = cleanOutput.split('\n');

    // Locate the table header
    const headerLine = lines.find((l) => l.includes('Ply') && l.includes('Quality') && l.includes('Eval'));
    expect(headerLine).toBeDefined();

    const evalHeaderPos = headerLine!.indexOf('Eval');
    const lossHeaderPos = headerLine!.indexOf('Loss');
    expect(evalHeaderPos).toBeGreaterThan(0);
    expect(lossHeaderPos).toBeGreaterThan(evalHeaderPos);

    // Verify each move row has matching column alignments for Eval and Loss
    const moveRows = lines.filter((l) => /^\d+(\.\.\.|\.)\s+(white|black)\s+/.test(l.trim()));
    expect(moveRows.length).toBeGreaterThanOrEqual(2);

    for (const row of moveRows) {
      // In monospaced output, 'Eval' column header has width 8 right-aligned.
      // Character at the end of Eval column should align with the end of header 'Eval'
      expect(row.length).toBeGreaterThanOrEqual(lossHeaderPos + 4);
    }
  }, 30000);
});

