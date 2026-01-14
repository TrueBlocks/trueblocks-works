import { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Box,
  Text,
  Group,
  Badge,
  Stack,
  Select,
  Checkbox,
  Table,
  ScrollArea,
  Paper,
} from '@mantine/core';
import { IconCheck, IconX, IconPencil, IconMicrophone, IconPrinter } from '@tabler/icons-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { collections, works } from '../data';
import { Work, StatusType, QualityType } from '../types';

// Filter cycle order for ⌘1 repeated presses
const FILTER_CYCLE = ['all', 'active', 'process', 'other', 'books', 'dead'] as const;
type FilterKey = typeof FILTER_CYCLE[number];

// Status colors matching FileMaker conditional formatting
const statusColors: Record<StatusType, { bg: string; text: string }> = {
  Focus: { bg: 'rgb(0, 89, 125)', text: '#d0d0d0' },
  Active: { bg: 'rgb(33, 0, 99)', text: '#d0d0d0' },
  Working: { bg: 'rgb(99, 13, 46)', text: '#d0d0d0' },
  Out: { bg: 'rgb(255, 117, 112)', text: 'rgb(33, 0, 99)' },
  Sound: { bg: 'rgb(194, 230, 166)', text: 'rgb(33, 0, 99)' },
  Gestating: { bg: 'rgb(153, 184, 255)', text: 'rgb(33, 0, 99)' },
  Resting: { bg: 'rgb(156, 43, 0)', text: '#d0d0d0' },
  Waiting: { bg: 'rgb(173, 0, 240)', text: '#d0d0d0' },
  Sleeping: { bg: 'rgb(102, 0, 140)', text: '#d0d0d0' },
  Dying: { bg: 'rgb(148, 105, 0)', text: '#d0d0d0' },
  Dead: { bg: 'rgb(61, 69, 5)', text: '#d0d0d0' },
  Done: { bg: 'rgb(64, 105, 31)', text: '#d0d0d0' },
  Published: { bg: 'rgb(64, 105, 31)', text: '#d0d0d0' },
};

// Quality colors matching FileMaker
const qualityColors: Record<QualityType, { bg: string; text: string }> = {
  Best: { bg: 'rgb(156, 43, 0)', text: '#d0d0d0' },
  Better: { bg: 'rgb(252, 153, 0)', text: 'rgb(33, 0, 99)' },
  Good: { bg: 'rgb(102, 0, 140)', text: '#d0d0d0' },
  Okay: { bg: 'rgb(207, 186, 255)', text: 'rgb(33, 0, 99)' },
  Poor: { bg: 'rgb(0, 89, 125)', text: '#d0d0d0' },
  Bad: { bg: 'rgb(33, 0, 99)', text: '#d0d0d0' },
  Worst: { bg: 'rgb(99, 13, 46)', text: '#d0d0d0' },
  Unknown: { bg: '#888', text: '#fff' },
};

