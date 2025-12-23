# b's art studies

b's art studies is an art-study flashcard app with spaced repetition, multiple choice questions, and cloud-based progress sync. Study artworks, artists, and art history while tracking your progress across devices.

## Features

- **Spaced Repetition**: Modified SM-2 algorithm for optimal learning intervals
- **Multiple Question Types**:
  - Free-response questions with AI grading
  - Single-select MCQ (choose one answer)
  - Multi-select MCQ (select all that apply)
- **User Authentication**: Sign up/login with Appwrite Auth
- **Cloud Progress Sync**: Review progress synced across devices
- **Automatic Migration**: localStorage progress migrates to cloud when you sign up
- **Admin Dashboard**: Create and manage chapters and flashcards
- **Rich Media Support**: Images, artwork metadata, hints, and stories

## Tech Stack

- **Framework**: Next.js 16.1.1 (App Router)
- **Backend**: Appwrite (Auth, Database)
- **AI Grading**: Google Gemini API
- **Styling**: Tailwind CSS
- **Markdown**: ReactMarkdown with KaTeX for math support

## Running Locally

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Copy `.env.example` to `.env.local` and update with your credentials:

```env
# Appwrite Configuration
NEXT_PUBLIC_APPWRITE_ENDPOINT=https://fra.cloud.appwrite.io/v1
NEXT_PUBLIC_APPWRITE_PROJECT_ID=your-project-id
NEXT_PUBLIC_APPWRITE_DATABASE_ID=your-database-id
NEXT_PUBLIC_APPWRITE_COLLECTION_ID=flashcards
NEXT_PUBLIC_APPWRITE_CHAPTERS_COLLECTION_ID=chapters
NEXT_PUBLIC_APPWRITE_PROGRESS_COLLECTION_ID=user_progress
NEXT_PUBLIC_APPWRITE_RESPONSES_COLLECTION_ID=responses
NEXT_PUBLIC_APPWRITE_DEVELOPER_MODE=true

# Appwrite Admin (keep private!)
APPWRITE_SERVICE_KEY=your-service-key

# Gemini API for AI Grading
GEMINI_TEXT_MODEL=gemini-2.0-flash
GEMINI_IMAGE_MODEL=gemini-2.0-vision
GEMINI_API_KEY=your-gemini-api-key
```

### 3. Set Up Appwrite Database

See the **Appwrite Schema** section below for detailed collection setup.

### 4. Start Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### 5. Create Admin User

1. Sign up for an account through the app
2. In Appwrite Console, go to **Auth → Users**
3. Find your user and add label: `admin`
4. Now you can access `/admin` to create content

## Appwrite Schema

### Collection: `chapters`

**Attributes:**
- `title` - string(255), Required
- `createdAt` - datetime, Required
- `updatedAt` - datetime, Required

**Permissions:**
- Read: `["any"]`
- Create/Update/Delete: Admin only (via service key)

### Collection: `flashcards`

**Attributes:**

**Required:**
- `question` - string(2000), Required
- `answer` - string(10000), Required
- `chapterId` - string(255), Required, Indexed

**Optional Metadata:**
- `artworkTitle` - string(500)
- `artist` - string(255)
- `year` - string(100)
- `medium` - string(255)
- `movement` - string(255)
- `location` - string(500)
- `story` - string(5000)
- `imageUrl` - string(2000)
- `hints` - string(2000)

**MCQ Fields:**
- `questionType` - string(50), Default: `free-response`
  - Values: `free-response`, `mcq-single`, `mcq-multiple`
- `choices` - string(500)[], Array: Yes, Max: 4
- `correctChoices` - integer[], Array: Yes, Max: 4, Min: 0, Max: 3

**Timestamps:**
- `createdAt` - datetime, Required
- `updatedAt` - datetime, Required

**Indexes:**
- `idx_chapterId` - Key, chapterId (ASC)

**Permissions:**
- Read: `["any"]`
- Create/Update/Delete: Admin only (via service key)

### Collection: `user_progress`

**Attributes:**
- `userId` - string(255), Required, Indexed
- `cardId` - string(255), Required, Indexed
- `interval` - integer, Required, Default: 0
- `repetitions` - integer, Required, Default: 0
- `easeFactor` - float, Required, Default: 2.5, Min: 1.3
- `nextReview` - integer, Required (timestamp)
- `lastReviewed` - integer, Required (timestamp)
- `updatedAt` - datetime, Required
- `createdAt` - datetime, Required

**Indexes:**
- `idx_userId` - Key, userId (ASC)
- `idx_cardId` - Key, cardId (ASC)
- `idx_userId_cardId` - Unique, userId + cardId (ASC, ASC)

**Permissions (Document-level):**
- Create: `["users"]`
- Read: `["user:{userId}"]`
- Update: `["user:{userId}"]`
- Delete: `["user:{userId}"]`

### Collection: `responses` (optional - for tracking AI grading)

**Attributes:**
- `userId` - string(255), Required
- `flashcardId` - string(255), Required
- `chapterId` - string(255), Required
- `question` - string(2000), Required
- `expectedAnswer` - string(10000), Required
- `userAnswer` - string(10000), Required
- `submissionType` - string(50), Required (`text` or `image`)
- `imageName` - string(500)
- `score` - integer, Required
- `feedback` - string(10000), Required
- `createdAt` - datetime, Required

**Permissions:**
- Create: `["users"]`
- Read: Admin only
- Update/Delete: Admin only

## Admin Dashboard

