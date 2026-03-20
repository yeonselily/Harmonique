# Harmonique

Harmonique is a browser-based audio experience that turns a recorded voice clip into a mood-driven music track. The app records audio in the browser, extracts features such as ZCR, RMS, and MFCCs, runs emotion inference with an ONNX model, and generates procedural music from the detected characteristics and selected mood.

Users can also sign in to save generated tracks, original recordings, and journal entries to Supabase, then revisit or delete them later from the profile page.

## Features

- Record audio directly in the browser
- Detect emotion from voice audio using an ONNX model in the frontend
- Choose a mood manually or use the AI suggestion
- Generate procedural music with customizable settings
- Save generated tracks, original recordings, and journal entries
- Replay and delete saved sessions from the profile page

## Run Locally

### Requirements

- Node.js 18+ recommended
- npm

### Install and start

```sh
npm install
npm run dev
```

After the dev server starts, open the local Vite URL shown in the terminal.

### Build for production

```sh
npm run build
npm run preview
```

## Supabase Setup

This project uses Supabase for authentication, database storage, and audio file storage.

For full functionality, your Supabase project should include:

- A `music_tracks` table
- A `journal_entries` table
- Row Level Security policies so users can only access their own data
- A `music-tracks` storage bucket for generated music and original recordings

This repo currently points to a configured Supabase project through `src/integrations/supabase/client.ts`. If you want to connect your own Supabase project, update that client configuration and apply the matching schema and storage policies.

## Tech Stack

- React
- TypeScript
- Vite
- Tailwind CSS
- shadcn/ui
- React Router
- Supabase Auth, Postgres, and Storage
- Web Audio API
- Meyda for audio feature extraction
- ONNX Runtime Web for in-browser inference
- Tone.js for procedural music generation
- PyTorch for model training and ONNX export

## High-Level Architecture

### Frontend

The app is a single-page React application built with Vite and TypeScript. The main user flow lives in the homepage and profile page:

- `src/pages/Index.tsx` handles recording, mood selection, emotion detection, and music generation
- `src/pages/Profile.tsx` shows saved tracks and journal history for the signed-in user

### Audio and ML pipeline

1. The browser records audio with the Web Audio API and `MediaRecorder`
2. `Meyda` extracts audio features such as:
   - Zero Crossing Rate (ZCR)
   - Root Mean Square (RMS)
   - Mel-Frequency Cepstral Coefficients (MFCCs)
3. `onnxruntime-web` loads the exported emotion model from `public/models/onnx`
4. The model predicts an emotion label used to inform the music flow

### Music generation

`Tone.js` creates rule-based procedural music from:

- the selected mood
- extracted audio features
- customization settings such as genre, instruments, complexity, tempo, and reverb

The app can play this music live and also render a saved audio file for storage and replay.

### Persistence

Supabase is used for:

- authentication
- structured data in Postgres
- private audio file storage in the `music-tracks` bucket

There is currently no custom Express or Node backend. Inference and generation run directly in the browser, while Supabase provides the hosted backend services.

## Project Structure

```text
src/
  components/        Reusable UI and feature components
  contexts/          Shared app state such as authentication
  integrations/      Supabase client and generated types
  pages/             Route-level pages
  utils/             Audio analysis and music generation logic

public/models/onnx/  ONNX model files used in the browser
ml_model/            Training/export-related scripts and checkpoints
```

## Notes

- Emotion detection currently supports these labels: `happy`, `sad`, `angry`, `fear`, `disgust`, and `neutral`
- Generated tracks are rendered as a fixed-length audio clip in the current implementation
- The app works without sign-in for local generation, but saving history requires authentication and Supabase setup

## Live Demo 
Deployed on Vercel: https://harmonique.vercel.app/