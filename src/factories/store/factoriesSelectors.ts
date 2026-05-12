import { type Path, setByPath } from '@clickbar/dot-diver';
import { useCallback, useMemo } from 'react';
import { useFormOnChange } from '@/core/form/useFormOnChange';
import { useShallowStore, useStore } from '@/core/zustand';
import type { Factory } from '@/factories/Factory';
import type { FactoryOutputConsumer } from '@/solver/algorithm/solveProduction';
import type { SolverRequest } from '@/solver/store/Solver';

export const useFactoryOnChangeHandler = (id: string | null | undefined) => {
  const updater = useCallback(
    (path: Path<Factory | SolverRequest>, value: string | null | number) => {
      useStore.getState().updateFactoryAndSolverRequest(id!, obj => {
        setByPath(obj, path, value);
      });
    },
    [id],
  );

  return useFormOnChange<Factory | SolverRequest>(updater);
};

export const useFactoryInputsOutputs = (id: string | null | undefined) => {
  const inputs = useShallowStore(
    state => state.factories.factories[id ?? '']?.inputs ?? [],
  );
  const outputs = useShallowStore(
    state => state.factories.factories[id ?? '']?.outputs ?? [],
  );
  return useMemo(() => ({ inputs, outputs }), [inputs, outputs]);
};

/**
 * Returns one entry per (downstream factory, input row) pair where the
 * input references the given factory id. Mirrors the scan used by
 * `OutputDependenciesTable` so the solver graph can show "output to
 * factory X" nodes symmetric to the existing "input from factory Y"
 * nodes.
 *
 * Returns `[]` when there is no current game (e.g. standalone solver).
 *
 * Implementation note: subscribes to a stringified signature (compared with
 * `===`) so re-renders happen only when something semantically relevant
 * changes, then materializes the typed result with `useMemo`. Returning
 * fresh objects directly from a store selector would defeat shallow compare
 * and cause infinite render loops via downstream `useMemo` deps.
 */
const SIGNATURE_SEP = '\u0001';
const FIELD_SEP = '\u0002';

export const useFactoryOutputConsumers = (
  id: string | null | undefined,
): FactoryOutputConsumer[] => {
  const sourceOutputs = useShallowStore(
    state => state.factories.factories[id ?? '']?.outputs ?? [],
  );

  const signature = useStore(state => {
    if (!id) return '';
    const gameId = state.games.selected;
    if (!gameId) return '';
    const factoriesIds = state.games.games[gameId]?.factoriesIds ?? [];
    const sourceFactory = state.factories.factories[id];
    if (!sourceFactory) return '';

    const parts: string[] = [];
    for (const factoryId of factoriesIds) {
      if (factoryId === id) continue;
      const factory = state.factories.factories[factoryId];
      if (!factory || factory.progress === 'disabled') continue;

      // Defensive `?.`: legacy factories from older saves can persist
      // without an `inputs` array, even though the type marks it as
      // required. Treat them as "no inputs" instead of crashing.
      factory.inputs?.forEach((input, inputIndex) => {
        if (input.factoryId !== id) return;
        if (!input.resource || input.amount == null) return;

        const matchingOutputIndex = sourceFactory.outputs.findIndex(
          o => o.resource === input.resource && o.destination !== 'depot',
        );
        const hasAnyOutputForResource = sourceFactory.outputs.some(
          o => o.resource === input.resource,
        );
        // Skip when the only matching outputs are depot uploads: they do
        // not propagate as supply to downstream factories.
        if (matchingOutputIndex < 0 && hasAnyOutputForResource) return;

        parts.push(
          [
            input.resource,
            input.amount,
            factory.id,
            factory.name ?? '',
            inputIndex,
            matchingOutputIndex >= 0 ? matchingOutputIndex : '',
          ].join(FIELD_SEP),
        );
      });
    }
    return parts.join(SIGNATURE_SEP);
  });

  return useMemo(() => {
    if (!signature) return [];
    return signature.split(SIGNATURE_SEP).map((row): FactoryOutputConsumer => {
      const [
        resource,
        amount,
        consumerFactoryId,
        consumerFactoryName,
        consumerInputIndex,
        outputIndex,
      ] = row.split(FIELD_SEP);
      const parsedOutputIndex =
        outputIndex === '' ? undefined : Number(outputIndex);
      return {
        resource,
        amount: Number(amount),
        consumerFactoryId,
        consumerFactoryName:
          consumerFactoryName === '' ? null : consumerFactoryName,
        consumerInputIndex: Number(consumerInputIndex),
        outputIndex: parsedOutputIndex,
        output:
          parsedOutputIndex != null
            ? sourceOutputs[parsedOutputIndex]
            : undefined,
      };
    });
  }, [signature, sourceOutputs]);
};

export const useFactorySimpleAttributes = (id: string | null | undefined) => {
  return useShallowStore(state => {
    const factory = state.factories.factories[id ?? ''];
    return {
      id: factory?.id,
      name: factory?.name,
      description: factory?.description,
      progress: factory?.progress,
      boardIndex: factory?.boardIndex,
    };
  });
};

export type FactorySimpleAttributes = ReturnType<
  typeof useFactorySimpleAttributes
>;

export interface TotalGamePower {
  min: number;
  max: number;
  hasVariable: boolean;
  plannedMin: number;
  plannedMax: number;
  plannedHasVariable: boolean;
  /** Number of factories in the current game that have not produced a value yet. */
  missingCount: number;
  /** Number of factories that contributed to the totals. */
  countedCount: number;
  /** Number of planned factories that contributed to the planned totals. */
  plannedCountedCount: number;
}

export const useTotalGamePower = (): TotalGamePower => {
  return useShallowStore(state => {
    const gameId = state.games.selected;
    if (!gameId) {
      return {
        min: 0,
        max: 0,
        hasVariable: false,
        plannedMin: 0,
        plannedMax: 0,
        plannedHasVariable: false,
        missingCount: 0,
        countedCount: 0,
        plannedCountedCount: 0,
      };
    }
    const factoriesIds = state.games.games[gameId]?.factoriesIds ?? [];
    let min = 0;
    let max = 0;
    let hasVariable = false;
    let plannedMin = 0;
    let plannedMax = 0;
    let plannedHasVariable = false;
    let missingCount = 0;
    let countedCount = 0;
    let plannedCountedCount = 0;
    for (const id of factoriesIds) {
      const factory = state.factories.factories[id];
      if (!factory || factory.progress === 'disabled') continue;
      const power = factory.powerConsumption;
      if (!power) {
        missingCount += 1;
        continue;
      }
      if (factory.progress === 'done') {
        min += power.min;
        max += power.max;
        hasVariable = hasVariable || power.hasVariable;
        countedCount += 1;
      } else {
        plannedMin += power.min;
        plannedMax += power.max;
        plannedHasVariable = plannedHasVariable || power.hasVariable;
        plannedCountedCount += 1;
      }
    }
    return {
      min,
      max,
      hasVariable,
      plannedMin,
      plannedMax,
      plannedHasVariable,
      missingCount,
      countedCount,
      plannedCountedCount,
    };
  });
};
