# b's art studies

b's art studies is an art-study version of Alpha Pi: a set of interactive flashcards that help you memorize works, artists, and techniques while keeping the experience light and visual.

## Running locally

1. Copy `.env.example` to `.env` and update the Appwrite endpoints + Gemini API keys, plus point to the new art-focused database/collections.
2. `npm install` to restore dependencies.
3. Run `npm run dev` to start the Next.js server.

The `src/app/page.tsx` view connects to Appwrite for chapters/flashcards and also POSTs to `/api/grade` and `/api/grade/image`, so make sure your environment exposes the Gemini keys referenced in `src/app/api/grade`.

## Appwrite schema reference

Use [docs/appwrite-art.md](./docs/appwrite-art.md) as a checklist when you create the new database/collections and set the matching environment variables.

## Admin dashboard

Set `APPWRITE_SERVICE_KEY` to the service key you created for the database, then hit `/admin` in the browser to publish chapters and flashcards through the new dashboard. The server routes at `/api/admin/chapters` and `/api/admin/flashcards` exist solely to insert documents through that key, so make sure the key stays private.
