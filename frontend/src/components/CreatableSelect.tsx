import { useState } from 'react';
import { Combobox, InputBase, useCombobox } from '@mantine/core';

interface CreatableSelectProps {
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
  });

  const [search, setSearch] = useState(value || '');

  const exactOptionMatch = data.some((item) => item.toLowerCase() === search.toLowerCase());
  const filteredOptions = exactOptionMatch
    ? data
    : data.filter((item) => item.toLowerCase().includes(search.toLowerCase().trim()));

  const options = filteredOptions.map((item) => (
    <Combobox.Option value={item} key={item}>
      {item}
    </Combobox.Option>
  ));

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
          placeholder={placeholder}
          rightSectionPointerEvents="none"
          disabled={disabled}
          size={size}
          w={w}
          styles={styles}
        />
      </Combobox.Target>

      <Combobox.Dropdown>
        <Combobox.Options mah={200} style={{ overflowY: 'auto' }}>
          {options}
          {!exactOptionMatch && search.trim().length > 0 && (
            <Combobox.Option value="$create">+ Create &ldquo;{search}&rdquo;</Combobox.Option>
          )}
        </Combobox.Options>
      </Combobox.Dropdown>
    </Combobox>
  );
}
