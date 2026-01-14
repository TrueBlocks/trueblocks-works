import { models } from '@models';
import { qualityColors } from '@/types';
import { WorkFieldSelect } from './WorkFieldSelect';

interface QualitySelectProps {
  work: models.Work;
  onUpdate?: (work: models.Work) => void;
}

export function QualitySelect({ work, onUpdate }: QualitySelectProps) {
  return (
    <WorkFieldSelect
      work={work}
      field="quality"
      enumListKey="qualityList"
      colorMap={qualityColors}
      width={100}
      onUpdate={onUpdate}
    />
  );
}
