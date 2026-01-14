import { models } from '@models';
import { WorkFieldSelect } from './WorkFieldSelect';

interface YearSelectProps {
  work: models.Work;
  onUpdate?: (work: models.Work) => void;
}

export function YearSelect({ work, onUpdate }: YearSelectProps) {
  return (
    <WorkFieldSelect
      work={work}
      field="year"
      enumListKey="yearList"
      width={80}
      onUpdate={onUpdate}
    />
  );
}
