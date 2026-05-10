import { describe, expect, test } from 'vitest';
import { computeSolutionPower } from '@/solver/algorithm/computeSolutionPower';
import { loadHighs, solveProduction } from '@/solver/algorithm/solveProduction';

describe('computeSolutionPower', () => {
  test('fixed-power smelter chain: min equals max', async () => {
    const highs = await loadHighs();
    const solution = solveProduction(highs, {
      inputs: [],
      // Iron Ingot is produced in a Smelter (4 MW, fixed power).
      outputs: [{ amount: 30, resource: 'Desc_IronIngot_C' }],
    });
    expect(solution?.result.Status).toBe('Optimal');

    const power = computeSolutionPower(solution!);
    expect(power.hasVariable).toBe(false);
    expect(power.min).toBe(power.max);
    // 30 ingots/min ÷ 30 per smelter = 1 smelter × 4 MW.
    expect(power.max).toBeGreaterThan(0);
  });

  test('larger fixed-power output increases power proportionally', async () => {
    const highs = await loadHighs();
    const small = solveProduction(highs, {
      inputs: [],
      outputs: [{ amount: 30, resource: 'Desc_IronIngot_C' }],
    });
    const large = solveProduction(highs, {
      inputs: [],
      outputs: [{ amount: 90, resource: 'Desc_IronIngot_C' }],
    });
    const smallPower = computeSolutionPower(small!);
    const largePower = computeSolutionPower(large!);
    expect(largePower.max).toBeGreaterThan(smallPower.max);
    expect(smallPower.hasVariable).toBe(false);
    expect(largePower.hasVariable).toBe(false);
  });
});
