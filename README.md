# Harmonique

Harmonique turns a short voice recording into mood-driven procedural music in the browser.

It records audio, extracts acoustic features (ZCR, RMS, MFCCs), runs emotion inference with an ONNX model, and generates music with Tone.js. Signed-in users can save tracks, original recordings, and journal entries in Supabase, then revisit them from a profile page.

## Live Demo

[https://harmonique.vercel.app/](https://harmonique.vercel.app/)

## Features

- Record audio directly in the browser
- Detect emotion from voice with an in-browser ONNX model
- Accept the AI mood suggestion or choose a mood manually
- Generate procedural music with genre, instruments, tempo, complexity, and reverb controls
- Save generated tracks, original recordings, and journal entries
- Replay and delete saved sessions from the profile page

## How It Works

1. Record a short voice clip in the browser
2. Extract audio features with Meyda
3. Run emotion prediction with a gender-specific ONNX LSTM model
4. Select a mood (manual or AI-suggested)
5. Generate procedural music with Tone.js
6. Optionally sign in and save the session to Supabase

Emotion labels: `happy`, `sad`, `angry`, `fear`, `disgust`, `neutral`

## Tech Stack

| Layer | Tools |
|-------|--------|
| Frontend | React, TypeScript, Vite, Tailwind CSS, shadcn/ui, React Router |
| Audio / ML | Web Audio API, Meyda, ONNX Runtime Web, Tone.js |
| Backend services | Supabase Auth, Postgres, Storage |
| Model training | PyTorch (offline training and ONNX export) |

There is no custom Node/Express backend. Inference and music generation run in the browser; Supabase provides auth, database, and file storage.

## Run Locally

### Requirements

- Node.js 18+
- npm

### Install and start

```sh
npm install
npm run dev
```

Open the local Vite URL shown in the terminal.

### Production build

```sh
npm run build
npm run preview
```

## Environment Variables

Copy `.env.example` to `.env.local` and fill in your Supabase credentials:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
```

Use a Supabase **publishable** key (`sb_publishable_...`), never a secret or `service_role` key.

`.env.local` is gitignored and should not be committed. For Vercel, set the same two variables under **Project → Settings → Environment Variables**.

## Supabase Setup

For full save/history functionality, this project's Supabase backend uses:

- `music_tracks` and `journal_entries` tables, linked by `associated_track_id`
- Row Level Security enabled on both tables, with per-user policies for `SELECT`, `INSERT`, `UPDATE`, and `DELETE` scoped to `auth.uid() = user_id`, so a signed-in user can only read or modify their own rows
- A `music-tracks` storage bucket (private, accessed via time-limited signed URLs) for generated audio and original recordings

To reproduce this setup on a new Supabase project, create the two tables above, enable RLS on each, add the four per-user policies, and create a private `music-tracks` storage bucket.

The app works without sign-in for local generation. Saving history requires authentication and the setup above.

## Architecture

### Frontend flow

- `src/pages/Index.tsx` — record → mood → emotion detection → music generation
- `src/pages/Profile.tsx` — saved tracks and journal history for signed-in users

### Audio and ML pipeline

1. Browser records with Web Audio API / `MediaRecorder`
2. Meyda extracts ZCR, RMS, and MFCCs
3. `onnxruntime-web` loads models from `public/models/onnx`
4. The model predicts an emotion used to inform the music flow

### Music generation

Tone.js builds rule-based procedural music from:

- selected mood
- extracted audio features
- customization settings (genre, instruments, complexity, tempo, reverb)

Tracks can play live and be rendered to an audio file for storage.

### Persistence

Supabase handles authentication, Postgres rows, and private files in the `music-tracks` bucket.

## Project Structure

```text
src/
  components/        Feature UI and reusable components
  contexts/          Shared state (authentication)
  integrations/      Supabase client and types
  pages/             Route-level pages
  utils/             Audio analysis and music generation

public/models/onnx/  ONNX models for browser inference
ml_model/            Training, export scripts, and evaluation artifacts
```

## Notes

- Generated tracks are fixed-length clips in the current implementation
- Music generation is procedural (rule-based Tone.js), not an LLM or generative audio model
- Emotion detection uses a custom-trained LSTM exported to ONNX
