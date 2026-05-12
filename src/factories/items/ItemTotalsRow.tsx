import {
  ActionIcon,
  Anchor,
  Card,
  Collapse,
  Group,
  Stack,
  Text,
} from '@mantine/core';
import { IconChevronDown, IconChevronRight } from '@tabler/icons-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '@/core/zustand';
import { AllFactoryItemsMap } from '@/recipes/FactoryItem';
import { FactoryItemImage } from '@/recipes/ui/FactoryItemImage';
import type { ItemTotalContributor, ItemTotalRow } from './useItemTotals';

export interface IItemTotalsRowProps {
  row: ItemTotalRow;
}

const formatRate = (value: number) =>
  value === 0
    ? '0'
    : `${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}/min`;

export function ItemTotalsRow({ row }: IItemTotalsRowProps) {
  const [expanded, setExpanded] = useState(false);
  const item = AllFactoryItemsMap[row.resource];
  const displayName = item?.displayName ?? row.resource;

  const netColor = row.net > 0 ? 'teal.4' : row.net < 0 ? 'red.4' : 'dimmed';

  const canExpand = row.producers.length > 0 || row.consumers.length > 0;

  return (
    <Card withBorder>
      <Group
        justify="space-between"
        wrap="nowrap"
        style={{ cursor: canExpand ? 'pointer' : 'default' }}
        onClick={() => canExpand && setExpanded(v => !v)}
      >
        <Group gap="sm" wrap="nowrap">
          <ActionIcon
            variant="subtle"
            color="gray"
            aria-label={expanded ? 'Collapse' : 'Expand'}
            disabled={!canExpand}
            onClick={e => {
              e.stopPropagation();
              setExpanded(v => !v);
            }}
          >
            {expanded ? (
              <IconChevronDown size={16} />
            ) : (
              <IconChevronRight size={16} />
            )}
          </ActionIcon>
          <FactoryItemImage id={row.resource} size={32} />
          <Text fw={500}>{displayName}</Text>
        </Group>
        <Group gap="xl" wrap="nowrap">
          <Stack gap={0} align="flex-end" w={120}>
            <Text size="xs" c="dimmed">
              Produced
            </Text>
            <Text fw={500}>{formatRate(row.produced)}</Text>
          </Stack>
          <Stack gap={0} align="flex-end" w={120}>
            <Text size="xs" c="dimmed">
              Consumed
            </Text>
            <Text fw={500}>{formatRate(row.consumed)}</Text>
          </Stack>
          <Stack gap={0} align="flex-end" w={120}>
            <Text size="xs" c="dimmed">
              Net
            </Text>
            <Text fw={600} c={netColor}>
              {row.net > 0 ? '+' : ''}
              {formatRate(row.net)}
            </Text>
          </Stack>
        </Group>
      </Group>

      <Collapse expanded={expanded}>
        <Stack gap="xs" mt="md" pl={40}>
          {row.producers.length > 0 && (
            <Stack gap={4}>
              <Text size="sm" c="dimmed" fw={500}>
                Producers
              </Text>
              {row.producers.map(c => (
                <ContributorLine
                  key={`p:${c.factoryId}`}
                  contributor={c}
                  kind="produced"
                />
              ))}
            </Stack>
          )}
          {row.consumers.length > 0 && (
            <Stack gap={4}>
              <Text size="sm" c="dimmed" fw={500}>
                Consumers
              </Text>
              {row.consumers.map(c => (
                <ContributorLine
                  key={`c:${c.factoryId}`}
                  contributor={c}
                  kind="consumed"
                />
              ))}
            </Stack>
          )}
        </Stack>
      </Collapse>
    </Card>
  );
}

function ContributorLine({
  contributor,
  kind,
}: {
  contributor: ItemTotalContributor;
  kind: 'produced' | 'consumed';
}) {
  const name = useStore(
    state =>
      state.factories.factories[contributor.factoryId]?.name ??
      'Untitled factory',
  );
  return (
    <Group justify="space-between" wrap="nowrap">
      <Anchor
        component={Link}
        to={`/factories/${contributor.factoryId}`}
        size="sm"
      >
        {name}
      </Anchor>
      <Text size="sm" c={kind === 'produced' ? 'teal.4' : 'red.4'}>
        {kind === 'produced' ? '+' : '-'}
        {formatRate(contributor.amount)}
      </Text>
    </Group>
  );
}
