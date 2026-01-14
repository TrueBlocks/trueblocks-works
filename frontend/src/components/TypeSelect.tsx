import { models } from '@models';
import { WorkFieldSelect } from './WorkFieldSelect';

interface TypeSelectProps {
  work: models.Work;
  onUpdate?: (work: models.Work) => void;
}

export function TypeSelect({ work, onUpdate }: TypeSelectProps) {
  return (
    <WorkFieldSelect
      work={work}
      field="type"
      enumListKey="workTypeList"
      width={120}
      onUpdate={onUpdate}
    />
  );
}
