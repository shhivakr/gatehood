# Gatehood

Gatehood is a mobile app for residential construction projects that replaces noisy group chats with targeted project updates per tower and unit, and gives the builder visibility into which buyers have joined and read each notice. Built with Expo (React Native), TypeScript, Expo Router, and the Firebase JS SDK so it runs directly in Expo Go on iOS and Android on the Firebase Spark plan.

**Submission:** [Design note](NOTE.md) · [Demo video](https://drive.google.com/file/d/16jpDyjt5d3tM8ya855hD7kdpi5mFL8cM/view?usp=drive_link)

## Features

### Builder
- Import buyer lists from a CSV file (`tower`, `unit`, `name`, `phone`, and optional `config`), generating unique invite codes per unit (e.g. `A203-B59`) while skipping duplicate units and invalid rows.
- View buyers grouped by tower with joined/invited/expired counts and native share for invite codes.
- Post notices targeted to the whole project, selected towers, or specific units (`A-103`), with an option to pin notices.
- View all notices sorted pinned-first then newest (`15` per page), toggle pin status, see read counts (`getCountFromServer`), and expand any notice to list buyers in the target audience who have not read it yet.

### Buyer
- Join using a one-time invite code (`TOWERUNIT-XXX`) backed by Firebase Anonymous Auth and an atomic Firestore transaction, with distinct handling for invalid, already-used, and expired codes.
- **My Unit** screen showing buyer name, unit, tower, configuration, tower construction progress percentage, and days remaining to possession (`projects/main`).
- **Updates** feed showing only notices matching the buyer (`all`, `tower:<tower>`, or `unit:<tower>-<unit>`), pinned first then newest, live `onSnapshot` updates, `15` items per page with **Load more**, **All / My tower / My unit** filters, unread indicator, and idempotent read tracking on open.
- Graceful loading, empty, error-with-retry, and offline states (caches the first page of each feed filter in `AsyncStorage` and displays an offline banner via NetInfo).

## Tech Stack

- **Framework:** Expo SDK 58 (`~58.0.26`), React Native (`0.88.1`), React (`19.3.0`), TypeScript (`~6.0.3`)
- **Navigation:** `expo-router` (`~58.0.32`) with protected route groups (`Stack.Protected`) and `Tabs`
- **Icons:** `expo-symbols` (SF Symbols on iOS, Material Symbols on Android/Web)
- **Backend:** Firebase JS SDK (`firebase ^13.4.0` — Auth + Cloud Firestore, no native Firebase modules, no Cloud Functions)
- **State & Storage:** `zustand`, `@react-native-async-storage/async-storage`, `@react-native-community/netinfo`
- **CSV & Validation:** `papaparse`, `zod`, `expo-document-picker`
- **Seeding:** `firebase-admin`, `tsx`, `cross-env`

## Prerequisites

- Node.js 20 LTS or newer
- A Firebase account (Spark plan is sufficient)
- Firebase CLI (`npm install -g firebase-tools`, or run via `npx firebase`)
- **Expo Go** installed on an Android or iOS phone (matching Expo SDK 58)

## Setup

### 1. Clone and install dependencies

```cmd
git clone <your-repo-url>
cd gatehood
npm install
```

### 2. Create and configure the Firebase project

1. In the [Firebase Console](https://console.firebase.google.com/), create a new project.
2. Go to **Authentication -> Sign-in method** and enable:
   - **Anonymous** (for buyers)
   - **Email/Password** (for the builder)
3. Go to **Firestore Database -> Create database** (start in production mode).
4. Go to **Project Settings -> Your apps -> Add app -> Web** (`</>`), register an app, and copy the Firebase config values.
5. Copy `.env.example` to `.env` and replace the placeholder values with your Web app config:

```cmd
copy .env.example .env
```

```env
EXPO_PUBLIC_FIREBASE_API_KEY=YOUR_API_KEY
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
EXPO_PUBLIC_FIREBASE_APP_ID=1:000000000000:web:your-app-id
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=000000000000
```

### 3. Create the builder account

1. In **Authentication -> Users -> Add user**, create an Email/Password user for the builder. Any email and password works; remember them for the builder login.
2. Copy the new user's **User UID** (you will pass this as `BUILDER_UID` when running the seed script so it writes `admins/<uid>`).

### 4. Deploy Firestore rules and indexes

Point the Firebase CLI at your Firebase project (replace `your-project-id` with your project ID):

```cmd
npx firebase login
npx firebase use your-project-id
npx firebase deploy --only firestore
```

This deploys both `firestore.rules` and `firestore.indexes.json`. Note that the composite indexes on `notices` can take a few minutes to finish building in Firebase Console before feed queries succeed.

### 5. Generate a service account key and run the seed script

1. In Firebase Console, go to **Project Settings -> Service accounts -> Generate new private key**.
2. Save the downloaded JSON file as `serviceAccount.json` in the project root (it is listed in `.gitignore` and must never be committed).
3. Run the seed script, passing `GOOGLE_APPLICATION_CREDENTIALS`, `FIREBASE_PROJECT_ID`, and `BUILDER_UID`:

**Windows (`cmd`):**

```cmd
set GOOGLE_APPLICATION_CREDENTIALS=serviceAccount.json
set FIREBASE_PROJECT_ID=your-project-id
set BUILDER_UID=paste-uid-here
npm run seed
```

**macOS / Linux (`bash`/`zsh`):**

```bash
GOOGLE_APPLICATION_CREDENTIALS=./serviceAccount.json FIREBASE_PROJECT_ID=your-project-id BUILDER_UID=paste-uid-here npm run seed
```

> Run the seed once. Running it again adds another set of invites and notices rather than replacing the first. To start over, delete the `invites` and `notices` collections in the Firebase console first.

When finished, the script prints the number of seeded documents along with three sample invite codes (`Expired`, `Used`, and `Valid`).

### 6. Start Expo and open in Expo Go

```cmd
npx expo start -c
```

Scan the QR code with **Expo Go** on Android or the Camera app on iOS.

## Demo Credentials & Test Data

- **Builder login:** Use the Email and Password you created in Firebase Authentication (authorised by `admins/<BUILDER_UID>` created by `npm run seed`).
- **Buyer invite codes:** `scripts/seed.ts` creates 60 invites across towers `A`, `B`, and `C` (floors 1–5, units `x01`–`x04`) and prints one of each case at the end of its output:
  - `Expired: <code>` (`expiresAt` set 1 day in the past)
  - `Used: <code>` (`claimedBy` already set)
  - `Valid: <code>` (valid for 30 days)
- Each invite code works once. The `Valid` code printed by the seed is used up after one join, so pick any other unused code from the builder's **Buyers** tab (Tower A, B or C) for additional buyers.
- **Sample import file:** `sample-data/buyers.csv` (columns `tower,unit,name,phone,config`; `config` is optional and defaults to `3BHK`).

## How to Test

Sample import file: `sample-data/buyers.csv`

### Builder flow
1. Tap **I'm the builder** and sign in with your builder email and password.
2. In **Buyers**, tap **Import buyers CSV**, select `sample-data/buyers.csv`, and verify the new tower/unit rows appear and can be shared via the share button.
3. In **Post**, create a notice for **Whole project**, **Towers**, or **Units**, optionally toggle **Pin this notice**, and tap **Post notice**.
4. In **Notices**, verify the notice appears, tap it to expand unread buyers, and test **Pin to top** / **Unpin**.

### Buyer flow
1. Tap **Sign out** in the builder app, then tap **I'm a buyer: join with code** (or open the app on a second device).
2. Enter the **Expired** code printed by the seed script, then the **Used** code, then an invalid code (e.g. `A999-ZZZ`) to verify the validation messages.
3. Enter the **Valid** code and tap **Join**.
4. Check **My Unit** for unit, tower, configuration, tower progress %, and days to possession.
5. Open **Updates**, verify pinned notices appear first, switch between **All / My tower / My unit**, tap a notice to mark it read, scroll to **Load more**, and verify the builder's **Notices** tab updates the read count.

### Offline mode
1. Open the buyer **Updates** tab once while online so the first page (`15` notices) is cached per filter.
2. Enable Airplane Mode on the phone and reopen the **Updates** tab (or reopen the app).
3. Verify the **Offline: showing your last saved feed** banner appears above the cached notices.

## Project Structure

```text
gatehood/
├── app.json                    # Expo config (SDK 58, expo-router, splash, icons)
├── firebase.json               # Firestore rules & indexes paths
├── firestore.rules             # Security rules
├── firestore.indexes.json      # Composite indexes for notices queries
├── metro.config.js             # Metro config (.cjs support for Firebase)
├── .env.example                # Required EXPO_PUBLIC_FIREBASE_* keys
├── scripts/
│   └── seed.ts                 # Seeds project, 60 invites, 60 notices, builder admin doc
└── src/
    ├── components/
    │   └── app-icon.tsx        # Cross-platform icon wrapper (expo-symbols)
    ├── lib/
    │   ├── firebase.ts         # Firebase app, Auth (AsyncStorage persistence on native), Firestore
    │   ├── session.ts          # Zustand auth/role session store (builder / buyer / none)
    │   └── feed.ts             # Feed types, page size (15), audience key helper
    └── app/
        ├── _layout.tsx         # Root Stack with Stack.Protected role guards
        ├── index.tsx           # Role chooser (buyer join / builder login)
        ├── join.tsx            # Buyer invite code redemption transaction
        ├── builder-login.tsx   # Builder email/password sign-in
        ├── buyer/
        │   ├── _layout.tsx     # Buyer bottom tabs (My Unit, Updates)
        │   ├── index.tsx       # My Unit summary & progress
        │   └── updates.tsx     # Targeted updates feed, filters, read receipts, offline cache
        └── builder/
            ├── _layout.tsx     # Builder bottom tabs (Buyers, Post, Notices)
            ├── home.tsx        # CSV import, tower accordion, invite code sharing
            ├── compose.tsx     # Create targeted/pinned notices
            └── notices.tsx     # Sent notices, pin toggle, read count & unread buyer list
```

## Data Model & Key Design Decisions

- **`projects/main`:** `{ name, possessionDate, towerProgress: Record<string, number> }`
- **`invites/{code}`:** `{ tower, unit, name, phone, config, expiresAt, claimedBy, claimedAt }`
- **`buyers/{uid}`** (+ `reads/{noticeId}` subcollection): `{ inviteCode, tower, unit, name, phone, config, joinedAt }`
- **`notices/{id}`** (+ `reads/{uid}` subcollection): `{ title, body, pinned, createdAt, createdBy, audience: { type, towers, units }, audienceKeys: string[] }`
- **`admins/{uid}`:** Empty document whose existence grants builder permissions.

**Feed query & pagination:** `notices` stores a denormalized `audienceKeys` array containing `"all"`, `"tower:<T>"`, and/or `"unit:<T>-<U>"`. The buyer feed runs an `array-contains-any` query ordered by `pinned desc, createdAt desc` with a live `onSnapshot` listener whose `limit` increases by `15` per **Load more** tap. `firestore.indexes.json` defines two composite indexes on `notices` (one with `audienceKeys` + `pinned` + `createdAt` for buyers, and one with `pinned` + `createdAt` for the builder).

**Read tracking:** Opening a notice writes both `notices/{id}/reads/{uid}` and `buyers/{uid}/reads/{id}` in a single `writeBatch`, using the buyer UID as the document ID so reads are idempotent. The builder list displays `getCountFromServer` on `notices/{id}/reads` and computes "hasn't read" on expand by subtracting read UIDs from matching `buyers`.

**Offline cache:** Because the Firebase JS SDK has no persistent local Firestore cache on React Native, the buyer feed writes the first `15` server-fetched notices per filter to `AsyncStorage` (`feed:<uid>:<filter>`) and combines it with `NetInfo` to display an offline banner when disconnected.

## Security

Summarised from `firestore.rules`:
- **Admin-only writes:** Only UIDs present in `admins/{uid}` can create/update/delete `projects`, `notices`, or list/create/delete `invites`.
- **Single-use invite redemption:** Any signed-in user can `get` a specific `invites/{code}` (cannot `list` invites) and can update it only if `claimedBy == null`, `expiresAt > request.time`, `claimedBy` is set to `request.auth.uid`, and only `claimedBy` and `claimedAt` change.
- **Server-verified buyer profile:** Creating `buyers/{uid}` requires `request.auth.uid == uid` and uses `getAfter()` to enforce that `invites/{inviteCode}` was claimed by `uid` in the same transaction and that `tower` and `unit` match the invite. Buyers cannot update or delete their profile (`isAdmin()` only).
- **Scoped notice reads & receipts:** Buyers can read a notice only if `audienceKeys` contains `'all'`, `'tower:' + buyer().tower`, or `'unit:' + buyer().tower + '-' + buyer().unit`, and can only create/read their own `reads/{uid}` and `buyers/{uid}/reads/{nid}` docs.

## Known Limitations & Trade-Offs

- **Device-bound anonymous accounts:** Buyer sessions use Firebase Anonymous Auth persisted in `AsyncStorage`. Reinstalling the app or switching phones creates a new UID that cannot reuse an already-claimed invite code without a builder re-issue flow.
- **Short invite codes without rate limiting:** Codes use a 3-character random suffix (`TOWERUNIT-XXX`) and Firestore rules do not enforce brute-force rate limiting on `invites/{code}` lookups.
- **Client-side "hasn't read" calculation:** Expanding a notice fetches all `buyers` and `notices/{id}/reads` on the builder client, which works for hundreds of units but would require a Cloud Function or materialized counter/list at larger scale.
- **No push notifications:** Updates arrive live while the app is open via Firestore listeners; background push notifications are not implemented.
- **First-page offline cache only:** Only the latest `15` notices per filter are cached in `AsyncStorage` (older paginated pages require connectivity).
- **CSV-imported towers default to 0% progress:** Towers added via CSV have no entry in `projects/main.towerProgress` until updated in Firestore, so My Unit displays `0%` progress for them.

## Troubleshooting

- **`Missing or insufficient permissions` on buyer join or feed:** Verify `npx firebase deploy --only firestore` succeeded on the same project ID configured in `.env`, that the composite indexes in Firebase Console (**Firestore Database -> Indexes**) show **Enabled** (not **Building**), and that `buyers/<uid>` does not already exist for a previously tested anonymous UID. Right after the first deploy the feed can show an error for a few minutes until the composite index finishes building.
- **`Component auth has not been registered yet`:** Ensure `@firebase/*` packages are deduplicated (`npm dedupe`) and restart Metro cleanly with `npx expo start -c`. Use Expo Go on Android or iOS as the primary runtime.
- **`.env` changes do not take effect:** Expo inlines `EXPO_PUBLIC_*` environment variables at bundle time; restart Metro with `npx expo start -c` after editing `.env`.
