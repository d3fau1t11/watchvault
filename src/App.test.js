import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from './App';
import Home from './pages/Home';
import Vault from './pages/Vault';
import Login from './pages/Login';
import Shuffle from './pages/Shuffle';
import Categories from './pages/Categories';
import Recommendations from './pages/Recommendations';
import Stats from './pages/Stats';
import Profile from './pages/Profile';
import MediaModal from './components/MediaModal';
import Navbar from './components/Navbar';
import toast from 'react-hot-toast';
import * as api from './services/tmdbApi';
import * as anime from './services/anilistApi';
import * as storage from './services/firestoreService';
import { createVaultExport, importedCuration } from './utils/vaultTransfer';
import * as inbox from './services/notificationService';

const mockAuth = {
    currentUser: null, loginWithGoogle: jest.fn(), loginWithEmail: jest.fn(), signupWithEmail: jest.fn(),
    createPassword: jest.fn(),
    logout: jest.fn(), deleteAccount: jest.fn(), reauthenticate: jest.fn(), reauthenticateWithPassword: jest.fn()
};
let mockVaultItems = [];
let mockNotificationItems = {};
let mockNotificationSubscribers = new Map();
jest.mock('./services/notificationService', () => ({ subscribeNotifications: jest.fn(), checkUserNotifications: jest.fn(), markNotificationsRead: jest.fn(), deleteUserNotifications: jest.fn() }));
jest.mock('./context/AuthContext', () => ({ AuthProvider: ({ children }) => children, useAuth: () => mockAuth }));
jest.mock('./context/VaultContext', () => ({
    VaultProvider: ({ children }) => children,
    useVault: () => ({
        vaultItems: mockVaultItems, loading: false, error: null, totalItems: mockVaultItems.length,
        watchingCount: mockVaultItems.filter(item => item.status === 'Watching').length,
        completedCount: mockVaultItems.filter(item => item.status === 'Completed').length,
        planToWatchCount: mockVaultItems.filter(item => item.status === 'Plan to Watch').length,
        isInVault: id => mockVaultItems.some(item => item.tmdbId === id),
        getVaultItem: id => mockVaultItems.find(item => item.tmdbId === id),
        getWatchingItems: () => mockVaultItems.filter(item => item.status === 'Watching')
    })
}));
jest.mock('./services/tmdbApi', () => ({
    getTrending: jest.fn(), searchMedia: jest.fn(), getMediaDetails: jest.fn(), getTVDetailsWithAiring: jest.fn(),
    getSeasonDetails: jest.fn(), getPersonDetails: jest.fn(), getRecommendations: jest.fn(), getWatchProviders: jest.fn(),
    getMovieGenres: jest.fn(), getTVGenres: jest.fn(), discoverMedia: jest.fn(), getCollection: jest.fn()
}));
jest.mock('./services/anilistApi', () => ({
    searchAnime: jest.fn(), getTrendingAnime: jest.fn(), getAnimeById: jest.fn(),
    convertAnilistToTmdbFormat: item => ({ id: item.id, title: item.title.english, type: 'anime', media_type: 'tv', poster_path: '/anime.jpg', backdrop_path: '/banner.jpg', vote_average: 8, first_air_date: '2025-01-01' })
}));
jest.mock('./services/firestoreService', () => ({
    addToVault: jest.fn(), updateVaultItemProgress: jest.fn(), updateVaultItemStatus: jest.fn(),
    updateVaultItemDetails: jest.fn(), updateVaultItemType: jest.fn(), removeVaultItem: jest.fn(), clearVault: jest.fn()
}));
jest.mock('react-youtube', () => () => <div data-testid="trailer-player">Trailer player</div>);
jest.mock('react-hot-toast', () => ({ __esModule: true, Toaster: () => null, default: { loading: jest.fn(() => 'toast'), success: jest.fn(), error: jest.fn(), custom: jest.fn(), dismiss: jest.fn() } }));

