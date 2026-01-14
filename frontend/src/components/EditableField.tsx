import { useState, useRef, useEffect } from 'react';
import { TextInput, Text, Box, MantineSize } from '@mantine/core';

interface EditableFieldProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  autoFocus?: boolean;
  size?: MantineSize;
}

export function EditableField({
  value,
  onChange,
  placeholder,
  label,
  autoFocus,
  size = 'lg',
}: EditableFieldProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [localValue, setLocalValue] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  useEffect(() => {
    if (autoFocus && boxRef.current && !isEditing) {
      boxRef.current.focus();
    }
  }, [autoFocus, isEditing]);

  const handleBlur = () => {
    setIsEditing(false);
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
      setIsEditing(false);
    }
  };

  const handleBoxKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setIsEditing(true);
    } else if (e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) {
      e.preventDefault();
      setLocalValue(e.key);
      setIsEditing(true);
    }
  };

  if (isEditing) {
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
          size={size}
        />
      </Box>
    );
  }

  return (
    <Box
      ref={boxRef}
      onClick={() => setIsEditing(true)}
      onKeyDown={handleBoxKeyDown}
      tabIndex={0}
      style={{
        cursor: 'pointer',
      }}
    >
      {label && (
        <Text size="sm" fw={500} mb={4}>
          {label}
        </Text>
      )}
      <Text size={size} c={value ? undefined : 'dimmed'}>
        {value || placeholder || 'Click to edit'}
      </Text>
    </Box>
  );
}
