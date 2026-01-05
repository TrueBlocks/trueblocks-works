import { useState, useRef, useEffect } from 'react';
import { TextInput, Text, Box } from '@mantine/core';

interface EditableFieldProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
}

export function EditableField({ value, onChange, placeholder, label }: EditableFieldProps) {
  const [isFocused, setIsFocused] = useState(false);
  const [localValue, setLocalValue] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  useEffect(() => {
    if (isFocused && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isFocused]);

  const handleBlur = () => {
    setIsFocused(false);
    if (localValue !== value) {
      onChange(localValue);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleBlur();
    }
    if (e.key === 'Escape') {
      setLocalValue(value);
      setIsFocused(false);
    }
  };

  if (isFocused) {
    return (
      <Box>
        {label && (
          <Text size="sm" fw={500} mb={4}>
            {label}
          </Text>
        )}
        <TextInput
          ref={inputRef}
          value={localValue}
          onChange={(e) => setLocalValue(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          styles={{
            input: {
              backgroundColor: 'var(--mantine-color-violet-1)',
            },
          }}
        />
      </Box>
    );
  }

  return (
    <Box
      onClick={() => setIsFocused(true)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          setIsFocused(true);
        }
      }}
      tabIndex={0}
      style={{
        cursor: 'pointer',
        backgroundColor: 'var(--mantine-color-blue-1)',
        padding: '8px 12px',
        borderRadius: 'var(--mantine-radius-sm)',
        minHeight: 36,
      }}
    >
      {label && (
        <Text size="sm" fw={500} mb={4}>
          {label}
        </Text>
      )}
      <Text size="sm" c={value ? undefined : 'dimmed'}>
        {value || placeholder || 'Click to edit'}
      </Text>
    </Box>
  );
}
