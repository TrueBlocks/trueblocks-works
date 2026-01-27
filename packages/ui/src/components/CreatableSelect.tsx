import { useState, useEffect, useRef } from 'react';
import { Combobox, InputBase, useCombobox } from '@mantine/core';

export interface CreatableSelectProps {
  data: string[];
  value: string | null;
  onChange: (value: string) => void;
  disabled?: boolean;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  w?: number | string;
  placeholder?: string;
  styles?: Record<string, React.CSSProperties>;
}

export function CreatableSelect({
  data,
  value,
  onChange,
  disabled = false,
  size = 'xs',
  w,
  placeholder,
  styles,
}: CreatableSelectProps) {
  const combobox = useCombobox({
    onDropdownClose: () => combobox.resetSelectedOption(),
    onDropdownOpen: () => {
      setSearch(value || '');
      combobox.selectFirstOption();
    },
  });

  const [search, setSearch] = useState(value || '');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setSearch(value || '');
  }, [value]);

  const filteredOptions = data.filter((item) =>
    item.toLowerCase().includes(search.toLowerCase().trim())
  );

  const options = filteredOptions.map((item) => (
    <Combobox.Option value={item} key={item}>
      {item}
    </Combobox.Option>
  ));

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      if (filteredOptions.length === 1) {
        const option = filteredOptions[0] as string;
        onChange(option);
        setSearch(option);
        combobox.closeDropdown();
      } else if (filteredOptions.length > 1) {
        combobox.selectFirstOption();
      }
    }
  };

  const exactMatch = data.some((item) => item.toLowerCase() === search.toLowerCase().trim());

  return (
    <Combobox
      store={combobox}
      withinPortal={false}
      onOptionSubmit={(val) => {
        if (val === '$create') {
          onChange(search);
        } else {
          onChange(val);
          setSearch(val);
        }
        combobox.closeDropdown();
      }}
    >
      <Combobox.Target>
        <InputBase
          ref={inputRef}
          rightSection={<Combobox.Chevron />}
          value={search}
          onChange={(event) => {
            combobox.openDropdown();
            combobox.updateSelectedOptionIndex();
            setSearch(event.currentTarget.value);
          }}
          onClick={() => combobox.openDropdown()}
          onFocus={() => combobox.openDropdown()}
          onBlur={() => {
            combobox.closeDropdown();
            setSearch(value || '');
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          rightSectionPointerEvents="none"
          disabled={disabled}
          size={size}
          w={w}
          {...(styles && { styles })}
        />
      </Combobox.Target>

      <Combobox.Dropdown>
        <Combobox.Options mah={200} style={{ overflowY: 'auto' }}>
          {options}
          {!exactMatch && search.trim().length > 0 && (
            <Combobox.Option value="$create">+ Create &ldquo;{search}&rdquo;</Combobox.Option>
          )}
        </Combobox.Options>
      </Combobox.Dropdown>
    </Combobox>
  );
}
