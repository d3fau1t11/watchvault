import { Film, Shuffle } from 'lucide-react';

export default function ShuffleAnimation({ items = [], onFinish, source }) {
    return <div className="shuffle-theater" role="status" aria-live="polite" aria-label="Choosing your next watch">
        <div className="shuffle-theater__eyebrow"><Shuffle size={15} /> A GREAT STORY IS ON ITS WAY</div>
        <div className="shuffle-window" aria-hidden="true">
            <div className={`shuffle-track${items.length ? ' shuffle-track--rolling' : ''}`} style={{ '--reel-count': Math.max(0, items.length - 1) }} onAnimationEnd={event => { if (event.target === event.currentTarget) onFinish(); }}>
                {(items.length ? items : [null, null, null]).map((item, index) => {
                    const poster = item?.poster || item?.poster_path;
                    const url = poster ? poster.startsWith('http') ? poster : `https://image.tmdb.org/t/p/w342${poster}` : null;
                    return <div className="shuffle-frame" key={index}>{url ? <img src={url} alt="" draggable="false" /> : <Film size={38} />}<span>{item?.title || item?.name || 'Your next watch'}</span></div>;
                })}
            </div>
            <div className="shuffle-selection" />
        </div>
        <p>{items.length ? source === 'watchlist' ? 'Finding a favorite in your watchlist…' : 'Discovering something new…' : 'Gathering your next possibilities…'}</p>
    </div>;
}
