import { render, screen, waitFor } from '@testing-library/react';
import { VaultProvider, useVault } from './VaultContext';
import { getSeriesDetails } from '../services/seriesService';
import { bulkUpdateVaultItems } from '../services/firestoreService';

let mockItems = [];
let mockUser = { uid: 'viewer-a' };
let mockDelaySnapshot = false;
jest.mock('./AuthContext', () => ({ useAuth: () => ({ currentUser: mockUser }) }));
jest.mock('../services/firebase', () => ({ db: {} }));
jest.mock('../services/seriesService', () => ({ getSeriesDetails: jest.fn() }));
jest.mock('../services/firestoreService', () => ({ bulkUpdateVaultItems: jest.fn() }));
jest.mock('firebase/firestore', () => ({ collection: jest.fn(), query: jest.fn(), where: jest.fn(), onSnapshot: (query, callback) => {
    if (!mockDelaySnapshot) callback({ forEach: visit => mockItems.forEach(item => visit({ id: item.id, data: () => item })) });
    return () => {};
} }));
function Consumer() { const { totalItems, vaultItems } = useVault(); return <><p>{totalItems} saved titles</p>{vaultItems.map(item => <p key={item.id}>{item.title}</p>)}</>; }

beforeEach(() => { mockUser = { uid: 'viewer-a' }; mockDelaySnapshot = false; jest.clearAllMocks(); });

test('already saved watching and completed TV shows have invalid season progress corrected', async () => {
    // Keep a stable auth object so subscription effects only rerun on real account changes.
    mockItems = [{ id: 'watching', tmdbId: 101, type: 'tv', title: 'Watching', status: 'Watching', season: 2, episode: 0 }, { id: 'completed', tmdbId: 102, type: 'tv', title: 'Completed', status: 'Completed', season: 4, episode: 9 }];
    getSeriesDetails.mockResolvedValue({ seasons: [{ season_number: 1, episode_count: 3 }, { season_number: 2, episode_count: 0 }] });
    bulkUpdateVaultItems.mockResolvedValue({ success: true });
    render(<VaultProvider><Consumer /></VaultProvider>);
    expect(await screen.findByText('2 saved titles')).toBeInTheDocument();
    await waitFor(() => expect(bulkUpdateVaultItems).toHaveBeenCalledWith([
        { id: 'watching', data: { season: 1, episode: 3, hasEpisodes: true, status: 'Completed' } },
        { id: 'completed', data: { season: 1, episode: 3, hasEpisodes: true } }
    ]));
});

test('manual Watching survives progress repair while an episode update restores automatic completion', async () => {
    mockItems = [
        { id: 'manual', tmdbId: 101, type: 'tv', title: 'Manual choice', status: 'Watching', manualStatus: true, season: 2, episode: 0 },
        { id: 'progress-updated', tmdbId: 102, type: 'tv', title: 'Progress updated', status: 'Watching', manualStatus: false, season: 2, episode: 0 }
    ];
    getSeriesDetails.mockResolvedValue({ seasons: [{ season_number: 1, episode_count: 3 }, { season_number: 2, episode_count: 0 }] });
    bulkUpdateVaultItems.mockResolvedValue({ success: true });
    render(<VaultProvider><Consumer /></VaultProvider>);
    await waitFor(() => expect(bulkUpdateVaultItems).toHaveBeenCalledWith([
        { id: 'manual', data: { season: 1, episode: 3, hasEpisodes: true } },
        { id: 'progress-updated', data: { season: 1, episode: 3, hasEpisodes: true, status: 'Completed' } }
    ]));
});

test('switching accounts immediately hides the previous vault while the new subscription loads', async () => {
    mockItems = [{ id: 'private-a', tmdbId: 1, type: 'movie', title: 'Private title from viewer A' }];
    const { rerender } = render(<VaultProvider><Consumer /></VaultProvider>);
    await screen.findByText('Private title from viewer A');
    mockDelaySnapshot = true;
    mockUser = { uid: 'viewer-b' };
    rerender(<VaultProvider><Consumer /></VaultProvider>);
    expect(screen.queryByText('Private title from viewer A')).not.toBeInTheDocument();
    expect(screen.getByText('0 saved titles')).toBeInTheDocument();
});
