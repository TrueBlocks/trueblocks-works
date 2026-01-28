import { useState, useEffect } from 'react';
import { GetEnumLists, UpdateWork } from '@app';
import { models } from '@models';
import { LogErr, showValidationResult } from '@/utils';
import { hashColor } from '@trueblocks/ui';
import { CreatableSelect } from '@trueblocks/ui';

type WorkField = 'status' | 'type' | 'quality' | 'year';

interface WorkFieldSelectProps {
  work: models.Work;
  field: WorkField;
  enumListKey: 'statusList' | 'workTypeList' | 'qualityList' | 'yearList';
  colorMap?: Record<string, string>;
  width?: number;
  onUpdate?: (work: models.Work) => void;
}

export function WorkFieldSelect({
  work,
  field,
  enumListKey,
  colorMap,
  width = 120,
  onUpdate,
}: WorkFieldSelectProps) {
  const [options, setOptions] = useState<string[]>([]);
  const [value, setValue] = useState<string | null>(work[field] ?? null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    GetEnumLists()
      .then((lists) => setOptions(lists[enumListKey] || []))
      .catch((err) => LogErr(`Failed to load ${field} options:`, err));
  }, [enumListKey, field]);

  useEffect(() => {
    setValue(work[field] ?? null);
  }, [work, field]);

  const handleChange = async (newValue: string) => {
    if (!newValue || newValue === work[field]) return;

    setLoading(true);
    setValue(newValue);
    try {
      const updated = { ...work, [field]: newValue };
      const result = await UpdateWork(updated as models.Work);
      if (!showValidationResult(result)) {
        onUpdate?.(updated as models.Work);
      } else {
        setValue((work[field] as string) || null);
      }
    } catch (err) {
      LogErr(`Failed to update ${field}:`, err);
      setValue(work[field] ?? null);
    } finally {
      setLoading(false);
    }
  };

  const color = colorMap?.[value as string] ?? hashColor(value);

  return (
    <CreatableSelect
      data={options}
      value={value}
      onChange={handleChange}
      disabled={loading}
      size="xs"
      w={width}
      styles={{
        input: {
          backgroundColor: `var(--mantine-color-${color}-1)`,
          color: `var(--mantine-color-${color}-9)`,
          fontWeight: 500,
          border: `1px solid var(--mantine-color-${color}-3)`,
        },
      }}
    />
  );
}
