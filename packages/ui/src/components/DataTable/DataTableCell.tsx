import { useRef, memo, useLayoutEffect } from 'react';
import { Table } from '@mantine/core';
import './DataTableCell.css';

export interface DataTableCellProps {
  content: React.ReactNode;
  isSelected: boolean;
  cellKey: string;
  scrollOnSelect?: boolean;
}

function DataTableCellInner({ content, isSelected, cellKey, scrollOnSelect }: DataTableCellProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!scrollOnSelect) return;

    const container = containerRef.current;
    const contentEl = contentRef.current;

    if (!container || !contentEl) return;

    if (!isSelected) {
      contentEl.classList.remove('animating');
      contentEl.style.removeProperty('--scroll-distance');
      contentEl.style.removeProperty('--scroll-duration');
      return;
    }

    const overflow = contentEl.scrollWidth - container.clientWidth;

    if (overflow > 0) {
      const duration = Math.max(2, overflow / 50);
      contentEl.style.setProperty('--scroll-distance', `-${overflow}px`);
      contentEl.style.setProperty('--scroll-duration', `${duration}s`);
      contentEl.classList.add('animating');
    } else {
      contentEl.classList.remove('animating');
      contentEl.style.removeProperty('--scroll-distance');
      contentEl.style.removeProperty('--scroll-duration');
    }
  }, [isSelected, scrollOnSelect, content]);

  if (!scrollOnSelect) {
    return <Table.Td key={cellKey}>{content}</Table.Td>;
  }

  return (
    <Table.Td key={cellKey}>
      <div ref={containerRef} className="data-table-cell-container">
        <div ref={contentRef} className="data-table-cell-content">
          {content}
        </div>
      </div>
    </Table.Td>
  );
}

export const DataTableCell = memo(DataTableCellInner);
