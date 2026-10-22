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
    deleteUser
} from "firebase/auth";
import { deleteUserVault } from "../services/firestoreService";

const AuthContext = createContext();

export function useAuth() {
    return useContext(AuthContext);
}

export function AuthProvider({ children }) {
    const [currentUser, setCurrentUser] = useState(null);
    const [loading, setLoading] = useState(true);

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
        await deleteUserVault(currentUser.uid);

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
