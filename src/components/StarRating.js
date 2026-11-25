import { useRef } from 'react';
import { Star } from 'lucide-react';

// Keep the existing 0–10 storage scale; present five stars with half-star choices.
export default function StarRating({ value = 0, onChange, label = 'Rating', size = 13 }) {
    const score = Math.max(0, Math.min(10, Number(value) || 0));
    const root = useRef(null);
    const change = (event, number) => {
        let next = number;
        if (event.key === 'ArrowRight' || event.key === 'ArrowUp') next = Math.min(10, number + 1);
        else if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') next = Math.max(1, number - 1);
        else if (event.key === 'Home') next = 1;
        else if (event.key === 'End') next = 10;
        else return;
        event.preventDefault(); onChange(next); root.current?.querySelector(`[data-score="${next}"]`)?.focus();
    };
    return <span ref={root} className={`star-rating${onChange ? ' star-rating--editable' : ''}`} role={onChange ? 'radiogroup' : 'img'} aria-label={onChange ? label : `${label}: ${score / 2} out of 5 stars`}>
        {[0, 1, 2, 3, 4].map(index => <span className="star-rating__star" key={index} style={{ '--star-size': `${size}px` }}>
            <Star size={size} aria-hidden="true" /><span className="star-rating__fill" style={{ width: `${Math.min(100, Math.max(0, (score / 2 - index) * 100))}%` }}><Star size={size} fill="currentColor" aria-hidden="true" /></span>
            {onChange && [1, 2].map(half => { const number = index * 2 + half; return <button key={half} type="button" className={`star-rating__choice star-rating__choice--${half}`} role="radio" data-score={number} aria-checked={score === number} aria-label={`Rate ${number / 2} out of 5 stars`} tabIndex={Math.max(1, Math.round(score)) === number ? 0 : -1} onClick={() => onChange(number)} onKeyDown={event => change(event, number)} />; })}
        </span>)}
    </span>;
}
