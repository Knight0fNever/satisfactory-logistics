import { useMemo } from 'react';
import { useShallowStore, useStore } from '@/core/zustand';

export type ItemTotalStatus = 'done' | 'planned';

export interface ItemTotalContributor {
  factoryId: string;
  amount: number;
  status: ItemTotalStatus;
}

export interface ItemTotalRow {
  resource: string;
  produced: number;
  consumed: number;
  net: number;
  plannedProduced: number;
  plannedConsumed: number;
  producers: ItemTotalContributor[];
  consumers: ItemTotalContributor[];
}

export function useItemTotals(): ItemTotalRow[] {
  const gameId = useStore(state => state.games.selected);
  const factoriesIds = useShallowStore(state =>
    gameId ? (state.games.games[gameId]?.factoriesIds ?? []) : [],
  );
  const factories = useShallowStore(state => state.factories.factories);

  return useMemo(() => {
    const byResource = new Map<string, ItemTotalRow>();

    const ensureRow = (resource: string): ItemTotalRow => {
      let row = byResource.get(resource);
      if (!row) {
        row = {
          resource,
          produced: 0,
          consumed: 0,
          net: 0,
          plannedProduced: 0,
          plannedConsumed: 0,
          producers: [],
          consumers: [],
        };
        byResource.set(resource, row);
      }
      return row;
    };

    for (const factoryId of factoriesIds) {
      const factory = factories[factoryId];
      if (!factory || factory.progress === 'disabled') continue;

      const isDone = factory.progress === 'done';
      const status: ItemTotalStatus = isDone ? 'done' : 'planned';

      for (const output of factory.outputs ?? []) {
        if (!output.resource || !output.amount) continue;
        const row = ensureRow(output.resource);
        if (isDone) {
          row.produced += output.amount;
        } else {
          row.plannedProduced += output.amount;
        }
        row.producers.push({ factoryId, amount: output.amount, status });
      }

      for (const input of factory.inputs ?? []) {
        if (!input.resource || !input.amount) continue;
        const row = ensureRow(input.resource);
        if (isDone) {
          row.consumed += input.amount;
        } else {
          row.plannedConsumed += input.amount;
        }
        row.consumers.push({ factoryId, amount: input.amount, status });
      }
    }

    const statusRank = (s: ItemTotalStatus) => (s === 'done' ? 0 : 1);

    const rows: ItemTotalRow[] = [];
    for (const row of byResource.values()) {
      row.net = row.produced - row.consumed;
      row.producers.sort(
        (a, b) =>
          statusRank(a.status) - statusRank(b.status) || b.amount - a.amount,
      );
      row.consumers.sort(
        (a, b) =>
          statusRank(a.status) - statusRank(b.status) || b.amount - a.amount,
      );
      rows.push(row);
    }
    rows.sort(
      (a, b) =>
        b.produced + b.plannedProduced - (a.produced + a.plannedProduced) ||
        b.consumed + b.plannedConsumed - (a.consumed + a.plannedConsumed),
    );
    return rows;
  }, [factoriesIds, factories]);
}