export function CollectionsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  
  // State for current collection and filters
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(
    collections[0]?.collectionID.toString() || null
  );
  const [selectedWorkId, setSelectedWorkId] = useState<number | null>(null);
  
  // Filter checkboxes matching FileMaker: all, active, process, other, books, dead
  // Only one filter active at a time (radio-button style, matching FileMaker behavior)
  const [activeFilter, setActiveFilter] = useState<FilterKey>('all');

  // Cycle to next filter (for ⌘1 when already on Collections)
  const cycleFilter = useCallback(() => {
    const currentIndex = FILTER_CYCLE.indexOf(activeFilter);
    const nextIndex = (currentIndex + 1) % FILTER_CYCLE.length;
    setActiveFilter(FILTER_CYCLE[nextIndex]);
  }, [activeFilter]);

  // Get current collection
  const currentCollection = collections.find(
    c => c.collectionID.toString() === selectedCollectionId
  );

  // Get works for current collection (filtered)
  const filteredWorks = useMemo(() => {
    if (!currentCollection) return [];
    
    let filtered = [...works];
    
    // Apply filter based on active filter
    if (activeFilter !== 'all') {
      filtered = filtered.filter(w => {
        switch (activeFilter) {
          case 'active':
            return ['Focus', 'Active', 'Working'].includes(w.status);
          case 'process':
            return ['Gestating', 'Sound', 'Resting'].includes(w.status);
          case 'other':
            return ['Waiting', 'Sleeping', 'Dying'].includes(w.status);
          case 'books':
            return w.type === 'Story';
          case 'dead':
            return ['Dead', 'Done', 'Published'].includes(w.status);
          default:
            return true;
        }
      });
    }
    
    // Sort by Status, Quality, Type, Year (desc), Title
    return filtered.sort((a, b) => {
      const statusOrder = ['Focus', 'Active', 'Working', 'Out', 'Sound', 'Gestating', 'Resting', 'Waiting', 'Sleeping', 'Dying', 'Dead', 'Done', 'Published'];
      const qualityOrder = ['Best', 'Better', 'Good', 'Okay', 'Poor', 'Bad', 'Worst'];
      
      const statusDiff = statusOrder.indexOf(a.status) - statusOrder.indexOf(b.status);
      if (statusDiff !== 0) return statusDiff;
      
      const qualityDiff = qualityOrder.indexOf(a.quality) - qualityOrder.indexOf(b.quality);
      if (qualityDiff !== 0) return qualityDiff;
      
      if (a.type !== b.type) return a.type.localeCompare(b.type);
      if (a.year !== b.year) return b.year - a.year;
      return a.title.localeCompare(b.title);
    });
  }, [currentCollection, activeFilter]);

  const selectedWork = works.find(w => w.workID === selectedWorkId);

  // Keyboard navigation for works table AND filter cycling
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const isMeta = event.metaKey || event.ctrlKey;
      
      // ⌘1 when already on Collections: cycle filter
      if (isMeta && event.key === '1' && location.pathname === '/') {
        event.preventDefault();
        event.stopPropagation();
        cycleFilter();
        return;
      }
      
      // Skip other shortcuts if user is typing in an input field
      const target = event.target as HTMLElement;
      const isInputField = target.tagName === 'INPUT' || 
                           target.tagName === 'TEXTAREA' || 
                           target.tagName === 'SELECT' ||
                           target.isContentEditable;
      if (isInputField) return;

      const currentWorkIndex = filteredWorks.findIndex(w => w.workID === selectedWorkId);

      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault();
          if (currentWorkIndex < filteredWorks.length - 1) {
            setSelectedWorkId(filteredWorks[currentWorkIndex + 1].workID);
          } else if (currentWorkIndex === -1 && filteredWorks.length > 0) {
            setSelectedWorkId(filteredWorks[0].workID);
          }
          break;
        case 'ArrowUp':
          event.preventDefault();
          if (currentWorkIndex > 0) {
            setSelectedWorkId(filteredWorks[currentWorkIndex - 1].workID);
          }
          break;
        case 'Home':
          if (event.metaKey || event.shiftKey) {
            event.preventDefault();
            if (filteredWorks.length > 0) {
              setSelectedWorkId(filteredWorks[0].workID);
            }
          }
          break;
        case 'End':
          if (event.metaKey || event.shiftKey) {
            event.preventDefault();
            if (filteredWorks.length > 0) {
              setSelectedWorkId(filteredWorks[filteredWorks.length - 1].workID);
            }
          }
          break;
        case 'Enter':
          if (selectedWorkId) {
            navigate(`/works/${selectedWorkId}`);
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [filteredWorks, selectedWorkId, navigate, location.pathname, cycleFilter]);

  // Age-based coloring for workID (green if < 300 days old)
  const getWorkIdStyle = (work: Work) => {
    // Demo: assume works with ID > 1950 are "new"
    const isNew = work.workID > 1950;
    return isNew ? { backgroundColor: 'rgb(194, 230, 166)', color: 'rgb(64, 105, 31)', fontWeight: 700 } : {};
  };

  return (
    <Box style={{ display: 'flex', height: 'calc(100vh - 100px)', gap: '1rem' }}>
      {/* Left Panel: Collection Header + Works Portal */}
      <Stack style={{ flex: '0 0 60%', minWidth: 0 }} gap="xs">
        {/* Collection Header - matches FileMaker layout top section */}
        <Paper withBorder p="xs" bg="gray.0">
          <Group gap="md">
            <Group gap="xs">
              <Text size="xs" c="dimmed">ID:</Text>
              <Text size="sm" fw={600} style={{ minWidth: 40 }}>
                {currentCollection?.collectionID || '—'}
              </Text>
            </Group>
            
            <Select
              size="xs"
              placeholder="Select collection..."
              value={selectedCollectionId}
              onChange={setSelectedCollectionId}
              data={collections.map(c => ({
                value: c.collectionID.toString(),
                label: c.collectionName,
              }))}
              style={{ flex: 1, maxWidth: 400 }}
              searchable
            />
            
            <Group gap="xs">
              <Text size="xs" c="dimmed">Type:</Text>
              <Text size="sm">{currentCollection?.type || '—'}</Text>
            </Group>
            
            <Group gap="xs">
              <Text size="xs" c="dimmed">Items:</Text>
              <Badge variant="filled" color="blue" size="sm">
                {filteredWorks.length}
              </Badge>
            </Group>
          </Group>
        </Paper>

        {/* Filter Checkboxes - matches FileMaker gl_showAll, gl_showActive, etc. */}
        {/* ⌘1 cycles through these filters when on Collections page */}
        <Paper withBorder p="xs" bg="gray.1">
          <Group gap="lg">
            <Checkbox
              label="all"
              checked={activeFilter === 'all'}
              onChange={() => setActiveFilter('all')}
              size="xs"
            />
            <Checkbox
              label="active"
              checked={activeFilter === 'active'}
              onChange={() => setActiveFilter('active')}
              size="xs"
            />
            <Checkbox
              label="process"
              checked={activeFilter === 'process'}
              onChange={() => setActiveFilter('process')}
              size="xs"
            />
            <Checkbox
              label="other"
              checked={activeFilter === 'other'}
              onChange={() => setActiveFilter('other')}
              size="xs"
            />
            <Checkbox
              label="books"
              checked={activeFilter === 'books'}
              onChange={() => setActiveFilter('books')}
              size="xs"
            />
            <Checkbox
              label="dead"
              checked={activeFilter === 'dead'}
              onChange={() => setActiveFilter('dead')}
              size="xs"
            />
            <Text size="xs" c="dimmed" ml="auto">⌘1 cycles filters</Text>
          </Group>
        </Paper>

        {/* Works Portal - matches FileMaker portal structure */}
        <Paper withBorder style={{ flex: 1, overflow: 'hidden' }}>
          <ScrollArea h="100%">
            <Table 
              striped 
              highlightOnHover 
              withTableBorder 
              withColumnBorders
              stickyHeader
              style={{ fontSize: '12px' }}
            >
              <Table.Thead>
                <Table.Tr>
                  <Table.Th style={{ width: 30 }}>✓</Table.Th>
                  <Table.Th style={{ width: 50 }}>ID</Table.Th>
                  <Table.Th style={{ width: 60 }}>Type</Table.Th>
                  <Table.Th style={{ width: 45 }}>Year</Table.Th>
                  <Table.Th>Title</Table.Th>
                  <Table.Th style={{ width: 70 }}>Status</Table.Th>
                  <Table.Th style={{ width: 60 }}>Quality</Table.Th>
                  <Table.Th style={{ width: 20, textAlign: 'center' }} title="isRevised">R</Table.Th>
                  <Table.Th style={{ width: 20, textAlign: 'center' }} title="isBlog">B</Table.Th>
                  <Table.Th style={{ width: 20, textAlign: 'center' }} title="isPrinted">P</Table.Th>
                  <Table.Th style={{ width: 20, textAlign: 'center' }} title="hasSound">S</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {filteredWorks.map((work) => {
                  const statusStyle = statusColors[work.status] || { bg: '#fff', text: '#000' };
                  const qualityStyle = qualityColors[work.quality] || { bg: '#fff', text: '#000' };
                  const isSelected = work.workID === selectedWorkId;
                  
                  return (
                    <Table.Tr
                      key={work.workID}
                      onClick={() => setSelectedWorkId(work.workID)}
                      onDoubleClick={() => navigate(`/works/${work.workID}`)}
                      style={{
                        cursor: 'pointer',
                        backgroundColor: isSelected ? 'rgba(51, 154, 240, 0.15)' : undefined,
                      }}
                    >
                      <Table.Td style={{ textAlign: 'center' }}>
                        {work.path ? (
                          <IconCheck size={14} color="green" />
                        ) : (
                          <IconX size={14} color="red" />
                        )}
                      </Table.Td>
                      <Table.Td style={getWorkIdStyle(work)}>{work.workID}</Table.Td>
                      <Table.Td>{work.type}</Table.Td>
                      <Table.Td>{work.year}</Table.Td>
                      <Table.Td style={{ fontWeight: 500 }}>{work.title}</Table.Td>
                      <Table.Td style={{
                        backgroundColor: statusStyle.bg,
                        color: statusStyle.text,
                        fontWeight: 500,
                        textAlign: 'center',
                      }}>
                        {work.status}
                      </Table.Td>
                      <Table.Td style={{
                        backgroundColor: qualityStyle.bg,
                        color: qualityStyle.text,
                        fontWeight: 500,
                        textAlign: 'center',
                      }}>
                        {work.quality}
                      </Table.Td>
                      <Table.Td style={{ textAlign: 'center' }}>
                        {work.isRevised && <IconPencil size={12} />}
                      </Table.Td>
                      <Table.Td style={{ textAlign: 'center' }}>
                        {work.isBlog && <Text size="xs">✎</Text>}
                      </Table.Td>
                      <Table.Td style={{ textAlign: 'center' }}>
                        {work.isPrinted && <IconPrinter size={12} />}
                      </Table.Td>
                      <Table.Td style={{ textAlign: 'center' }}>
                        {work.hasSound && <IconMicrophone size={12} />}
                      </Table.Td>
                    </Table.Tr>
                  );
                })}
              </Table.Tbody>
            </Table>
          </ScrollArea>
        </Paper>
      </Stack>

      {/* Right Panel: PDF Preview (Web Viewer) */}
      <Paper
        withBorder
        style={{ flex: '0 0 38%', display: 'flex', flexDirection: 'column' }}
      >
        <Box p="xs" bg="gray.1" style={{ borderBottom: '1px solid #dee2e6' }}>
          <Text size="xs" c="dimmed">
            Preview: {selectedWork ? `${selectedWork.workID}.pdf` : 'Select a work'}
          </Text>
        </Box>
        <Box
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#f8f9fa',
          }}
        >
          {selectedWork ? (
            <Stack align="center" gap="xs">
              <Text size="lg" fw={500}>{selectedWork.title}</Text>
              <Text size="sm" c="dimmed">{selectedWork.type} • {selectedWork.year}</Text>
              <Box
                p="xl"
                style={{
                  backgroundColor: '#fff',
                  border: '1px solid #dee2e6',
                  borderRadius: 4,
                  width: '80%',
                  minHeight: 400,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text c="dimmed" size="sm" ta="center">
                  PDF Preview<br />
                  /Users/jrush/Sites/Works/{selectedWork.workID}.pdf
                </Text>
              </Box>
            </Stack>
          ) : (
            <Text c="dimmed">Select a work to preview</Text>
          )}
        </Box>
      </Paper>
    </Box>
  );
}

export default CollectionsPage;
