import { readFileSync } from 'fs';
import { resolve } from 'path';
import { runInNewContext } from 'vm';

const source = readFileSync(resolve(__dirname, '../public/service-worker.js'), 'utf8');
const origin = 'https://watchvault.example';
const response = body => ({ status: 200, text: async () => body, clone() { return response(body); } });

function serviceWorker({ failAsset } = {}) {
    const handlers = {};
    const cacheMaps = new Map();
    const key = request => typeof request === 'string' ? request : request.url;
    const html = '<script src="/static/js/main.current.js"></script><link href="/static/css/main.current.css" rel="stylesheet">';
    const cacheFor = name => {
        if (!cacheMaps.has(name)) cacheMaps.set(name, new Map());
        const entries = cacheMaps.get(name);
        return {
            add: jest.fn(async url => {
                if (url === failAsset) throw new Error('Unavailable asset');
                entries.set(key(url), response(url === '/index.html' ? html : 'asset'));
            }),
            match: async request => entries.get(key(request)),
            put: async (request, result) => { entries.set(key(request), result); }
        };
    };
    const fetch = jest.fn(async () => response('network'));
    const caches = {
        open: async name => cacheFor(name), keys: async () => [...cacheMaps.keys()],
        delete: async name => cacheMaps.delete(name),
        match: async request => {
            for (const entries of cacheMaps.values()) if (entries.has(key(request))) return entries.get(key(request));
        }
    };
    const self = { location: { origin }, clients: { claim: jest.fn() }, skipWaiting: jest.fn(), addEventListener: (event, handler) => { handlers[event] = handler; } };
    runInNewContext(source, { self, caches, fetch, URL, console });
    const dispatchFetch = request => {
        let result;
        handlers.fetch({ request: { method: 'GET', mode: 'cors', ...request }, respondWith: promise => { result = promise; } });
        return result;
    };
    return { handlers, cacheMaps, cacheFor, fetch, dispatchFetch };
}

test('offline installation discovers the current bundles even if one optional asset fails', async () => {
    const worker = serviceWorker({ failAsset: '/avatars/hero.svg' });
    let installation;
    worker.handlers.install({ waitUntil: promise => { installation = promise; } });
    await installation;
    const shell = worker.cacheMaps.get('watchvault-shell-v5');
    expect(shell.has('/index.html')).toBe(true);
    expect(shell.has(`${origin}/static/js/main.current.js`)).toBe(true);
    expect(shell.has(`${origin}/static/css/main.current.css`)).toBe(true);
    expect(shell.has('/avatars/explorer.svg')).toBe(true);
});

test('new app assets are cached and offline navigation falls back to the app shell', async () => {
    const worker = serviceWorker();
    const asset = `${origin}/avatars/explorer.svg`;
    await worker.dispatchFetch({ url: asset });
    expect(worker.cacheMaps.get('watchvault-shell-v5').has(asset)).toBe(true);
    await worker.cacheFor('watchvault-shell-v5').add('/index.html');
    worker.fetch.mockRejectedValue(new Error('offline'));
    const offline = await worker.dispatchFetch({ url: `${origin}/vault`, mode: 'navigate' });
    expect(await offline.text()).toContain('main.current.js');
});

test('the offline cache does not intercept account requests or anime POST requests', () => {
    const worker = serviceWorker();
    expect(worker.dispatchFetch({ url: 'https://firestore.googleapis.com/account' })).toBeUndefined();
    expect(worker.dispatchFetch({ url: 'https://graphql.anilist.co', method: 'POST' })).toBeUndefined();
    expect(worker.fetch).not.toHaveBeenCalled();
});