const movie = { id: 101, title: 'The Last Horizon', media_type: 'movie', poster_path: '/movie.jpg', backdrop_path: '/backdrop.jpg', release_date: '2026-03-01', overview: 'A journey beyond the stars.', vote_average: 8.3 };
const show = { id: 102, name: 'City of Stories', media_type: 'tv', poster_path: '/show.jpg', backdrop_path: '/city.jpg', first_air_date: '2025-05-01', vote_average: 8.5 };
const recommendation = { ...movie, id: 301, title: 'Another Horizon' };
const savedMovie = { id: 'vault-movie', tmdbId: 101, title: movie.title, type: 'movie', poster: movie.poster_path, status: 'Plan to Watch', year: 2026, category: 'Sci-Fi', genres: ['Sci-Fi'], createdAt: { seconds: 100 } };
const savedShow = { id: 'vault-show', tmdbId: 102, title: show.name, type: 'tv', poster: show.poster_path, status: 'Watching', year: 2025, season: 1, episode: 1, rating: 8, category: 'Drama', genres: ['Drama'], createdAt: { seconds: 200 } };
const showDetails = {
    ...show, number_of_seasons: 1, number_of_episodes: 2, status: 'Ended',
    seasons: [{ season_number: 1, name: 'Season 1', episode_count: 2 }],
    genres: [{ id: 18, name: 'Drama' }], credits: { cast: [{ id: 501, name: 'Alex River', character: 'The Traveler' }] },
    recommendations: { results: [recommendation] }, videos: { results: [{ type: 'Trailer', site: 'YouTube', key: 'trailer' }] }
};
const signedIn = () => { mockAuth.currentUser = { uid: 'test-user', displayName: 'Test Viewer', email: 'viewer@example.test', providerData: [] }; };
const mount = (component, path = '/') => render(<MemoryRouter initialEntries={[path]}>{component}</MemoryRouter>);

beforeEach(() => {
    jest.clearAllMocks();
    mockAuth.currentUser = null;
    mockVaultItems = [];
    mockNotificationItems = {};
    mockNotificationSubscribers = new Map();
    inbox.subscribeNotifications.mockImplementation((uid, listener) => { mockNotificationSubscribers.set(uid, listener); listener(mockNotificationItems[uid] || []); return () => mockNotificationSubscribers.delete(uid); });
    inbox.checkUserNotifications.mockResolvedValue();
    inbox.markNotificationsRead.mockImplementation(async (uid, ids) => {
        mockNotificationItems[uid] = (mockNotificationItems[uid] || []).map(item => ids.includes(item.id) ? { ...item, read: true } : item);
        mockNotificationSubscribers.get(uid)?.(mockNotificationItems[uid]);
    });
    localStorage.clear();
    window.history.replaceState({}, '', '/');
    window.scrollTo = jest.fn();
    Element.prototype.scrollIntoView = jest.fn();
    api.getTrending.mockResolvedValue({ results: [movie, show], page: 1, total_pages: 2 });
    api.searchMedia.mockResolvedValue({ results: [movie, show], page: 1, total_pages: 1 });
    api.getMediaDetails.mockImplementation(async id => id === 102 ? showDetails : { ...movie, id, title: id === 301 ? recommendation.title : movie.title, credits: { cast: [] }, genres: [] });
    api.getTVDetailsWithAiring.mockResolvedValue(showDetails);
    api.getWatchProviders.mockResolvedValue({ results: { US: { flatrate: [{ provider_id: 1, provider_name: 'Stream Service', logo_path: '/provider.jpg' }] } } });
    api.getSeasonDetails.mockResolvedValue({ episodes: [{ id: 1, episode_number: 1, name: 'The beginning' }, { id: 2, episode_number: 2, name: 'The finale' }] });
    api.getPersonDetails.mockResolvedValue({ id: 501, name: 'Alex River', biography: 'Actor biography.', combined_credits: { cast: [recommendation] } });
    api.getRecommendations.mockResolvedValue({ results: [recommendation] });
    api.getMovieGenres.mockResolvedValue({ genres: [{ id: 28, name: 'Action' }, { id: 18, name: 'Drama' }] });
    api.getTVGenres.mockResolvedValue({ genres: [{ id: 18, name: 'Drama' }] });
    api.discoverMedia.mockResolvedValue({ results: [movie], page: 1, total_pages: 2 });
    anime.getTrendingAnime.mockResolvedValue({ media: [{ id: 201, title: { english: 'Skybound' } }], pageInfo: { hasNextPage: false } });
    anime.searchAnime.mockResolvedValue({ media: [{ id: 202, title: { english: 'Anime Search' } }], pageInfo: { hasNextPage: false } });
    Object.values(storage).filter(jest.isMockFunction).forEach(method => method.mockResolvedValue({ success: true, id: 'imported-doc' }));
    mockAuth.loginWithGoogle.mockResolvedValue({});
    mockAuth.loginWithEmail.mockResolvedValue({});
    mockAuth.signupWithEmail.mockResolvedValue({});
    mockAuth.createPassword.mockResolvedValue();
});

