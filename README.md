# Bus Booking Admin

Next.js admin dashboard + API for college bus booking. Deploy on Vercel. Students use the Flutter app (`bus-booking-app`).

## Setup

```bash
cd bus-booking-admin
cp .env.example .env.local
# fill Firebase Admin + client + ADMIN_EMAILS + COLLEGE_EMAIL_DOMAIN
npm install
npm run dev
```

Open http://localhost:3000/login

## Deploy (Vercel)

- Root directory: `bus-booking-admin` (or this repo root if the repo is only this folder)
- Add the same env vars as `.env.local`
- Authorize the Vercel domain in Firebase Auth → Authorized domains

## Docs

- [docs/HLD.md](docs/HLD.md)
- [docs/LLD.md](docs/LLD.md) (C++ concurrency notes)

## Firebase rules

```bash
firebase deploy --only firestore:rules,firestore:indexes
```
