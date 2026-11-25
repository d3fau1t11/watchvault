import { useEffect, useRef, useState } from 'react';
import { Check, KeyRound } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

const passwordError = error => {
    switch (error.code) {
        case 'auth/weak-password':
        case 'auth/password-does-not-meet-requirements': return 'Choose a stronger password with at least 8 characters, using letters, numbers, and a symbol.';
        case 'auth/popup-closed-by-user':
        case 'auth/cancelled-popup-request': return 'Google confirmation was canceled. No password was added.';
        case 'auth/credential-already-in-use':
        case 'auth/email-already-in-use': return 'This email already belongs to another password account. Sign in to that account to continue.';
        case 'auth/provider-already-linked': return 'Password sign-in is already enabled for this account.';
        case 'auth/operation-not-allowed': return 'Password sign-in has not been enabled for this site yet.';
        case 'auth/requires-recent-login': return 'Please confirm your Google sign-in again and retry.';
        default: return 'Could not create your password. Please sign in again and retry.';
    }
};

export default function PasswordSettings() {
    const { currentUser, createPassword, passwordEnabled } = useAuth();
    const [open, setOpen] = useState(false);
    const [password, setPassword] = useState('');
    const [confirmation, setConfirmation] = useState('');
    const [visible, setVisible] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [added, setAdded] = useState(false);
    const [formOwner, setFormOwner] = useState(currentUser?.uid);
    const owner = useRef(currentUser?.uid);
    const mounted = useRef(true);
    owner.current = currentUser?.uid;
    useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
    useEffect(() => { setFormOwner(currentUser?.uid); setOpen(false); setPassword(''); setConfirmation(''); setError(''); setAdded(false); setBusy(false); setVisible(false); }, [currentUser?.uid]);
    const enabled = (added && formOwner === currentUser?.uid) || (passwordEnabled ?? currentUser?.providerData?.some(provider => provider.providerId === 'password'));
    const canAdd = currentUser?.providerData?.some(provider => provider.providerId === 'google.com');
    const reset = () => { setOpen(false); setPassword(''); setConfirmation(''); setVisible(false); setError(''); };
    const submit = async event => {
        event.preventDefault();
        if (busy) return;
        if (password.length < 8) { setError('Use at least 8 characters for your password.'); return; }
        if (password !== confirmation) { setError('The passwords do not match.'); return; }
        const uid = currentUser.uid;
        setBusy(true); setError('');
        try {
            await createPassword(password);
            if (!mounted.current || owner.current !== uid) return;
            setAdded(true); reset();
            toast.success('Password added. You can now sign in with your email and password.');
        } catch (failure) {
            if (mounted.current && owner.current === uid) setError(passwordError(failure));
        } finally { if (mounted.current && owner.current === uid) setBusy(false); }
    };
    return <section className="profile-section password-settings" aria-labelledby="password-settings-title">
        <div className="profile-section__row">
            <div className="profile-section__label" id="password-settings-title"><KeyRound size={16} /> Password sign-in</div>
            {!enabled && canAdd && <button className="btn btn--outline btn--sm" disabled={busy} aria-expanded={open} aria-controls="create-password-form" onClick={() => open ? reset() : setOpen(true)}>{open ? 'Cancel' : 'Create password'}</button>}
        </div>
        {enabled ? <p className="profile-section__note password-enabled"><Check size={15} /> You can sign in with your email and password.</p> : <p className="profile-section__note">{canAdd ? 'Add a password to this account. Google sign-in will continue to work.' : 'Sign in with your account’s original sign-in method.'}</p>}
        {open && !enabled && formOwner === currentUser?.uid && <form id="create-password-form" className="create-password-form" aria-label="Create a password" onSubmit={submit} aria-busy={busy}>
            <div className="field"><label htmlFor="password-signin-email" className="field-label">Sign-in email</label><input className="input" id="password-signin-email" type="email" autoComplete="username" value={currentUser.email || ''} readOnly /></div>
            <div className="field"><label htmlFor="profile-new-password" className="field-label">New password</label><input className="input" id="profile-new-password" type={visible ? 'text' : 'password'} autoComplete="new-password" required minLength={8} value={password} disabled={busy} onChange={event => setPassword(event.target.value)} aria-describedby="password-length-note" /></div>
            <div className="field"><label htmlFor="profile-confirm-password" className="field-label">Confirm new password</label><input className="input" id="profile-confirm-password" type={visible ? 'text' : 'password'} autoComplete="new-password" required minLength={8} value={confirmation} disabled={busy} onChange={event => setConfirmation(event.target.value)} /></div>
            <p className="profile-section__note" id="password-length-note">Use at least 8 characters. Google will ask you to confirm your identity.</p>
            <label className="password-visibility"><input type="checkbox" checked={visible} disabled={busy} onChange={event => setVisible(event.target.checked)} /> Show passwords</label>
            {error && <p className="password-settings-error" role="alert">{error}</p>}
            <button className="btn btn--block" type="submit" disabled={busy}>{busy ? 'Confirming with Google…' : 'Create password'}</button>
        </form>}
    </section>;
}
