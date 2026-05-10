import { formatRepeatingNumber } from '@/core/intl/NumberFormatter';
import type { FactoryPower } from '@/factories/Factory';

const NO_SOLVER = '- (no solver)';

export interface FormatPowerOptions {
  /**
   * When true, returns null instead of the no-solver placeholder so the
   * caller can hide the field entirely.
   */
  hideWhenMissing?: boolean;
}

export function formatFactoryPower(
  power: FactoryPower | null | undefined,
  options: FormatPowerOptions = {},
): string | null {
  if (!power) return options.hideWhenMissing ? null : NO_SOLVER;

  if (power.hasVariable) {
    return `${formatRepeatingNumber(power.min)}–${formatRepeatingNumber(
      power.max,
    )} MW`;
  }
  return `${formatRepeatingNumber(power.max)} MW`;
}
