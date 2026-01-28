import { useState, useEffect } from 'react';
import { CreatableSelect } from './CreatableSelect';
import { hashColor } from '../utils/hashColor';

export interface EntityFieldSelectProps<T extends object> {
  entity: T;
  field: keyof T & string;
  loadOptions: () => Promise<string[]>;
  updateEntity: (entity: T) => Promise<{ hasErrors: boolean } | void>;
  colorMap?: Record<string, string>;
  width?: number;
  onUpdate?: (entity: T) => void;
  onError?: (error: unknown, field: string) => void;
}

export function EntityFieldSelect<T extends object>({
  entity,
  field,
  loadOptions,
  updateEntity,
  colorMap,
  width = 120,
  onUpdate,
  onError,
}: EntityFieldSelectProps<T>) {
  const [options, setOptions] = useState<string[]>([]);
  const [value, setValue] = useState<string | null>((entity[field] as string) || null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadOptions()
      .then((values) => setOptions(values || []))
      .catch((err) => onError?.(err, field));
  }, [loadOptions, field, onError]);

  useEffect(() => {
    setValue((entity[field] as string) || null);
  }, [entity, field]);

  const handleChange = async (newValue: string) => {
    const currentValue = entity[field] as string;
    if (!newValue || newValue === currentValue) return;

    setLoading(true);
    setValue(newValue);
    try {
      const updated = { ...entity, [field]: newValue } as T;
      const result = await updateEntity(updated);
      if (result?.hasErrors) {
        setValue(currentValue || null);
      } else {
        onUpdate?.(updated);
      }
    } catch (err) {
      onError?.(err, field);
      setValue(currentValue || null);
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
