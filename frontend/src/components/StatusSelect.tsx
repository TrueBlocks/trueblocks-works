import { models } from '@models';
import { workStatusColors } from '@/types';
import { WorkFieldSelect } from './WorkFieldSelect';

interface StatusSelectProps {
  work: models.Work;
  onUpdate?: (work: models.Work) => void;
}

export function StatusSelect({ work, onUpdate }: StatusSelectProps) {
  return (
    <WorkFieldSelect
      work={work}
      field="status"
      enumListKey="statusList"
      colorMap={workStatusColors}
      width={120}
      onUpdate={onUpdate}
    />
  );
}