Access at `/admin` (requires `admin` label on your user account).

### Creating Flashcards

**Free-Response Question:**
```
Question: What painting depicts a young woman with a pearl earring?
Answer: Girl with a Pearl Earring by Johannes Vermeer
Chapter: Dutch Golden Age
Question Type: Free Response

Optional:
- Artwork Title: Girl with a Pearl Earring
- Artist: Johannes Vermeer
- Year: 1665
- Medium: Oil on canvas
- Movement: Dutch Golden Age
- Location: Mauritshuis, The Hague
- Image URL: https://example.com/image.jpg
- Story: Background information...
- Hints: First hint, Second hint, Third hint
```

**Single-Select MCQ:**
```
Question: Which movement focused on capturing light and color?
Answer: Impressionism emphasized fleeting effects of natural light
Chapter: Art Movements
Question Type: Single-Select MCQ

Choices:
1. Impressionism ✓
2. Cubism
3. Surrealism
4. Abstract Expressionism
```

**Multi-Select MCQ:**
```
Question: Select all post-impressionist artists:
Answer: Van Gogh, Cézanne, and Gauguin were key post-impressionists
Chapter: Art Movements
Question Type: Multi-Select MCQ

Choices:
1. Vincent van Gogh ✓
2. Claude Monet
3. Paul Cézanne ✓
4. Paul Gauguin ✓
```

### Bulk Import

Send POST to `/api/admin/import` with JSON:

```json
{
  "flashcards": [
    {
      "question": "What painting depicts a young woman with a pearl earring?",
      "answer": "Girl with a Pearl Earring by Johannes Vermeer",
      "chapterId": "your-chapter-id",
      "artworkTitle": "Girl with a Pearl Earring",
      "artist": "Johannes Vermeer",
      "year": "1665",
      "medium": "Oil on canvas",
      "movement": "Dutch Golden Age",
      "location": "Mauritshuis, The Hague",
      "imageUrl": "https://example.com/image.jpg",
      "hints": ["Dutch Baroque painter", "Tronie portrait", "Blue and yellow turban"]
    },
    {
      "question": "Which movements focused on capturing light and color?",
      "answer": "Impressionism emphasized capturing fleeting effects of natural light and vibrant color.",
      "chapterId": "your-chapter-id",
      "questionType": "mcq-single",
      "choices": [
        "Impressionism",
        "Cubism",
        "Surrealism",
        "Abstract Expressionism"
      ],
      "correctChoices": [0]
    },
    {
      "question": "Select all post-impressionist artists:",
      "answer": "Vincent van Gogh, Paul Cézanne, and Paul Gauguin were key post-impressionist artists.",
      "chapterId": "your-chapter-id",
      "questionType": "mcq-multiple",
      "choices": [
        "Vincent van Gogh",
        "Claude Monet",
        "Paul Cézanne",
        "Paul Gauguin"
      ],
      "correctChoices": [0, 2, 3]
    }
  ]
}
```

## How It Works

### Spaced Repetition Algorithm

Based on the SM-2 algorithm with three quality levels:

- **Again**: Reset the card (interval = 0, ease factor -0.2)
- **Good**: Normal progression (1 day → 6 days → exponential)
- **Easy**: Faster progression (4 days → 10 days → 1.3x multiplier)

### Progress Sync

**Unauthenticated Users:**
- Progress stored in localStorage only
- No sync across devices
- Can sign up later to migrate data

**Authenticated Users:**
- Progress synced to Appwrite database
- Access from any device
- Automatic localStorage migration on signup
- Conflict resolution (most recent timestamp wins)

### MCQ Grading

- **Client-side grading**: No API calls needed
- **Visual feedback**: Green borders for correct, red for incorrect
- **Recall-first mode**: Try to recall before showing choices
- **Exact matching**: All correct answers must be selected

## Project Structure

```
src/
├── app/
│   ├── page.tsx              # Main study interface
│   ├── layout.tsx            # Root layout with providers
│   ├── admin/
│   │   ├── page.tsx          # Admin dashboard
│   │   └── layout.tsx        # Admin route guard
│   └── api/
│       ├── grade/            # AI grading endpoints
│       └── admin/            # Admin API routes
├── components/
│   ├── Navbar.tsx            # Navigation with auth
│   ├── MigrationPrompt.tsx   # Progress sync prompt
│   └── auth/                 # Auth UI components
├── contexts/
│   ├── AuthContext.tsx       # Authentication state
│   └── ProgressContext.tsx   # Progress sync logic
├── lib/
│   ├── appwrite.ts           # Appwrite client config
│   ├── progressSync.ts       # Database sync functions
│   └── migration.ts          # localStorage migration
└── types/
    ├── flashcards.ts         # Flashcard types
    ├── auth.ts               # Auth types
    └── progress.ts           # Progress types
```

## API Routes

### Public Routes
- `GET /api/grade` - Grade text answers using Gemini
- `POST /api/grade/image` - Grade image submissions

### Admin Routes (requires `admin` label)
- `POST /api/admin/chapters` - Create chapter
- `POST /api/admin/flashcards` - Create flashcard
- `POST /api/admin/import` - Bulk import flashcards

## Security

- **Authentication**: Appwrite session-based auth with HTTP-only cookies
- **Authorization**: Three-layer security (client, server API, database permissions)
- **Admin Protection**: Role-based access using Appwrite labels
- **Data Isolation**: Document-level permissions ensure users can only access their own progress
- **Service Key**: Server-side only, never exposed to client

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT
