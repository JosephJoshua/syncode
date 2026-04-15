import { describe, expect, it } from 'vitest';
import { parseGnuTimeOutput } from './parse-gnu-time.js';

const FULL_OUTPUT = `\
\tCommand being timed: "./code.out"
\tUser time (seconds): 1.23
\tSystem time (seconds): 0.45
\tPercent of CPU this job got: 98%
\tElapsed (wall clock) time (h:mm:ss or m:ss): 0:01.70
\tAverage shared text size (kbytes): 0
\tAverage unshared data size (kbytes): 0
\tAverage stack size (kbytes): 0
\tAverage total size (kbytes): 0
\tMaximum resident set size (kbytes): 3456
\tAverage resident set size (kbytes): 0
\tMajor (requiring I/O) page faults: 0
\tMinor (reclaiming a frame) page faults: 512
\tVoluntary context switches: 10
\tInvoluntary context switches: 5
\tSwaps: 0
\tFile system inputs: 0
\tFile system outputs: 8
\tSocket messages sent: 0
\tSocket messages received: 0
\tSignals delivered: 0
\tPage size (bytes): 4096
\tExit status: 0`;

describe('parseGnuTimeOutput', () => {
  describe('GIVEN a complete GNU time -v output', () => {
    it('WHEN parsed THEN returns all metrics correctly', () => {
      const result = parseGnuTimeOutput(FULL_OUTPUT);

      expect(result).not.toBeNull();
      expect(result!.wallClockMs).toBe(1700);
      expect(result!.userTimeMs).toBe(1230);
      expect(result!.sysTimeMs).toBe(450);
      expect(result!.peakMemoryKb).toBe(3456);
    });
  });

  describe('GIVEN a fast program with sub-second wall clock', () => {
    it('WHEN parsed THEN returns correct small values', () => {
      const output = `\
\tCommand being timed: "python3 /tmp/syncode/code.py"
\tUser time (seconds): 0.00
\tSystem time (seconds): 0.00
\tElapsed (wall clock) time (h:mm:ss or m:ss): 0:00.01
\tMaximum resident set size (kbytes): 1024`;

      const result = parseGnuTimeOutput(output);

      expect(result).not.toBeNull();
      expect(result!.wallClockMs).toBe(10);
      expect(result!.userTimeMs).toBe(0);
      expect(result!.sysTimeMs).toBe(0);
      expect(result!.peakMemoryKb).toBe(1024);
    });
  });

  describe('GIVEN a long-running program with h:mm:ss format', () => {
    it('WHEN parsed THEN handles hours correctly', () => {
      const output = `\
\tCommand being timed: "./code.out"
\tUser time (seconds): 4980.50
\tSystem time (seconds): 45.17
\tElapsed (wall clock) time (h:mm:ss or m:ss): 1:23:45.67
\tMaximum resident set size (kbytes): 524288`;

      const result = parseGnuTimeOutput(output);

      expect(result).not.toBeNull();
      // 1*3600 + 23*60 + 45.67 = 3600 + 1380 + 45.67 = 5025.67s = 5025670ms
      expect(result!.wallClockMs).toBe(5025670);
      expect(result!.userTimeMs).toBe(4980500);
      expect(result!.sysTimeMs).toBe(45170);
      expect(result!.peakMemoryKb).toBe(524288);
    });
  });

  describe('GIVEN empty string', () => {
    it('WHEN parsed THEN returns null', () => {
      expect(parseGnuTimeOutput('')).toBeNull();
    });
  });

  describe('GIVEN completely unrelated output', () => {
    it('WHEN parsed THEN returns null', () => {
      expect(parseGnuTimeOutput('Hello, world!\nSome random text.')).toBeNull();
    });
  });

  describe('GIVEN output with wall clock but missing other fields', () => {
    it('WHEN parsed THEN returns metrics with defaults for missing fields', () => {
      const output = '\tElapsed (wall clock) time (h:mm:ss or m:ss): 0:05.00';

      const result = parseGnuTimeOutput(output);

      expect(result).not.toBeNull();
      expect(result!.wallClockMs).toBe(5000);
      expect(result!.userTimeMs).toBe(0);
      expect(result!.sysTimeMs).toBe(0);
      expect(result!.peakMemoryKb).toBe(0);
    });
  });

  describe('GIVEN output missing the wall clock line', () => {
    it('WHEN parsed THEN returns null', () => {
      const output = `\
\tUser time (seconds): 1.23
\tSystem time (seconds): 0.45
\tMaximum resident set size (kbytes): 3456`;

      expect(parseGnuTimeOutput(output)).toBeNull();
    });
  });

  describe('GIVEN wall clock with zero time', () => {
    it('WHEN parsed THEN returns 0 ms', () => {
      const output = `\
\tUser time (seconds): 0.00
\tSystem time (seconds): 0.00
\tElapsed (wall clock) time (h:mm:ss or m:ss): 0:00.00
\tMaximum resident set size (kbytes): 2048`;

      const result = parseGnuTimeOutput(output);

      expect(result).not.toBeNull();
      expect(result!.wallClockMs).toBe(0);
    });
  });

  describe('GIVEN wall clock in minutes format (no hours)', () => {
    it('WHEN parsed THEN converts correctly', () => {
      const output = `\
\tUser time (seconds): 62.00
\tSystem time (seconds): 1.00
\tElapsed (wall clock) time (h:mm:ss or m:ss): 1:03.50
\tMaximum resident set size (kbytes): 8192`;

      const result = parseGnuTimeOutput(output);

      expect(result).not.toBeNull();
      // 1*60 + 3.50 = 63.50s = 63500ms
      expect(result!.wallClockMs).toBe(63500);
    });
  });
});
