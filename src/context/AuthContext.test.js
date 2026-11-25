import { useState } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from './AuthContext';
import { GoogleAuthProvider, linkWithCredential, reauthenticateWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { deleteUserVault } from '../services/firestoreService';
import { auth as mockAuthState } from '../services/firebase';

jest.mock('../services/firebase', () => ({ auth: { currentUser: null } }));
jest.mock('../services/firestoreService', () => ({ deleteUserVault: jest.fn() }));
jest.mock('../services/notificationService', () => ({ deleteUserNotifications: jest.fn() }));
jest.mock('firebase/auth', () => ({
    onAuthStateChanged: (auth, listener) => { listener(auth.currentUser); return () => {}; },
    GoogleAuthProvider: jest.fn(() => ({ providerId: 'google.com' })),
    EmailAuthProvider: { credential: (email, password) => ({ providerId: 'password', email, password }) },
    signInWithPopup: jest.fn(), signInWithEmailAndPassword: jest.fn(), createUserWithEmailAndPassword: jest.fn(),
    signOut: jest.fn(), reauthenticateWithCredential: jest.fn(), reauthenticateWithPopup: jest.fn(), deleteUser: jest.fn(), linkWithCredential: jest.fn()
}));

function AccountTest({ password = 'example-new-pass' }) {
    const { currentUser, passwordEnabled, createPassword, loginWithEmail } = useAuth();
    const [error, setError] = useState('');
    return <><p>{currentUser?.uid}: {passwordEnabled ? 'password enabled' : 'Google only'}</p><button onClick={() => createPassword(password).catch(failure => setError(failure.code || failure.message))}>Add password</button><button onClick={() => loginWithEmail(currentUser.email, password)}>Email login</button>{error && <p role="alert">{error}</p>}</>;
}

beforeEach(() => {
    jest.clearAllMocks();
    GoogleAuthProvider.mockImplementation(() => ({ providerId: 'google.com' }));
    mockAuthState.currentUser = { uid: 'existing-user', email: 'viewer@example.test', providerData: [{ providerId: 'google.com' }] };
    reauthenticateWithPopup.mockResolvedValue({ user: mockAuthState.currentUser });
    linkWithCredential.mockImplementation(async user => { user.providerData.push({ providerId: 'password' }); return { user }; });
    signInWithEmailAndPassword.mockResolvedValue({ user: mockAuthState.currentUser });
});

test('adding a password reauthenticates Google and links the original UID without creating another account', async () => {
    const original = mockAuthState.currentUser;
    render(<AuthProvider><AccountTest /></AuthProvider>);
    fireEvent.click(await screen.findByRole('button', { name: 'Add password' }));
    await screen.findByText('existing-user: password enabled');
    expect(reauthenticateWithPopup).toHaveBeenCalledWith(original, expect.objectContaining({ providerId: 'google.com' }));
    expect(linkWithCredential).toHaveBeenCalledWith(original, { providerId: 'password', email: 'viewer@example.test', password: 'example-new-pass' });
    expect(reauthenticateWithPopup.mock.invocationCallOrder[0]).toBeLessThan(linkWithCredential.mock.invocationCallOrder[0]);
    expect(createUserWithEmailAndPassword).not.toHaveBeenCalled();
    expect(deleteUserVault).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Email login' }));
    await waitFor(() => expect(signInWithEmailAndPassword).toHaveBeenCalledWith(mockAuthState, 'viewer@example.test', 'example-new-pass'));
    expect(mockAuthState.currentUser.uid).toBe('existing-user');
});
test('canceling Google confirmation prevents linking a password', async () => {
    reauthenticateWithPopup.mockRejectedValue({ code: 'auth/popup-closed-by-user' });
    render(<AuthProvider><AccountTest /></AuthProvider>);
    fireEvent.click(await screen.findByRole('button', { name: 'Add password' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('auth/popup-closed-by-user');
    expect(linkWithCredential).not.toHaveBeenCalled();
    expect(mockAuthState.currentUser.providerData).toEqual([{ providerId: 'google.com' }]);
});
test('a changed signed-in account during confirmation cannot receive the old account’s password', async () => {
    reauthenticateWithPopup.mockImplementation(async () => { mockAuthState.currentUser = { uid: 'another-user' }; });
    render(<AuthProvider><AccountTest /></AuthProvider>);
    fireEvent.click(await screen.findByRole('button', { name: 'Add password' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('The signed-in account changed.');
    expect(linkWithCredential).not.toHaveBeenCalled();
});
test('weak passwords fail before reauthentication and linking', async () => {
    render(<AuthProvider><AccountTest password="short" /></AuthProvider>);
    fireEvent.click(await screen.findByRole('button', { name: 'Add password' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('auth/weak-password');
    expect(reauthenticateWithPopup).not.toHaveBeenCalled();
    expect(linkWithCredential).not.toHaveBeenCalled();
});
test('an existing password is preserved rather than relinked or replaced', async () => {
    mockAuthState.currentUser.providerData.push({ providerId: 'password' });
    render(<AuthProvider><AccountTest /></AuthProvider>);
    fireEvent.click(await screen.findByRole('button', { name: 'Add password' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('auth/provider-already-linked');
    expect(linkWithCredential).not.toHaveBeenCalled();
});
