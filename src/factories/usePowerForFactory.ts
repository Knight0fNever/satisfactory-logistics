import { useInViewport } from '@mantine/hooks';
import type { Highs } from 'highs';
import { useEffect, useState } from 'react';
import { useStore } from '@/core/zustand';
import type { FactoryPower } from '@/factories/Factory';
import {
  useFactoryInputsOutputs,
  useFactoryOutputConsumers,
} from '@/factories/store/factoriesSelectors';
import { useShowOutputFactoriesNodes } from '@/games/gamesSlice';
import { computeSolutionPower } from '@/solver/algorithm/computeSolutionPower';
import { isSolutionFound } from '@/solver/algorithm/solve/isSolutionFound';
import { loadHighs, solveProduction } from '@/solver/algorithm/solveProduction';
import { usePathSolverInstance } from '@/solver/store/solverSelectors';

let sharedHighsPromise: Promise<Highs> | null = null;
function getSharedHighs(): Promise<Highs> {
  if (!sharedHighsPromise) sharedHighsPromise = loadHighs();
  return sharedHighsPromise;
}

// Serialize solves so visible cards do not race against the same WASM instance.
let solveQueue: Promise<void> = Promise.resolve();
function enqueueSolve(task: () => Promise<void>): Promise<void> {
  const next = solveQueue.then(task, task);
  solveQueue = next.catch(() => undefined);
  return next;
}

function hashRequest(parts: unknown[]): string {
  // Cheap deterministic hash; collisions would just trigger an unnecessary
  // re-solve, which is harmless.
  return JSON.stringify(parts);
}

export interface FactoryPowerView {
  power: FactoryPower | null;
  hasSolver: boolean;
  loading: boolean;
}

/**
 * Lazily computes power for a factory when its card enters the viewport,
 * caching the result on `factory.powerConsumption`. Skips the solve when
 * the cached hash matches the current factory state.
 */
export function usePowerForFactory(id: string): FactoryPowerView & {
  ref: ReturnType<typeof useInViewport>['ref'];
} {
  const { ref, inViewport } = useInViewport();
  const inputsOutputs = useFactoryInputsOutputs(id);
  const outputConsumers = useFactoryOutputConsumers(id);
  const showOutputFactoriesNodes = useShowOutputFactoriesNodes();
  const instance = usePathSolverInstance(id);
  const cached = useStore(
    state => state.factories.factories[id]?.powerConsumption ?? null,
  );
  const [loading, setLoading] = useState(false);

  const hasSolver = !!instance?.request;
  const currentHash = hasSolver
    ? hashRequest([
        instance!.request,
        inputsOutputs.inputs,
        inputsOutputs.outputs,
        outputConsumers,
        showOutputFactoriesNodes,
        instance!.nodes,
      ])
    : '';

  const isFresh = !!cached && cached.hash === currentHash;

  useEffect(() => {
    if (!hasSolver) return;
    if (!inViewport) return;
    if (isFresh) return;

    let cancelled = false;
    setLoading(true);

    enqueueSolve(async () => {
      if (cancelled) return;
      try {
        const highs = await getSharedHighs();
        if (cancelled) return;

        const solution = solveProduction(highs, {
          ...instance!.request,
          ...inputsOutputs,
          outputConsumers,
          showOutputFactoriesNodes,
          nodes: instance!.nodes,
        });

        if (cancelled) return;

        if (!solution || !isSolutionFound(solution)) {
          useStore.getState().setFactoryPower(id, {
            min: 0,
            max: 0,
            hasVariable: false,
            hash: currentHash,
            computedAt: Date.now(),
          });
          return;
        }

        const { min, max, hasVariable } = computeSolutionPower(solution);
        useStore.getState().setFactoryPower(id, {
          min,
          max,
          hasVariable,
          hash: currentHash,
          computedAt: Date.now(),
        });
      } finally {
        if (!cancelled) setLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [
    id,
    hasSolver,
    inViewport,
    isFresh,
    currentHash,
    instance,
    inputsOutputs,
    outputConsumers,
    showOutputFactoriesNodes,
  ]);

  return {
    ref,
    hasSolver,
    loading,
    power: hasSolver ? cached : null,
  };
}
