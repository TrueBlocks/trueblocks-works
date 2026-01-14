import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getEntityPageURL, toggleEntityPageTab } from '../navigation';
import { GetTab, GetAppState } from '@app';

vi.mock('@app', () => ({
  GetTab: vi.fn(),
  GetAppState: vi.fn(),
}));

describe('getEntityPageURL', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns base path when saved tab is list', async () => {
    vi.mocked(GetTab).mockResolvedValue('list');

    const url = await getEntityPageURL('works');

    expect(url).toBe('/works');
    expect(GetAppState).not.toHaveBeenCalled();
  });

  it('returns base path when saved tab is empty', async () => {
    vi.mocked(GetTab).mockResolvedValue('');

    const url = await getEntityPageURL('organizations');

    expect(url).toBe('/organizations');
    expect(GetAppState).not.toHaveBeenCalled();
  });

  it('returns detail path when saved tab is detail and ID exists', async () => {
    vi.mocked(GetTab).mockResolvedValue('detail');
    vi.mocked(GetAppState).mockResolvedValue({
      lastWorkID: 123,
    });

    const url = await getEntityPageURL('works');

    expect(url).toBe('/works/123');
  });

  it('returns base path when saved tab is detail but ID is missing', async () => {
    vi.mocked(GetTab).mockResolvedValue('detail');
    vi.mocked(GetAppState).mockResolvedValue({});

    const url = await getEntityPageURL('collections');

    expect(url).toBe('/collections');
  });

  it('returns base path when saved tab is detail but ID is zero', async () => {
    vi.mocked(GetTab).mockResolvedValue('detail');
    vi.mocked(GetAppState).mockResolvedValue({
      lastOrgID: 0,
    });

    const url = await getEntityPageURL('organizations');

    expect(url).toBe('/organizations');
  });

  it('handles all entity page types correctly', async () => {
    vi.mocked(GetTab).mockResolvedValue('detail');
    vi.mocked(GetAppState).mockResolvedValue({
      lastWorkID: 1,
      lastCollectionID: 2,
      lastOrgID: 3,
      lastSubmissionID: 4,
    });

    expect(await getEntityPageURL('works')).toBe('/works/1');
    expect(await getEntityPageURL('collections')).toBe('/collections/2');
    expect(await getEntityPageURL('organizations')).toBe('/organizations/3');
    expect(await getEntityPageURL('submissions')).toBe('/submissions/4');
  });
});

describe('toggleEntityPageTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('toggles from detail to list', async () => {
    vi.mocked(GetTab).mockResolvedValue('detail');

    const url = await toggleEntityPageTab('works');

    expect(url).toBe('/works');
    expect(GetAppState).not.toHaveBeenCalled();
  });

  it('toggles from list to detail when ID exists', async () => {
    vi.mocked(GetTab).mockResolvedValue('list');
    vi.mocked(GetAppState).mockResolvedValue({
      lastWorkID: 456,
    });

    const url = await toggleEntityPageTab('works');

    expect(url).toBe('/works/456');
  });

  it('toggles from empty to detail when ID exists', async () => {
    vi.mocked(GetTab).mockResolvedValue('');
    vi.mocked(GetAppState).mockResolvedValue({
      lastOrgID: 789,
    });

    const url = await toggleEntityPageTab('organizations');

    expect(url).toBe('/organizations/789');
  });

  it('returns list when toggling from list but no ID available', async () => {
    vi.mocked(GetTab).mockResolvedValue('list');
    vi.mocked(GetAppState).mockResolvedValue({});

    const url = await toggleEntityPageTab('collections');

    expect(url).toBe('/collections');
  });

  it('handles all entity types correctly', async () => {
    vi.mocked(GetTab).mockResolvedValue('list');
    vi.mocked(GetAppState).mockResolvedValue({
      lastWorkID: 10,
      lastCollectionID: 20,
      lastOrgID: 30,
      lastSubmissionID: 40,
    });

    expect(await toggleEntityPageTab('works')).toBe('/works/10');
    expect(await toggleEntityPageTab('collections')).toBe('/collections/20');
    expect(await toggleEntityPageTab('organizations')).toBe('/organizations/30');
    expect(await toggleEntityPageTab('submissions')).toBe('/submissions/40');
  });
});
