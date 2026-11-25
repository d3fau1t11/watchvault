import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { updateVaultItemStatus } from '../services/firestoreService';

export default function WatchStatusControl({ item }) {
    const [selection, setSelection] = useState(item.status || 'Plan to Watch');
    const [saving, setSaving] = useState(false);
    const busy = useRef(false);
    const mounted = useRef(false);
    const latestStatus = useRef(item.status || 'Plan to Watch');

    useEffect(() => {
        mounted.current = true;
        return () => { mounted.current = false; };
    }, []);

    useEffect(() => {
        latestStatus.current = item.status || 'Plan to Watch';
        if (!busy.current) setSelection(latestStatus.current);
    }, [item.status]);

    const changeStatus = async event => {
        if (busy.current) return;
        const status = event.target.value;
        busy.current = true;
        setSelection(status);
        setSaving(true);

        try {
            const result = await updateVaultItemStatus(item.id, status, { manual: true });
            if (!result.success) throw new Error(result.error);
            if (mounted.current) toast.success(`Status updated to ${status}`);
        } catch {
            if (mounted.current) {
                setSelection(latestStatus.current);
                toast.error('Could not save your watch status. Please try again.');
            }
        } finally {
            busy.current = false;
            if (mounted.current) setSaving(false);
        }
    };

    return (
        <div className="modal-watch-status">
            <label className="modal-watch-status__field">
                <span>Watch status</span>
                <select className="select" value={selection} onChange={changeStatus} disabled={saving}>
                    <option value="Plan to Watch">Plan to Watch</option>
                    <option value="Watching">Watching</option>
                    <option value="Completed">Completed</option>
                </select>
            </label>
            {saving && <span className="modal-watch-status__saving" role="status">Saving…</span>}
        </div>
    );
}
