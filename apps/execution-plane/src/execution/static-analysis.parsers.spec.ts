import { describe, expect, it } from 'vitest';
import {
  parseBiomeJson,
  parseClippyJsonLines,
  parseCpdJson,
  parseCppcheckXml,
  parseGolangciLintJson,
  parseLizardXml,
  parsePmdJson,
  parseRuffJson,
} from './static-analysis.parsers.js';

describe('static analysis parser normalization', () => {
  it('GIVEN Ruff JSON WHEN parsed THEN returns diagnostic severity, rule, and location', () => {
    const diagnostics = parseRuffJson(
      JSON.stringify([
        {
          code: 'F841',
          message: 'Local variable `x` is assigned to but never used',
          filename: 'Main.py',
          location: { row: 3, column: 5 },
        },
      ]),
    );

    expect(diagnostics).toEqual([
      expect.objectContaining({
        tool: 'ruff',
        rule: 'F841',
        severity: 'error',
        message: expect.stringContaining('never used'),
        file: 'Main.py',
        line: 3,
        column: 5,
      }),
    ]);
  });

  it('GIVEN Biome JSON WHEN parsed THEN returns readable diagnostics without implementation details', () => {
    const diagnostics = parseBiomeJson(
      JSON.stringify({
        diagnostics: [
          {
            category: 'lint/correctness/noUnusedVariables',
            severity: 'warning',
            description: 'This variable is unused.',
            location: {
              path: { file: 'main.ts' },
              span: { start: { line: 7, column: 11 } },
            },
          },
        ],
      }),
    );

    expect(diagnostics).toEqual([
      expect.objectContaining({
        tool: 'biome',
        rule: 'lint/correctness/noUnusedVariables',
        severity: 'warning',
        message: 'This variable is unused.',
        file: 'main.ts',
        line: 7,
        column: 11,
      }),
    ]);
  });

  it('GIVEN PMD JSON WHEN parsed THEN returns Java rule diagnostics', () => {
    const diagnostics = parsePmdJson(
      JSON.stringify({
        files: [
          {
            filename: 'Main.java',
            violations: [
              {
                beginline: 9,
                begincolumn: 13,
                rule: 'UnusedLocalVariable',
                priority: 3,
                description: 'Avoid unused local variables such as x.',
              },
            ],
          },
        ],
      }),
    );

    expect(diagnostics[0]).toMatchObject({
      tool: 'pmd',
      rule: 'UnusedLocalVariable',
      severity: 'warning',
      file: 'Main.java',
      line: 9,
      column: 13,
    });
  });

  it('GIVEN Cppcheck XML WHEN parsed THEN returns C or C++ diagnostics', () => {
    const diagnostics = parseCppcheckXml(`
      <results>
        <errors>
          <error id="unusedVariable" severity="style" msg="Unused variable: value">
            <location file="main.cpp" line="4" column="7" />
          </error>
        </errors>
      </results>
    `);

    expect(diagnostics[0]).toMatchObject({
      tool: 'cppcheck',
      rule: 'unusedVariable',
      severity: 'info',
      message: 'Unused variable: value',
      file: 'main.cpp',
      line: 4,
      column: 7,
    });
  });

  it('GIVEN golangci-lint JSON WHEN parsed THEN returns Go diagnostics', () => {
    const diagnostics = parseGolangciLintJson(
      JSON.stringify({
        Issues: [
          {
            FromLinter: 'staticcheck',
            Text: 'SA4006: this value is never used',
            Pos: { Filename: 'main.go', Line: 5, Column: 2 },
            Severity: 'warning',
          },
        ],
      }),
    );

    expect(diagnostics[0]).toMatchObject({
      tool: 'golangci-lint',
      rule: 'staticcheck',
      severity: 'warning',
      file: 'main.go',
      line: 5,
      column: 2,
    });
  });

  it('GIVEN Clippy JSON lines WHEN parsed THEN returns Rust diagnostics', () => {
    const diagnostics = parseClippyJsonLines(
      [
        JSON.stringify({
          reason: 'compiler-message',
          message: {
            level: 'warning',
            message: 'unused variable: `x`',
            code: { code: 'unused_variables' },
            spans: [{ file_name: 'src/main.rs', line_start: 6, column_start: 9 }],
          },
        }),
      ].join('\n'),
    );

    expect(diagnostics[0]).toMatchObject({
      tool: 'clippy',
      rule: 'unused_variables',
      severity: 'warning',
      file: 'src/main.rs',
      line: 6,
      column: 9,
    });
  });

  it('GIVEN Lizard XML WHEN parsed THEN returns per-function complexity', () => {
    const functions = parseLizardXml(`
      <cppncss>
        <function name="solve" line="12" endline="40" complexity="14" file="main.py" />
      </cppncss>
    `);

    expect(functions).toEqual([
      expect.objectContaining({
        tool: 'lizard',
        functionName: 'solve',
        file: 'main.py',
        startLine: 12,
        endLine: 40,
        cyclomaticComplexity: 14,
      }),
    ]);
  });

  it('GIVEN CPD JSON WHEN parsed THEN returns duplication occurrences', () => {
    const duplications = parseCpdJson(
      JSON.stringify({
        duplications: [
          {
            lines: 8,
            tokens: 54,
            files: [
              { name: 'main.py', startLine: 3, endLine: 10 },
              { name: 'main.py', startLine: 14, endLine: 21 },
            ],
          },
        ],
      }),
    );

    expect(duplications).toEqual([
      expect.objectContaining({
        tool: 'pmd-cpd',
        lines: 8,
        tokens: 54,
        occurrences: [
          { file: 'main.py', startLine: 3, endLine: 10 },
          { file: 'main.py', startLine: 14, endLine: 21 },
        ],
      }),
    ]);
  });
});
