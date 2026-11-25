# 🍿 WatchVault

[![Netlify Status](https://api.netlify.com/api/v1/badges/watchvaults/deploy-status)](https://watchvaults.netlify.app/)

**WatchVault** lets you discover, explore, and track Movies, TV Shows, and Anime. Its cinematic charcoal-and-gold interface brings featured stories, discovery, and your personal collection into one watch space. React and Firebase power real-time watchlists, with metadata from TMDb and AniList.

### 🔴 [Live Demo: watchvaults.netlify.app](https://watchvaults.netlify.app/)

![WatchVault Preview](https://drive.google.com/uc?export=view&id=1XtpyVqq-uxzPPDNlVZtxb1_1iWjrjZdB)

---

## ✨ Features

- **Cinematic UI/UX:** Featured-title spotlights, readable poster cards with visible save controls, a collapsible desktop sidebar, and mobile navigation. Keyboard controls, dialog focus management, and reduced-motion support keep the interface accessible.
- **Deep Discovery:** Click on any title to open a rich details modal featuring:
  - High-res posters and backdrop banners.
  - Core metadata (Release Year, Dynamic Status, Ratings, Genres).
  - YouTube Trailer integration.
  - Top Cast lists.
- **Recursive Exploration Stack:** Dive down the rabbit hole! Click on an actor to view their profile and "Known For" movies, then click a movie to see its details, and smoothly navigate back up your history stack using the integrated back button.
- **Personal Vault:** Securely log in using Google Authentication to add media to your personal Vault. The UI updates in real-time, displaying green checkmarks for items already saved to prevent duplicates.
- **Universal Search:** Instantly search the entire TMDb database for any Movie, TV Show, or Anime.
- **Anime Discovery:** Browse and search AniList with format-aware suggestions.
- **Collection Management:** Filter by watch status, type, and year; sort by title, rating, or recency. Import and export backups with episode progress, ratings, reviews, notes, tags, and categories.
- **Your Next Watch:** Recommendations inspired by your collection, genre browsing, and shuffle from your watchlist or new discoveries.
- **Tracking and Account Tools:** Episode tracking, completion detection, airing alerts, viewing statistics, email and Google sign-in, and local animated profile avatars.

---

## 🛠️ Technology Stack

- **Frontend Framework:** React (using Hooks, Context API, and React Router)
- **Styling:** Vanilla CSS (CSS Variables, Flexbox/Grid, Micro-animations)
- **Backend / BaaS:** Firebase (Authentication, Firestore Database)
- **Data Source:** [The Movie Database (TMDb) API](https://developer.themoviedb.org/docs)
- **Icons & Media:** Lucide-React (Icons), React-YouTube (Trailers)

---

## 🚀 Getting Started

### Prerequisites
Make sure you have [Node.js](https://nodejs.org/) installed on your machine.

### 1. Clone the Repository
```bash
git clone https://github.com/Ghostfaceki11err/watchvault.git
cd watchvault
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Environment Configuration
You need to set up your API keys to run the application. Create a `.env` file in the root directory and add the following keys:

```env
REACT_APP_TMDB_API_KEY=your_tmdb_api_key_here

REACT_APP_FIREBASE_API_KEY=your_firebase_api_key
REACT_APP_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
REACT_APP_FIREBASE_PROJECT_ID=your_project_id
REACT_APP_FIREBASE_STORAGE_BUCKET=your_project.firebasestorage.app
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
REACT_APP_FIREBASE_APP_ID=your_app_id
REACT_APP_FIREBASE_MEASUREMENT_ID=your_measurement_id
```


### 4. Run the Application
```bash
npm start
```
The app will open in development mode at [http://localhost:3000](http://localhost:3000).

### Workflow checks

```bash
npm test -- --watchAll=false --runInBand
npm run build
```

The regression suite exercises discovery, search and suggestions, format and year filters, pagination, vault changes and backups, episode progress, curation, trailers, actor exploration, recommendations, genres, shuffle, statistics, sign-in, profile controls, and notification controls. These tests use mocked account and API services; they do not write to a live Firebase account.

### Private notification storage

Notifications, season baselines, and read-action records are stored separately under `users/{uid}/notifications`, `users/{uid}/notificationBaselines`, and `users/{uid}/notificationEvents`. Mark-read and mark-all-read operations save a timestamp and an action record together. Reading an alert retains it in the All notifications view. Shared legacy browser notification data is deliberately not assigned to an account.

Publish the included `firestore.rules` to your Firebase project before using these collections live. The rules allow only the signed-in owner to access their notification buckets and preserve owner-only access to the existing vault. With Firebase CLI signed in, use `firebase deploy --only firestore:rules --project YOUR_FIREBASE_PROJECT_ID`. No database rules were deployed by the local workflow tests.

### Episodes and ratings

TV metadata is checked against actual episode lists. Empty seasons and invalid episode entries are excluded, existing saved progress is corrected when the vault syncs, and the next-episode action skips missing entries. Failed metadata requests do not erase saved progress. All visual ratings use five stars with half-star choices; saved ratings and backups retain their original 0–10 scale.

Season counts and episode tracking include released episodes only. Future-dated or undated TMDb placeholders do not count as available episodes; upcoming releases remain visible in schedule notices. For example, Silo's planned fourth season is excluded from its three released seasons until episodes actually air.

### Password sign-in for Google accounts

In Profile, choose **Create password** under Password sign-in, enter and confirm a password, and confirm your identity with Google. This links email/password sign-in to the existing Firebase user ID; it keeps the same vault and Google sign-in. Email/password sign-in must be enabled in the Firebase project's Authentication settings. Existing password accounts show that password sign-in is already enabled. Passwords are never saved in the vault or browser storage by WatchVault.

Navigation can be expanded or collapsed from the header on desktop and mobile, and the choice is remembered. Profile stats and settings wrap within their cards. The new vault/play favicon is also supplied as PNG, ICO, Apple touch, and installed-app icons.

---

## 📸 Application Structure

- `src/components/`: Reusable UI elements (`MediaCard`, `MediaModal`, `Navbar`, etc.)
- `src/pages/`: Main application views (`Home`, `Vault`, `Login`)
- `src/services/`: External API integrations (`tmdbApi.js`, `firestoreService.js`, `firebase.js`)
- `src/context/`: Global state management (`AuthContext.js`)

---

## 🤝 Contributing
Contributions, issues, and feature requests are welcome! Feel free to check the issues page.

## 📝 License
This project is open-source and available under the [MIT License](LICENSE).