test('all destinations are reachable and the sidebar can collapse without losing links', () => {
    mount(<Navbar />);
    const navigation = screen.getByRole('navigation', { name: 'Main navigation' });
    expect(within(navigation).getAllByRole('link')).toHaveLength(7);
    fireEvent.click(screen.getByRole('button', { name: 'Collapse sidebar' }));
    expect(document.body).toHaveClass('sidebar-collapsed');
    expect(within(navigation).getByRole('link', { name: 'Browse genres' })).toHaveAttribute('href', '/categories');
    fireEvent.click(screen.getByRole('button', { name: 'Expand sidebar' }));
    expect(document.body).not.toHaveClass('sidebar-collapsed');
});

test('the visible header controls navigation and remembers the collapse setting after remount', () => {
    const { unmount } = mount(<Navbar />);
    fireEvent.click(within(screen.getByRole('banner')).getByRole('button', { name: 'Collapse sidebar' }));
    expect(localStorage.getItem('sidebar_collapsed')).toBe('true');
    expect(screen.getByRole('button', { name: 'Expand sidebar' })).toHaveAttribute('aria-controls', 'site-navigation');
    unmount();
    mount(<Navbar />);
    expect(within(screen.getByRole('banner')).getByRole('button', { name: 'Expand sidebar' })).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(screen.getByRole('button', { name: 'Expand sidebar' }));
    expect(localStorage.getItem('sidebar_collapsed')).toBe('false');
});

test('Google users can create a password from their profile without mismatched submissions', async () => {
    signedIn(); mockAuth.currentUser.providerData = [{ providerId: 'google.com' }];
    mount(<Profile />);
    fireEvent.click(screen.getByRole('button', { name: 'Create password' }));
    expect(screen.getByLabelText('Sign-in email')).toHaveValue('viewer@example.test');
    expect(screen.getByLabelText('Sign-in email')).toHaveAttribute('readonly');
    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'example-new-pass' } });
    fireEvent.change(screen.getByLabelText('Confirm new password'), { target: { value: 'different-password' } });
    fireEvent.submit(screen.getByRole('form', { name: 'Create a password' }));
    expect(screen.getByRole('alert')).toHaveTextContent('The passwords do not match.');
    expect(mockAuth.createPassword).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('Confirm new password'), { target: { value: 'example-new-pass' } });
    fireEvent.submit(screen.getByRole('form', { name: 'Create a password' }));
    await waitFor(() => expect(mockAuth.createPassword).toHaveBeenCalledWith('example-new-pass'));
    expect(await screen.findByText('You can sign in with your email and password.')).toBeInTheDocument();
    expect(screen.queryByLabelText('New password')).not.toBeInTheDocument();
});

test('existing password accounts show their enabled sign-in method and cannot replace it through create-password', () => {
    signedIn(); mockAuth.currentUser.providerData = [{ providerId: 'password' }];
    mount(<Profile />);
    expect(screen.getByText('You can sign in with your email and password.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Create password' })).not.toBeInTheDocument();
});

test('canceling password setup clears input values and canceled Google confirmation permits a retry', async () => {
    signedIn(); mockAuth.currentUser.providerData = [{ providerId: 'google.com' }];
    mockAuth.createPassword.mockRejectedValueOnce({ code: 'auth/popup-closed-by-user' });
    mount(<Profile />);
    fireEvent.click(screen.getByRole('button', { name: 'Create password' }));
    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'example-new-pass' } });
    fireEvent.change(screen.getByLabelText('Confirm new password'), { target: { value: 'example-new-pass' } });
    fireEvent.submit(screen.getByRole('form', { name: 'Create a password' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Google confirmation was canceled.');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    fireEvent.click(screen.getByRole('button', { name: 'Create password' }));
    expect(screen.getByLabelText('New password')).toHaveValue('');
    expect(screen.getByLabelText('Confirm new password')).toHaveValue('');
});

test('the complete app renders discovery and protects private vault routes', async () => {
    const { unmount } = render(<App />);
    expect(await screen.findByRole('heading', { name: /Your next great watch/ })).toBeInTheDocument();
    unmount();
    window.history.replaceState({}, '', '/vault');
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'Welcome back.' })).toBeInTheDocument();
    expect(window.location.pathname).toBe('/login');
});

test('unknown routes provide a route back to discovery', async () => {
    window.history.replaceState({}, '', '/missing-page');
    render(<App />);
    expect(await screen.findByRole('link', { name: 'Back to discovery' })).toHaveAttribute('href', '/');
});

