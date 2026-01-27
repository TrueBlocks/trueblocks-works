import { useState, useEffect } from 'react';
import { GetDistinctValues, UpdateSubmission } from '@app';
import { models } from '@models';
import { LogErr, hashColor, showValidationResult } from '@/utils';
import { CreatableSelect } from '@trueblocks/ui';

type SubmissionField = 'submissionType' | 'responseType';

const fieldToColumn: Record<SubmissionField, string> = {
  submissionType: 'submission_type',
  responseType: 'response_type',
};

interface SubmissionFieldSelectProps {
  submission: models.Submission;
  field: SubmissionField;
  colorMap?: Record<string, string>;
  width?: number;
  onUpdate?: (submission: models.Submission) => void;
}

export function SubmissionFieldSelect({
  submission,
  field,
  colorMap,
  width = 120,
  onUpdate,
}: SubmissionFieldSelectProps) {
  const [options, setOptions] = useState<string[]>([]);
  const [value, setValue] = useState<string | null>(submission[field] || null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const column = fieldToColumn[field];
    GetDistinctValues('Submissions', column)
      .then((values) => setOptions(values || []))
      .catch((err) => LogErr(`Failed to load ${field} options:`, err));
  }, [field]);

  useEffect(() => {
    setValue(submission[field] || null);
  }, [submission, field]);

  const handleChange = async (newValue: string) => {
    if (!newValue || newValue === submission[field]) return;

    setLoading(true);
    setValue(newValue);
    try {
      const updated = { ...submission, [field]: newValue };
      const result = await UpdateSubmission(updated as models.Submission);
      if (!showValidationResult(result)) {
        onUpdate?.(updated as models.Submission);
      } else {
        setValue((submission[field] as string) || null);
      }
    } catch (err) {
      LogErr(`Failed to update ${field}:`, err);
      setValue(submission[field] || null);
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
