import { Group, Text, Tooltip } from '@mantine/core';
import { IconBolt } from '@tabler/icons-react';
import { formatRepeatingNumber } from '@/core/intl/NumberFormatter';
import { useTotalGamePower } from '@/factories/store/factoriesSelectors';

export interface TotalGamePowerBadgeProps {
  size?: 'sm' | 'md' | 'lg';
  showCounts?: boolean;
}

export function TotalGamePowerBadge({
  size = 'sm',
  showCounts = false,
}: TotalGamePowerBadgeProps) {
  const total = useTotalGamePower();

  if (total.countedCount === 0 && total.missingCount === 0) return null;

  const value = total.hasVariable
    ? `${formatRepeatingNumber(total.min)}-${formatRepeatingNumber(total.max)} MW`
    : `${formatRepeatingNumber(total.max)} MW`;

  const tooltip =
    total.missingCount > 0
      ? `${total.countedCount} factory power total${
          total.countedCount === 1 ? '' : 's'
        } counted, ${total.missingCount} pending calculation`
      : `${total.countedCount} factor${total.countedCount === 1 ? 'y' : 'ies'} counted`;

  return (
    <Tooltip label={tooltip} position="bottom" withArrow>
      <Group
        gap={4}
        wrap="nowrap"
        data-tutorial-id="total-game-power"
        c={total.countedCount > 0 ? undefined : 'dimmed'}
      >
        <IconBolt size={size === 'lg' ? 20 : 16} stroke={1.6} />
        <Text size={size}>
          Total: {value}
          {showCounts && total.missingCount > 0 ? (
            <Text component="span" size="xs" c="dimmed" ml={6}>
              ({total.missingCount} pending)
            </Text>
          ) : null}
        </Text>
      </Group>
    </Tooltip>
  );
}
