export const WEAKNESS_CATEGORIES = [
  'edge_cases',
  'time_complexity',
  'space_complexity',
  'variable_naming',
  'code_structure',
  'off_by_one',
  'input_validation',
  'communication',
] as const;

export type WeaknessCategory = (typeof WEAKNESS_CATEGORIES)[number];

export const WEAKNESS_TRENDS = ['improving', 'stable', 'worsening'] as const;

export type WeaknessTrend = (typeof WEAKNESS_TRENDS)[number];
