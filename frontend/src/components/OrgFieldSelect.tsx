import { useState, useEffect } from 'react';
import { GetDistinctValues, UpdateOrganization } from '@app';
import { models } from '@models';
import { LogErr } from '@/utils';
import { hashColor } from '@trueblocks/ui';
import { CreatableSelect } from '@trueblocks/ui';

type OrgField = 'status' | 'type' | 'myInterest';

const fieldToColumn: Record<OrgField, string> = {
  status: 'status',
  type: 'type',
  myInterest: 'my_interest',
};

interface OrgFieldSelectProps {
  org: models.Organization;
  field: OrgField;
  colorMap?: Record<string, string>;
  width?: number;
  onUpdate?: (org: models.Organization) => void;
}

export function OrgFieldSelect({
  org,
  field,
  colorMap,
  width = 120,
  onUpdate,
}: OrgFieldSelectProps) {
  const [options, setOptions] = useState<string[]>([]);
  const [value, setValue] = useState<string | null>(org[field] || null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const column = fieldToColumn[field];
    GetDistinctValues('Organizations', column)
      .then((values) => setOptions(values || []))
      .catch((err) => LogErr(`Failed to load ${field} options:`, err));
  }, [field]);

  useEffect(() => {
    setValue(org[field] || null);
  }, [org, field]);

  const handleChange = async (newValue: string) => {
    if (!newValue || newValue === org[field]) return;

    setLoading(true);
    setValue(newValue);
    try {
      const updated = { ...org, [field]: newValue };
      await UpdateOrganization(updated as models.Organization);
      onUpdate?.(updated as models.Organization);
    } catch (err) {
      LogErr(`Failed to update ${field}:`, err);
      setValue(org[field] || null);
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
