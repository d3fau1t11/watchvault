import { useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import StarRating from './StarRating';

test('saved numeric scores display as stars without visible numeric text', () => {
    render(<StarRating value={9} label="My rating" />);
    expect(screen.getByRole('img', { name: 'My rating: 4.5 out of 5 stars' })).toBeInTheDocument();
    expect(screen.queryByText(/9|4\.5/)).not.toBeInTheDocument();
});
test('half-star and keyboard choices retain the existing storage scale', () => {
    const save = jest.fn();
    function Picker() {
        const [value, setValue] = useState(0);
        return <StarRating value={value} onChange={next => { setValue(next); save(next); }} label="My rating" />;
    }
    render(<Picker />);
    const half = screen.getByRole('radio', { name: 'Rate 4.5 out of 5 stars' });
    fireEvent.click(half);
    expect(save).toHaveBeenLastCalledWith(9);
    expect(half).toHaveAttribute('aria-checked', 'true');
    fireEvent.keyDown(half, { key: 'ArrowLeft' });
    expect(save).toHaveBeenLastCalledWith(8);
    expect(screen.getByRole('radio', { name: 'Rate 4 out of 5 stars' })).toHaveFocus();
});
