import { useMemo } from 'react';
import { useShallowStore, useStore } from '@/core/zustand';

export interface ItemTotalContributor {
  factoryId: string;
  amount: number;
}

export interface ItemTotalRow {
  resource: string;
  produced: number;
  consumed: number;
  net: number;
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

      for (const output of factory.outputs ?? []) {
        if (!output.resource || !output.amount) continue;
        const row = ensureRow(output.resource);
        row.produced += output.amount;
        row.producers.push({ factoryId, amount: output.amount });
      }

      for (const input of factory.inputs ?? []) {
        if (!input.resource || !input.amount) continue;
        const row = ensureRow(input.resource);
        row.consumed += input.amount;
        row.consumers.push({ factoryId, amount: input.amount });
      }
    }

    const rows: ItemTotalRow[] = [];
    for (const row of byResource.values()) {
      row.net = row.produced - row.consumed;
      row.producers.sort((a, b) => b.amount - a.amount);
      row.consumers.sort((a, b) => b.amount - a.amount);
      rows.push(row);
    }
    rows.sort((a, b) => b.produced - a.produced || b.consumed - a.consumed);
    return rows;
  }, [factoriesIds, factories]);
}
