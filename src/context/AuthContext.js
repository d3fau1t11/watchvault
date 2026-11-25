import { createContext, useContext, useEffect, useState } from "react";
import { auth } from "../services/firebase";
import {
    onAuthStateChanged,
    GoogleAuthProvider,
    signInWithPopup,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut,
    EmailAuthProvider,
    reauthenticateWithCredential,
    reauthenticateWithPopup,
    deleteUser,
    linkWithCredential
} from "firebase/auth";
import { deleteUserVault } from "../services/firestoreService";
import { deleteUserNotifications } from '../services/notificationService';

const AuthContext = createContext();

export function useAuth() {
    return useContext(AuthContext);
}

export function AuthProvider({ children }) {
    const [currentUser, setCurrentUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [, refreshAccount] = useState(0);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            setCurrentUser(user);
            setLoading(false);
        });

        return unsubscribe;
    }, []);

    const loginWithGoogle = () => {
        const provider = new GoogleAuthProvider();
        return signInWithPopup(auth, provider);
    };

    const loginWithEmail = (email, password) => {
        return signInWithEmailAndPassword(auth, email, password);
    };

    const signupWithEmail = (email, password) => {
        return createUserWithEmailAndPassword(auth, email, password);
    };

    const createPassword = async (password) => {
        const user = currentUser;
        if (!user || !user.email || auth.currentUser?.uid !== user.uid) throw new Error('Sign in again to create a password.');
        if ((user.providerData || []).some(provider => provider.providerId === 'password')) {
            const error = new Error('Password sign-in is already enabled.');
            error.code = 'auth/provider-already-linked';
            throw error;
        }
        if (typeof password !== 'string' || password.length < 8) {
            const error = new Error('Use at least 8 characters for your password.');
            error.code = 'auth/weak-password';
            throw error;
        }
        if (!(user.providerData || []).some(provider => provider.providerId === 'google.com')) throw new Error('This account cannot add a password here.');

        // Link a second sign-in method to this same UID, preserving the vault.
        // Reconfirm Google identity before making a credential change.
        await reauthenticateWithPopup(user, new GoogleAuthProvider());
        if (auth.currentUser?.uid !== user.uid) throw new Error('The signed-in account changed. Please try again.');
        await linkWithCredential(user, EmailAuthProvider.credential(user.email, password));
        if (auth.currentUser?.uid === user.uid) {
            // Firebase mutates providerData on the existing User object. Force
            // context consumers to refresh without cloning that User object.
            setCurrentUser(auth.currentUser);
            refreshAccount(revision => revision + 1);
        }
    };

    /* Re-authenticates the current user so sensitive operations (like account
       deletion) are allowed by Firebase. Falls back to the provider the user
       originally signed in with. */
    const reauthenticate = async () => {
        if (!currentUser) throw new Error("No signed-in user.");

        // If the user has a Google provider in their provider data, re-auth via popup.
        const usesGoogle = (currentUser.providerData || []).some(
            (p) => p.providerId === "google.com"
        );

        if (usesGoogle) {
            const provider = new GoogleAuthProvider();
            const result = await reauthenticateWithPopup(currentUser, provider);
            return result.user;
        }

        // Otherwise prompt for email + password.
        throw new Error("REAUTH_PASSWORD_REQUIRED");
    };

    const reauthenticateWithPassword = async (email, password) => {
        if (!currentUser) throw new Error("No signed-in user.");
        const credential = EmailAuthProvider.credential(email, password);
        return reauthenticateWithCredential(currentUser, credential);
    };

    const logout = () => {
        return signOut(auth);
    };

    /* Permanently deletes the user's account and all of their vault data.
       Requires a fresh session (re-authentication) before Firebase will allow
       deleteUser(). The caller is responsible for re-authenticating first. */
    const deleteAccount = async () => {
        if (!currentUser) throw new Error("No signed-in user.");

        // 1. Delete all vault documents belonging to this user.
        await deleteUserNotifications(currentUser.uid);
        const result = await deleteUserVault(currentUser.uid);
        if (!result.success) throw new Error(result.error || 'Could not delete vault data');

        // 2. Delete the Firebase Auth account.
        await deleteUser(currentUser);

        // 3. Sign out locally.
        await signOut(auth);
    };

    const value = {
        currentUser,
        loginWithGoogle,
        loginWithEmail,
        signupWithEmail,
        createPassword,
        passwordEnabled: (currentUser?.providerData || []).some(provider => provider.providerId === 'password'),
        reauthenticate,
        reauthenticateWithPassword,
        logout,
        deleteAccount,
    };

    return (
        <AuthContext.Provider value={value}>
            {!loading && children}
        </AuthContext.Provider>
    );
}