test('discovery features open details, rotate featured titles, and save the exact title', async () => {
    signedIn();
    mount(<Home />);
    await screen.findByRole('heading', { name: movie.title, level: 2 });
    fireEvent.click(screen.getByRole('button', { name: 'Next featured title' }));
    expect(screen.getByRole('heading', { name: show.name, level: 2 })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Add to vault' }));
    await waitFor(() => expect(storage.addToVault).toHaveBeenCalledWith('test-user', show));
    fireEvent.click(screen.getByRole('button', { name: 'Explore title' }));
    expect(await screen.findByRole('dialog', { name: show.name })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

test('search keeps the submitted query when switching formats and applies year filters', async () => {
    mount(<Home />);
    await screen.findByRole('button', { name: `View details for ${movie.title}` });
    fireEvent.change(screen.getByRole('combobox', { name: 'Search movies, series, or anime' }), { target: { value: 'Horizon' } });
    fireEvent.submit(screen.getByRole('search'));
    await screen.findByRole('heading', { name: 'Results for “Horizon”' });
    fireEvent.click(screen.getByRole('button', { name: 'Movies' }));
    await waitFor(() => expect(api.searchMedia).toHaveBeenCalledWith('Horizon', 1, 'movie'));
    await screen.findByLabelText('Filter by year');
    fireEvent.change(screen.getByLabelText('Filter by year'), { target: { value: '2026' } });
    expect(screen.getByRole('button', { name: `View details for ${movie.title}` })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: `View details for ${show.name}` })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Clear search' }));
    await waitFor(() => expect(api.getTrending).toHaveBeenCalledWith(1, 'movie'));
});

test('search suggestions can be selected with the keyboard', async () => {
    mount(<Home />);
    await screen.findByRole('heading', { name: /Trending This Week/ });
    const input = screen.getByRole('combobox');
    fireEvent.change(input, { target: { value: 'Hor' } });
    await screen.findByRole('listbox');
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => expect(api.searchMedia).toHaveBeenCalledWith(movie.title, 1, 'all'));
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
});

test('anime discovery and anime search use the anime catalogue', async () => {
    mount(<Home />);
    fireEvent.click(screen.getByRole('button', { name: 'Anime' }));
    await screen.findByRole('button', { name: 'View details for Skybound' });
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'Sky' } });
    fireEvent.submit(screen.getByRole('search'));
    await screen.findByRole('button', { name: 'View details for Anime Search' });
    expect(anime.searchAnime).toHaveBeenCalledWith('Sky', 1, 20);
});

test('pagination prevents duplicate clicks while a page is loading', async () => {
    mount(<Home />);
    await screen.findByRole('button', { name: /Discover more/ });
    let finish;
    api.getTrending.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    fireEvent.click(screen.getByRole('button', { name: /Discover more/ }));
    expect(screen.getByRole('button', { name: /Loading titles/ })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: /Loading titles/ }));
    await act(async () => finish({ results: [recommendation], page: 2, total_pages: 2 }));
    expect(api.getTrending).toHaveBeenCalledTimes(2);
    expect(screen.getByRole('button', { name: `View details for ${recommendation.title}` })).toBeInTheDocument();
});

test('failed discovery can be retried', async () => {
    api.getTrending.mockRejectedValueOnce(new Error('offline'));
    mount(<Home />);
    await screen.findByRole('alert');
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('button', { name: `View details for ${movie.title}` })).toBeInTheDocument();
});

test('continue watching updates the episode and immediately detects completion', async () => {
    signedIn(); mockVaultItems = [savedShow];
    mount(<Home />);
    fireEvent.click(await screen.findByRole('button', { name: 'Next Episode' }));
    await waitFor(() => expect(storage.updateVaultItemProgress).toHaveBeenCalledWith('vault-show', 1, 2));
    await waitFor(() => expect(storage.updateVaultItemStatus).toHaveBeenCalledWith('vault-show', 'Completed'));
});

test('vault filtering, sorting, type changes, and status changes remain available', async () => {
    signedIn(); mockVaultItems = [savedMovie, savedShow];
    mount(<Vault />);
    await screen.findByText('1 season');
    expect(screen.queryByRole('group', { name: 'Filter by watch status' })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'Watching' } });
    expect(screen.queryByRole('button', { name: `View details for ${movie.title}` })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(`Watch status for ${show.name}`), { target: { value: 'Completed' } });
    expect(storage.updateVaultItemStatus).toHaveBeenCalledWith('vault-show', 'Completed', { manual: true });
    fireEvent.change(screen.getByLabelText(`Media type for ${show.name}`), { target: { value: 'anime' } });
    expect(storage.updateVaultItemType).toHaveBeenCalledWith('vault-show', 'anime');
    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'all' } });
    fireEvent.change(screen.getByLabelText('Sort'), { target: { value: 'title' } });
    fireEvent.change(screen.getByRole('textbox', { name: 'Search in your vault' }), { target: { value: 'Horizon' } });
    expect(screen.queryByRole('button', { name: `View details for ${show.name}` })).not.toBeInTheDocument();
});

