import type { Factory } from '@/factories/Factory';

/**
 * v11 changes Factory.powerConsumption from `number | null` to a
 * FactoryPower object holding {min, max, hasVariable, hash, computedAt}.
 * The legacy field was never written by the app, but defensively rewrite
 * any stray numeric value into the new shape so the cache invalidates on
 * next render (hash is empty, so the headless solver re-runs).
 */
export function storeMigrationV11(state: unknown): unknown {
  const root = state as {
    factories?: {
      factories?: Record<string, Factory & { powerConsumption?: unknown }>;
    };
  };
  const factories = root.factories?.factories;
  if (!factories) return state;
  for (const factory of Object.values(factories)) {
    const legacy = factory.powerConsumption;
    if (legacy == null) continue;
    if (typeof legacy === 'number') {
      factory.powerConsumption = {
        min: legacy,
        max: legacy,
        hasVariable: false,
        hash: '',
        computedAt: 0,
      };
    } else if (typeof legacy !== 'object') {
      factory.powerConsumption = null;
    }
  }
  return state;
}
