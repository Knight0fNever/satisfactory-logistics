import { Stack, Text } from '@mantine/core';
import { ItemTotalsRow } from './ItemTotalsRow';
import { useItemTotals } from './useItemTotals';

// Note: the toolbar's filterName/filterResource controls are factory-centric
// (consumed by useIsFactoryVisible) and intentionally do not affect this
// item-aggregated view.
export function FactoriesItemsView() {
  const rows = useItemTotals();

  if (rows.length === 0) {
    return (
      <Text c="dimmed" ta="center" mt="lg">
        No items produced or consumed yet. Add outputs or inputs to any factory
        to see them here.
      </Text>
    );
  }

  return (
    <Stack gap="sm">
      {rows.map(row => (
        <ItemTotalsRow key={row.resource} row={row} />
      ))}
    </Stack>
  );
}
