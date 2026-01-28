import { useState, useEffect } from 'react';
import { GetDistinctValues, UpdateCollection } from '@app';
import { models } from '@models';
import { LogErr, showValidationResult } from '@/utils';
import { hashColor } from '@trueblocks/ui';
import { CreatableSelect } from '@trueblocks/ui';

type CollectionField = 'type';

interface CollectionFieldSelectProps {
  collection: models.Collection;
  field: CollectionField;
  colorMap?: Record<string, string>;
  width?: number;
  onUpdate?: (collection: models.Collection) => void;
}

export function CollectionFieldSelect({
  collection,
  field,
  colorMap,
  width = 120,
  onUpdate,
}: CollectionFieldSelectProps) {
  const [options, setOptions] = useState<string[]>([]);
  const [value, setValue] = useState<string | null>(collection[field] || null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    GetDistinctValues('Collections', field)
      .then((values) => setOptions(values || []))
      .catch((err) => LogErr(`Failed to load ${field} options:`, err));
  }, [field]);

  useEffect(() => {
    setValue(collection[field] || null);
  }, [collection, field]);

  const handleChange = async (newValue: string) => {
    if (!newValue || newValue === collection[field]) return;

    setLoading(true);
    setValue(newValue);
    try {
      const updated = { ...collection, [field]: newValue };
      const result = await UpdateCollection(updated as models.Collection);
      if (!showValidationResult(result)) {
        onUpdate?.(updated as models.Collection);
      } else {
        setValue(collection.type || null);
      }
    } catch (err) {
      LogErr(`Failed to update ${field}:`, err);
      setValue(collection[field] || null);
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
