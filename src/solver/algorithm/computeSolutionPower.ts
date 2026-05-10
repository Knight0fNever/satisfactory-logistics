import type { Node } from '@xyflow/react';
import type { IMachineNodeData } from '@/solver/layout/nodes/machine-node/MachineNode';
import { calculateMachineNodeBuildings } from '@/solver/layout/nodes/machine-node/postprocess/calculateMachineNodeBuildings';
import type { ISolverSolution } from '@/solver/page/ISolverSolution';

export interface SolutionPower {
  min: number;
  max: number;
  hasVariable: boolean;
}

export function computeSolutionPower(solution: ISolverSolution): SolutionPower {
  const machineNodes = solution.nodes.filter(
    (node): node is Node<IMachineNodeData, 'Machine'> =>
      node.type === 'Machine',
  );

  let min = 0;
  let max = 0;
  let hasVariable = false;

  for (const node of machineNodes) {
    const calc = calculateMachineNodeBuildings(
      node.data,
      solution.context.request.nodes?.[node.id],
    );
    const { building, overclock, boostedBuildings, roundedBuildingsAmount } =
      calc;
    const normalBuildings = roundedBuildingsAmount - boostedBuildings;

    const minBase = building.minimumPowerConsumption;
    const maxBase = building.maximumPowerConsumption;
    const isVariable =
      minBase != null && maxBase != null && minBase !== maxBase;

    if (isVariable) {
      hasVariable = true;
      const ocNormal = overclock ** building.powerConsumptionExponent;
      const ocBoosted =
        overclock ** building.somersloopPowerConsumptionExponent;
      min +=
        normalBuildings * minBase * ocNormal +
        boostedBuildings * minBase * ocBoosted;
      max +=
        normalBuildings * maxBase * ocNormal +
        boostedBuildings * maxBase * ocBoosted;
    } else {
      min += calc.totalPower;
      max += calc.totalPower;
    }
  }

  return { min, max, hasVariable };
}
