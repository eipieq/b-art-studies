# Appwrite setup for b's art studies

This app now connects to a dedicated Appwrite database that holds the chapter list, art flashcards, and response history. Follow these steps in the Appwrite console to set everything up before you start adding cards.

## 1. Create the database

1. Sign into Appwrite, create a new project or reuse the existing one you want to dedicate to the art study version.
2. Add a new **Database** (e.g., `art-memory`) and note the database ID. That value should be set as `NEXT_PUBLIC_APPWRITE_DATABASE_ID` in your `.env` file.

## 2. Collections

### Chapters collection

- **Collection ID** (used by `NEXT_PUBLIC_APPWRITE_CHAPTERS_COLLECTION_ID`): e.g., `chapters`.
- Fields:
  - `title` – **string** (required, used to label the chapter in the sidebar).

### Flashcards collection

- **Collection ID** (used by `NEXT_PUBLIC_APPWRITE_COLLECTION_ID`): e.g., `flashcards`.
- Fields (all strings unless otherwise noted):
  - `chapterId` – the Appwrite document ID for the chapter this card belongs to.
  - `question` – the prompt the learner sees (same as before).
  - `answer` – the full explanation / solution shown when the answer is revealed.
  - `artworkTitle` – optional title of the work (displayed next to the image).
  - `story` – optional short note to help memory (shown in the art sidebar).
  - `imageUrl` – optional URL pointing to a preview of the work.
  - `year`, `medium`, `movement`, `location` – optional metadata fields shown in the sidebar grid.
  - `artist` – optional artist name that can be surfaced after the answer is revealed.
  - `hints` – **array** of short clues (set this field type to `List` and choose `string` items for each entry).

You can also keep `createdAt`/`updatedAt` since Appwrite populates them automatically; they match the TypeScript types imported in `src/types/flashcards.ts`.

### Responses collection

- **Collection ID** (used by `NEXT_PUBLIC_APPWRITE_RESPONSES_COLLECTION_ID`): e.g., `responses`.
- Fields (mirrors `UserResponse`): `userId`, `flashcardId`, `chapterId`, `question`, `expectedAnswer`, `userAnswer`, `submissionType` (`text` or `image`), `imageName`, `score`, `feedback`, `createdAt`.

## 3. Environment variables

Update `.env` (or your hosting configuration) with the database/collection IDs you created:

```
NEXT_PUBLIC_APPWRITE_ENDPOINT=https://[APPWRITE_ENDPOINT]/v1
NEXT_PUBLIC_APPWRITE_PROJECT_ID=[PROJECT_ID]
NEXT_PUBLIC_APPWRITE_DATABASE_ID=[NEW_DATABASE_ID]
NEXT_PUBLIC_APPWRITE_COLLECTION_ID=[FLASHCARDS_COLLECTION_ID]
NEXT_PUBLIC_APPWRITE_CHAPTERS_COLLECTION_ID=[CHAPTERS_COLLECTION_ID]
NEXT_PUBLIC_APPWRITE_RESPONSES_COLLECTION_ID=[RESPONSES_COLLECTION_ID]
APPWRITE_SERVICE_KEY=[ADMIN_SERVICE_KEY]
```

The code expects the chapters collection to return documents with `$id` and `title`, and the flashcards collection to include `chapterId` so each card is scoped to one chapter.

## 4. Sample flashcard document

```json
{
  "chapterId": "123456789",
  "question": "Who painted this portrait of Frida Kahlo?",
  "answer": "Diego Rivera painted the 1931 portrait, combining bold colors with political symbolism about their relationship.",
  "artworkTitle": "Frida and the Painter",
  "story": "Rivera used the same red that often appears in Kahlo's self-portraits to hint that their lives were intertwined.",
  "imageUrl": "https://example.com/frida-rivera.jpg",
  "year": "1931",
  "medium": "Oil on canvas",
  "movement": "Mexican muralism",
  "location": "Palace of Fine Arts, Mexico City",
  "artist": "Diego Rivera",
  "hints": ["Mexican muralist", "Married Frida Kahlo", "Known for political murals"]
}
```

## 5. Populate data

1. Create chapters (Study Sets) first in the chapters collection.
2. Use the Appwrite console or an ingestion script to add flashcards with the fields above.
3. Once chapters and cards exist, your girlfriend can select a chapter from the sidebar and start studying the art deck.

Keep in mind that the system uses Appwrite’s `listDocuments` API with `Query.equal('chapterId', chapterId)` to fetch cards, so each card record must include an accurate `chapterId`. The responses collection is optional but recommended if you want to keep a scoring history that ties back to the learner.

## 6. Allow guests to read

- For the UI to load chapters/flashcards without logging in, each collection must also allow reads from the `guest` role (or “Any”).
- In Appwrite, open the collection editor, go to the “Permissions” tab, and add a `role:guest` (or `role:any`) permission for the “Read” action. This gives the browser client the scope it needs to run `listDocuments` without the 401.
- You still keep the write permissions scoped to `role:owner` (or your own service users) so only administrators can mutate the decks.

## 7. Admin service key

- Appwrite does not expose admin credentials to the browser, so we created `/api/admin/chapters` and `/api/admin/flashcards` to insert data securely using a service key.
- In your Appwrite project, create a service key that includes the `databases.documents.create` permission for the new database and collections (you can also add `databases.documents.read` if you want to reuse it elsewhere).
- Set the key as `APPWRITE_SERVICE_KEY` in your `.env` file (this key should never be committed).
- With the key configured, visit `/admin` in the app to submit new chapters and flashcards via the dashboard. The same UI explains what fields you can fill in and reuses the guest-friendly read permissions to populate the chapter selector.

## 8. Import format

The admin dashboard supports a JSON import (POST `/api/admin/import`)—paste an array of flashcards in the textarea at `/admin` and click “Import flashcards.” Each object must include `chapterId`, `question`, and `answer`, plus any optional metadata (`artworkTitle`, `artist`, `story`, `imageUrl`, `year`, `medium`, `movement`, `location`, `hints` where `hints` is an array of strings).

```json
[
  {
    "chapterId": "123456789",
    "question": "Which artist fused nature and abstraction in her botanical studies?",
    "answer": "Georgia O'Keeffe painted oversized flowers with close-up perspectives that made the viewer feel immersed in the petals.",
    "artist": "Georgia O'Keeffe",
    "year": "1928",
    "hints": ["American modernist", "Loved New Mexico", "Explored plant forms"]
  }
]
```

The backend validates each entry before creating documents with the service key, so errors will include the first rejected flashcard and stop the import.
