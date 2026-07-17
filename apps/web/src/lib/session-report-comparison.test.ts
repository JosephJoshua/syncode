import {
  calculateAverageDelta,
  parseSessionComparisonIds,
  resolveComparisonTrend,
  serializeSessionComparisonIds,
} from '@/lib/session-report-comparison.js';

describe('session report comparison helpers', () => {
  it('GIVEN messy comparison ids WHEN parsing THEN keeps unique valid ids within the selection cap', () => {
    const ids = parseSessionComparisonIds(
      [
        ' 550E8400-E29B-41D4-A716-446655440000 ',
        'invalid-id',
        '550e8400-e29b-41d4-a716-446655440000',
        '660e8400-e29b-41d4-a716-446655440000',
        '770e8400-e29b-41d4-a716-446655440000',
        '880e8400-e29b-41d4-a716-446655440000',
      ].join(','),
    );

    expect(ids).toEqual([
      '550e8400-e29b-41d4-a716-446655440000',
      '660e8400-e29b-41d4-a716-446655440000',
      '770e8400-e29b-41d4-a716-446655440000',
    ]);
  });

  it('GIVEN selected ids WHEN serializing THEN returns a shareable comma-separated value', () => {
    expect(
      serializeSessionComparisonIds([
        '550e8400-e29b-41d4-a716-446655440000',
        '660e8400-e29b-41d4-a716-446655440000',
      ]),
    ).toBe('550e8400-e29b-41d4-a716-446655440000,660e8400-e29b-41d4-a716-446655440000');
    expect(serializeSessionComparisonIds([])).toBeUndefined();
  });

  it('GIVEN score histories WHEN resolving trend THEN classifies meaningful movement only', () => {
    expect(calculateAverageDelta([60, 64, 69])).toBe(4.5);
    expect(resolveComparisonTrend([60, 64, 69])).toBe('improving');
    expect(resolveComparisonTrend([90, 88, 85])).toBe('declining');
    expect(resolveComparisonTrend([70, 71, 71])).toBe('stable');
  });
});
