import { Button, Group, SegmentedControl, Text, Title } from '@mantine/core';
import { IconArrowLeft, IconBolt } from '@tabler/icons-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { formatFactoryPower } from '@/factories/components/formatPower';
import { FactoryDeleteButton } from '@/factories/details/FactoryDeleteButton';
import { FactoryGraph } from '@/factories/details/FactoryGraph';
import { ProductionView } from '@/factories/details/ProductionView';
import { FactoryActionsMenu } from '@/factories/list/FactoryActionsMenu';
import { useFactorySimpleAttributes } from '@/factories/store/factoriesSelectors';
import { usePowerForFactory } from '@/factories/usePowerForFactory';
import { AfterHeaderSticky } from '@/layout/AfterHeaderSticky';
import { FullHeightContainer } from '@/layout/FullHeightContainer';

export const FactoryPage = ({
  currentView,
}: {
  currentView: 'calculator' | 'overview';
}) => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  if (!id) {
    throw new Error('Factory ID is required in route params');
  }

  const factory = useFactorySimpleAttributes(id);
  const powerView = usePowerForFactory(id);

  return (
    <>
      <AfterHeaderSticky>
        <Group gap="sm" justify="space-between">
          <Group gap="sm">
            <Button
              data-tutorial-id="back-to-factories"
              component={Link}
              to="/factories"
              variant="light"
              color="gray"
              leftSection={<IconArrowLeft size={16} />}
            >
              All Factories
            </Button>
            <Title order={4}>{factory.name}</Title>
            <Group
              gap={4}
              wrap="nowrap"
              data-tutorial-id="factory-header-power"
              c={powerView.power ? undefined : 'dimmed'}
              ref={powerView.ref}
            >
              <IconBolt size={16} stroke={1.6} />
              <Text size="sm">
                {powerView.hasSolver
                  ? (formatFactoryPower(powerView.power, {
                      hideWhenMissing: true,
                    }) ?? (powerView.loading ? 'Calculating...' : '-'))
                  : '- (no solver)'}
              </Text>
            </Group>
          </Group>
          <Group gap="sm">
            <SegmentedControl
              data-tutorial-id="factory-view-switcher"
              radius="md"
              data={[
                { value: 'overview', label: 'Overview' },
                { value: 'calculator', label: 'Calculator' },
              ]}
              value={currentView}
              onChange={val => {
                if (val === 'calculator' && currentView === 'overview') {
                  navigate(`/factories/${id}/calculator`);
                }
                if (val === 'overview' && currentView === 'calculator') {
                  navigate(`/factories/${id}`);
                }
              }}
            />
            <FactoryActionsMenu factoryId={id} hideDelete />
            <FactoryDeleteButton id={id} />
          </Group>
        </Group>
      </AfterHeaderSticky>
      {currentView === 'overview' && <ProductionView id={id} />}
      {currentView === 'calculator' && (
        <FullHeightContainer>
          <FactoryGraph id={id} />
        </FullHeightContainer>
      )}
    </>
  );
};
