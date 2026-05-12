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

  const doneProducers = row.producers.filter(c => c.status === 'done');
  const plannedProducers = row.producers.filter(c => c.status === 'planned');
  const doneConsumers = row.consumers.filter(c => c.status === 'done');
  const plannedConsumers = row.consumers.filter(c => c.status === 'planned');

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
        <Group gap="xl" wrap="nowrap" align="flex-start">
          <Stack gap={0} align="flex-end" w={130}>
            <Text size="xs" c="dimmed">
              Produced
            </Text>
            <Text fw={600} size="lg">
              {formatRate(row.produced)}
            </Text>
            {row.plannedProduced > 0 && (
              <Text size="xs" c="yellow.4">
                +{formatRate(row.plannedProduced)} planned
              </Text>
            )}
          </Stack>
          <Stack gap={0} align="flex-end" w={130}>
            <Text size="xs" c="dimmed">
              Consumed
            </Text>
            <Text fw={600} size="lg">
              {formatRate(row.consumed)}
            </Text>
            {row.plannedConsumed > 0 && (
              <Text size="xs" c="yellow.4">
                +{formatRate(row.plannedConsumed)} planned
              </Text>
            )}
          </Stack>
          <Stack gap={0} align="flex-end" w={130}>
            <Text size="xs" c="dimmed">
              Net
            </Text>
            <Text fw={700} size="lg" c={netColor}>
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
              {doneProducers.length > 0 && (
                <>
                  <Text size="sm" c="dimmed" fw={500}>
                    Producers (Done)
                  </Text>
                  {doneProducers.map(c => (
                    <ContributorLine
                      key={`p:${c.factoryId}`}
                      contributor={c}
                      kind="produced"
                    />
                  ))}
                </>
              )}
              {plannedProducers.length > 0 && (
                <>
                  <Text size="sm" c="dimmed" fw={500}>
                    Producers (Planned)
                  </Text>
                  {plannedProducers.map(c => (
                    <ContributorLine
                      key={`p:${c.factoryId}`}
                      contributor={c}
                      kind="produced"
                    />
                  ))}
                </>
              )}
            </Stack>
          )}
          {row.consumers.length > 0 && (
            <Stack gap={4}>
              {doneConsumers.length > 0 && (
                <>
                  <Text size="sm" c="dimmed" fw={500}>
                    Consumers (Done)
                  </Text>
                  {doneConsumers.map(c => (
                    <ContributorLine
                      key={`c:${c.factoryId}`}
                      contributor={c}
                      kind="consumed"
                    />
                  ))}
                </>
              )}
              {plannedConsumers.length > 0 && (
                <>
                  <Text size="sm" c="dimmed" fw={500}>
                    Consumers (Planned)
                  </Text>
                  {plannedConsumers.map(c => (
                    <ContributorLine
                      key={`c:${c.factoryId}`}
                      contributor={c}
                      kind="consumed"
                    />
                  ))}
                </>
              )}
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
  const isPlanned = contributor.status === 'planned';
  const amountColor = isPlanned
    ? 'yellow.4'
    : kind === 'produced'
      ? 'teal.4'
      : 'red.4';
  return (
    <Group justify="space-between" wrap="nowrap">
      <Anchor
        component={Link}
        to={`/factories/${contributor.factoryId}`}
        size="sm"
        c={isPlanned ? 'dimmed' : undefined}
      >
        {name}
      </Anchor>
      <Text size="sm" c={amountColor}>
        {kind === 'produced' ? '+' : '-'}
        {formatRate(contributor.amount)}
      </Text>
    </Group>
  );
}