test('Silo displays three seasons in the saved vault despite TMDb advertising a fourth', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-11-24T12:00:00Z'));
    try {
        signedIn();
        mockVaultItems = [{ ...savedShow, tmdbId: 125988, title: 'Silo', season: 3, episode: 10 }];
        api.getTVDetailsWithAiring.mockResolvedValue({ number_of_seasons: 4, seasons: [
            { season_number: 1, episode_count: 10, air_date: '2023-05-04' },
            { season_number: 2, episode_count: 10, air_date: '2024-11-14' },
            { season_number: 3, episode_count: 10, air_date: '2026-07-02' },
            { season_number: 4, episode_count: 1, air_date: '2027-07-08' }
        ] });
        api.getSeasonDetails.mockResolvedValue({ episodes: Array.from({ length: 10 }, (_, index) => ({ episode_number: index + 1, air_date: '2026-09-03' })) });
        const { unmount } = mount(<Vault />);
        expect(await screen.findByText('3 seasons')).toBeInTheDocument();
        expect(screen.queryByText('4 seasons')).not.toBeInTheDocument();
        unmount();
    } finally { jest.useRealTimers(); }
});

test('removing a vault title still requires the confirmation action', async () => {
    signedIn(); mockVaultItems = [savedMovie];
    mount(<Vault />);
    fireEvent.click(screen.getByRole('button', { name: `Remove ${movie.title} from vault` }));
    expect(storage.removeVaultItem).not.toHaveBeenCalled();
    render(toast.custom.mock.calls[0][0]({ id: 'confirm' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    await waitFor(() => expect(storage.removeVaultItem).toHaveBeenCalledWith('vault-movie'));
});

test('vault export preserves tracking and curation, and excludes private user identity', () => {
    const item = { ...savedShow, manualStatus: true, userId: 'private-user', notes: 'Remember the finale', review: 'Excellent', tags: ['favorites'] };
    const exported = createVaultExport([item]);
    expect(exported.version).toBe(2);
    expect(exported.items[0]).toMatchObject({ tmdbId: 102, season: 1, episode: 1, rating: 8, notes: item.notes, review: item.review, tags: item.tags, poster: item.poster });
    expect(exported.items[0]).not.toHaveProperty('userId');
    expect(exported.items[0]).not.toHaveProperty('id');
    expect(importedCuration(exported.items[0])).toMatchObject({ season: 1, episode: 1, rating: 8, notes: item.notes, tags: ['favorites'], manualStatus: true });
    expect(importedCuration({ rating: 99, episode: -3, tags: ['ok', 1], userId: 'bad', manualStatus: 'true' })).toEqual({ tags: ['ok'] });
});

test('vault import restores exact identities and curation and skips duplicates', async () => {
    signedIn(); mockVaultItems = [savedMovie];
    mount(<Vault />);
    const imported = { ...savedShow, notes: 'Private note', tags: ['favorite'] };
    const file = new File([JSON.stringify({ items: [savedMovie, imported] })], 'vault.json', { type: 'application/json' });
    fireEvent.change(screen.getByLabelText('Import vault backup'), { target: { files: [file] } });
    await waitFor(() => expect(storage.addToVault).toHaveBeenCalledTimes(1));
    expect(storage.addToVault).toHaveBeenCalledWith('test-user', expect.objectContaining({ id: 102, title: show.name, type: 'tv' }), 'Watching');
    await waitFor(() => expect(storage.updateVaultItemDetails).toHaveBeenCalledWith('imported-doc', expect.objectContaining({ episode: 1, rating: 8, notes: 'Private note', tags: ['favorite'] })));
});

test.each([
    ['movie', movie, savedMovie],
    ['series', show, savedShow],
    ['anime', { id: 201, title: 'Skybound', type: 'anime' }, { id: 'vault-anime', tmdbId: 201, title: 'Skybound', type: 'anime', status: 'Plan to Watch' }]
])('saved %s details can switch between every watch status', async (format, media, saved) => {
    signedIn(); mockVaultItems = [saved];
    anime.getAnimeById.mockResolvedValue({ id: 201, title: { english: 'Skybound' }, coverImage: { large: 'https://example.test/anime.jpg' }, status: 'FINISHED', episodes: 2, genres: ['Adventure'], averageScore: 80, streamingEpisodes: [] });
    mount(<MediaModal media={media} onClose={jest.fn()} />);
    const selector = await screen.findByRole('combobox', { name: 'Watch status' });
    expect(selector).toHaveValue(saved.status);
    for (const status of ['Completed', 'Watching', 'Plan to Watch']) {
        fireEvent.change(selector, { target: { value: status } });
        await waitFor(() => expect(selector).toBeEnabled());
        expect(selector).toHaveValue(status);
        expect(storage.updateVaultItemStatus).toHaveBeenLastCalledWith(saved.id, status, { manual: true });
    }
    expect(screen.getByRole('button', { name: 'In Your Vault' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Remove from Vault' })).toBeInTheDocument();
    expect(storage.updateVaultItemProgress).not.toHaveBeenCalled();
});

test('status saving prevents duplicate changes and rolls back when persistence fails', async () => {
    signedIn(); mockVaultItems = [savedMovie];
    let finish;
    storage.updateVaultItemStatus.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    mount(<MediaModal media={movie} onClose={jest.fn()} />);
    const selector = await screen.findByRole('combobox', { name: 'Watch status' });
    fireEvent.change(selector, { target: { value: 'Watching' } });
    expect(selector).toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent('Saving');
    fireEvent.change(selector, { target: { value: 'Completed' } });
    expect(storage.updateVaultItemStatus).toHaveBeenCalledTimes(1);
    await act(async () => finish({ success: false, error: 'offline' }));
    expect(selector).toHaveValue('Plan to Watch');
    expect(selector).toBeEnabled();
    expect(toast.error).toHaveBeenCalledWith('Could not save your watch status. Please try again.');
    fireEvent.change(selector, { target: { value: 'Watching' } });
    await waitFor(() => expect(selector).toBeEnabled());
    expect(selector).toHaveValue('Watching');
});

test('navigating to another saved title keeps status writes bound to the correct vault document', async () => {
    signedIn(); mockVaultItems = [savedShow, { ...savedMovie, id: 'vault-recommendation', tmdbId: recommendation.id, title: recommendation.title }];
    let finish;
    storage.updateVaultItemStatus.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    mount(<MediaModal media={show} onClose={jest.fn()} />);
    fireEvent.change(await screen.findByRole('combobox', { name: 'Watch status' }), { target: { value: 'Completed' } });
    fireEvent.click(screen.getByRole('button', { name: `Explore ${recommendation.title}` }));
    await screen.findByRole('dialog', { name: recommendation.title });
    const nextSelector = await screen.findByRole('combobox', { name: 'Watch status' });
    expect(nextSelector).toHaveValue('Plan to Watch');
    await act(async () => finish({ success: false, error: 'offline' }));
    expect(nextSelector).toHaveValue('Plan to Watch');
    expect(toast.error).not.toHaveBeenCalled();
    fireEvent.change(nextSelector, { target: { value: 'Watching' } });
    await waitFor(() => expect(nextSelector).toBeEnabled());
    expect(storage.updateVaultItemStatus).toHaveBeenNthCalledWith(1, 'vault-show', 'Completed', { manual: true });
    expect(storage.updateVaultItemStatus).toHaveBeenNthCalledWith(2, 'vault-recommendation', 'Watching', { manual: true });
});

test('title details retain episodes, curation, trailers, providers, and actor navigation', async () => {
    signedIn(); mockVaultItems = [savedShow];
    const close = jest.fn();
    mount(<MediaModal media={show} onClose={close} />);
    await screen.findByRole('button', { name: /Mark episode 2 watched/ });
    fireEvent.click(screen.getByRole('button', { name: /Mark episode 2 watched/ }));
    await waitFor(() => expect(storage.updateVaultItemProgress).toHaveBeenCalledWith('vault-show', 1, 2));
    await waitFor(() => expect(storage.updateVaultItemStatus).toHaveBeenCalledWith('vault-show', 'Completed'));
    fireEvent.click(screen.getByRole('radio', { name: 'Rate 4.5 out of 5 stars' }));
    fireEvent.change(screen.getByPlaceholderText('Enter private notes...'), { target: { value: 'New note' } });
    fireEvent.change(screen.getByPlaceholderText('Write your review here...'), { target: { value: 'A great finale' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Curation Details' }));
    await waitFor(() => expect(storage.updateVaultItemDetails).toHaveBeenCalledWith('vault-show', expect.objectContaining({ rating: 9, notes: 'New note', review: 'A great finale' })));
    fireEvent.click(screen.getByRole('button', { name: 'Watch Trailer' }));
    expect(screen.getAllByTestId('trailer-player')).toHaveLength(2);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(close).not.toHaveBeenCalled();
    expect(screen.getAllByTestId('trailer-player')).toHaveLength(1);
    expect(screen.getByText('Stream Service')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'View Alex River' }));
    await screen.findByText('Actor biography.');
    expect(screen.queryByRole('combobox', { name: 'Watch status' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: `Explore ${recommendation.title}` }));
    await screen.findByRole('dialog', { name: recommendation.title });
    expect(screen.queryByRole('combobox', { name: 'Watch status' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Go back' }));
    await screen.findByRole('dialog', { name: 'Alex River' });
    fireEvent.click(screen.getByRole('button', { name: 'Go back' }));
    await screen.findByRole('dialog', { name: show.name });
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(close).toHaveBeenCalledTimes(1);
});

test('genre discovery changes format and adds selected titles', async () => {
    signedIn(); mount(<Categories />);
    fireEvent.click(await screen.findByRole('button', { name: 'Action' }));
    await screen.findByRole('button', { name: `Explore ${movie.title}` });
    expect(api.discoverMedia).toHaveBeenCalledWith('movie', 1, 28, false);
    fireEvent.click(screen.getByRole('button', { name: /Add/ }));
    await waitFor(() => expect(storage.addToVault).toHaveBeenCalledWith('test-user', expect.objectContaining({ id: 101, media_type: 'movie' }), 'Plan to Watch'));
    fireEvent.click(screen.getByRole('button', { name: 'TV Series' }));
    await waitFor(() => expect(api.getTVGenres).toHaveBeenCalled());
    expect(screen.queryByRole('button', { name: 'Action' })).not.toBeInTheDocument();
});

test('switching seasons removes the previous episode list until the selected season loads', async () => {
    signedIn(); mockVaultItems = [savedShow];
    api.getMediaDetails.mockResolvedValue({ ...showDetails, seasons: [{ season_number: 1, episode_count: 1 }, { season_number: 3, episode_count: 3 }] });
    api.getSeasonDetails.mockImplementation(async (id, season) => ({ episodes: [{ id: season, episode_number: season, name: `Season ${season} episode` }] }));
    mount(<MediaModal media={show} onClose={jest.fn()} />);
    await screen.findByRole('button', { name: 'Mark episode 1 watched: Season 1 episode' });
    let resolveEpisodes;
    api.getSeasonDetails.mockImplementation(() => new Promise(resolve => { resolveEpisodes = resolve; }));
    fireEvent.change(screen.getByLabelText('Select season'), { target: { value: '3' } });
    expect(screen.queryByRole('button', { name: 'Mark episode 1 watched: Season 1 episode' })).not.toBeInTheDocument();
    await act(async () => resolveEpisodes({ episodes: [{ id: 3, episode_number: 3, name: 'Real episode' }] }));
    fireEvent.click(screen.getByRole('button', { name: 'Mark episode 3 watched: Real episode' }));
    await waitFor(() => expect(storage.updateVaultItemProgress).toHaveBeenCalledWith('vault-show', 3, 3));
});

test('recommendations are seeded from the vault and can be saved', async () => {
    signedIn(); mockVaultItems = [savedShow]; mount(<Recommendations />);
    await screen.findByRole('button', { name: `Explore ${recommendation.title}` });
    expect(api.getRecommendations).toHaveBeenCalledWith(102, 'tv');
    expect(screen.getByText(`Inspired by ${show.name}`)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    await waitFor(() => expect(storage.addToVault).toHaveBeenCalled());
});

test('statistics reflect the saved collection and active trackers', () => {
    signedIn(); mockVaultItems = [savedShow, { ...savedMovie, status: 'Completed' }]; mount(<Stats />);
    expect(screen.getByRole('heading', { name: 'Your story in numbers.' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '2 Titles' })).toBeInTheDocument();
    expect(screen.getByText('50%')).toBeInTheDocument();
    expect(screen.getByText(show.name)).toBeInTheDocument();
});

test('shuffle selects from the filtered watchlist and supports an external discovery source', async () => {
    signedIn(); mockVaultItems = [savedMovie];
    jest.useFakeTimers();
    try {
        mount(<Shuffle />);
        fireEvent.click(screen.getByRole('button', { name: 'Shuffle Titles' }));
        await act(async () => { jest.advanceTimersByTime(2500); });
        expect(screen.getByRole('heading', { name: movie.title })).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Discover New' }));
        fireEvent.click(screen.getByRole('button', { name: 'Movies' }));
        fireEvent.click(screen.getByRole('button', { name: 'Shuffle Titles' }));
        await act(async () => { await api.discoverMedia.mock.results[0].value; });
        await act(async () => { jest.advanceTimersByTime(2500); });
        expect(api.discoverMedia).toHaveBeenCalledWith('movie', expect.any(Number), null, false, null);
        expect(screen.getByRole('heading', { name: movie.title })).toBeInTheDocument();
    } finally { jest.useRealTimers(); }
});

test('email sign-in, signup, password visibility, and Google sign-in remain available', async () => {
    mount(<Login />);
    fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'viewer@example.test' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'example-password' } });
    fireEvent.click(screen.getByRole('button', { name: 'Show password' }));
    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'text');
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    await waitFor(() => expect(mockAuth.loginWithEmail).toHaveBeenCalledWith('viewer@example.test', 'example-password'));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Sign Up' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Sign Up' }));
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }));
    await waitFor(() => expect(mockAuth.signupWithEmail).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByRole('button', { name: 'Continue with Google' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Continue with Google' }));
    await waitFor(() => expect(mockAuth.loginWithGoogle).toHaveBeenCalled());
});

test('profile avatar selection and account deletion confirmation stay available', () => {
    signedIn(); mockVaultItems = [savedMovie, savedShow]; mount(<Profile />);
    fireEvent.click(screen.getByRole('button', { name: /Select Animated Avatar/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Sci-Fi Explorer' }));
    expect(localStorage.getItem('watchvault_avatar')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Delete Account' }));
    expect(screen.getByRole('heading', { name: 'Delete Account?' })).toBeInTheDocument();
    expect(mockAuth.deleteAccount).not.toHaveBeenCalled();
});

test('notifications can be opened and closed without affecting the vault', () => {
    signedIn(); mount(<Navbar />);
    fireEvent.click(screen.getByRole('button', { name: 'Notifications' }));
    expect(screen.getByText('No new seasons or franchise releases.')).toBeInTheDocument();
    fireEvent.mouseDown(document.body);
    expect(screen.queryByText('No new seasons or franchise releases.')).not.toBeInTheDocument();
    expect(storage.removeVaultItem).not.toHaveBeenCalled();
});

test('read actions persist, retain history, and never show another user’s notifications', async () => {
    signedIn();
    mockNotificationItems['test-user'] = [{ id: 'season-a', userId: 'test-user', title: 'Season update', type: 'new-season', totalSeasons: 2, read: false }, { id: 'season-b', userId: 'test-user', title: 'Another update', type: 'new-season', totalSeasons: 3, read: false }];
    const { rerender } = mount(<Navbar />);
    fireEvent.click(screen.getByRole('button', { name: 'Notifications' }));
    fireEvent.click(screen.getAllByRole('button', { name: 'Mark read' })[0]);
    await waitFor(() => expect(inbox.markNotificationsRead).toHaveBeenCalledWith('test-user', ['season-a'], 'mark_read'));
    await waitFor(() => expect(screen.queryByText('Season update')).not.toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Mark all read' }));
    await waitFor(() => expect(inbox.markNotificationsRead).toHaveBeenCalledWith('test-user', ['season-b'], 'mark_all_read'));
    fireEvent.click(screen.getByRole('button', { name: 'All notifications' }));
    expect(screen.getByText('Season update')).toBeInTheDocument();
    mockAuth.currentUser = { ...mockAuth.currentUser, uid: 'second-user' };
    rerender(<MemoryRouter><Navbar /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'Notifications' }));
    expect(screen.queryByText('Season update')).not.toBeInTheDocument();
    expect(inbox.subscribeNotifications).toHaveBeenLastCalledWith('second-user', expect.any(Function), expect.any(Function));
});

test('shuffle has no leftover timers after navigation and honors reduced motion', async () => {
    signedIn(); mockVaultItems = [savedMovie];
    jest.useFakeTimers();
    const previous = window.matchMedia;
    const timeoutSpy = jest.spyOn(global, 'setTimeout');
    const clearSpy = jest.spyOn(global, 'clearTimeout');
    window.matchMedia = jest.fn(() => ({ matches: true }));
    try {
        const { unmount } = mount(<Shuffle />);
        fireEvent.click(screen.getByRole('button', { name: 'Shuffle Titles' }));
        await act(async () => { jest.runOnlyPendingTimers(); });
        expect(screen.getByRole('heading', { name: movie.title })).toBeInTheDocument();
        window.matchMedia = jest.fn(() => ({ matches: false }));
        fireEvent.click(screen.getByRole('button', { name: 'Shuffle again' }));
        const timerIndex = timeoutSpy.mock.calls.findIndex(call => call[1] === 2400);
        const animationTimer = timeoutSpy.mock.results[timerIndex].value;
        unmount();
        expect(clearSpy).toHaveBeenCalledWith(animationTimer);
    } finally { timeoutSpy.mockRestore(); clearSpy.mockRestore(); window.matchMedia = previous; jest.useRealTimers(); }
});
