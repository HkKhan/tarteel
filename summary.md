# Tarteel - Tajweed Matching Application

Tarteel is a web application built with Next.js that helps users improve their Quranic recitation through advanced audio analysis and comparison with expert reciters. The application uses machine learning to analyze recitation patterns and provide feedback on Tajweed pronunciation.

## Current Status

✅ **Successfully deployed to Vercel**: https://tarteel-6qhalia9d-h-ks-projects.vercel.app
✅ **Supabase Authentication implemented** with proper SSR support
✅ **Database schema** set up for users, reciters, and recitations
✅ **Audio processing** capabilities with Python backend
✅ **Modern UI** built with shadcn/ui components

## Technical Architecture

### Frontend (Next.js 15)
- **Framework**: Next.js 15 with App Router
- **UI Components**: shadcn/ui with Tailwind CSS
- **Authentication**: Supabase Auth with proper SSR implementation
- **State Management**: React hooks and local storage for client state
- **TypeScript**: Full type safety across the application

### Backend & Database
- **Database**: Supabase PostgreSQL with real-time subscriptions
- **Authentication**: Supabase Auth with email/password and OAuth
- **Storage**: Supabase Storage for audio files
- **API Routes**: Next.js API routes for data processing
- **Python Backend**: Vercel Python functions for audio analysis

### Audio Processing
- **Frontend Audio**: Web Audio API with Meyda for feature extraction
- **Backend Processing**: Python with librosa and scikit-learn
- **File Formats**: Support for various audio formats
- **Real-time Analysis**: Live audio recording and processing

## Key Features Implemented

### Authentication System
- ✅ Email/password authentication
- ✅ User profile management
- ✅ Protected routes with middleware
- ✅ Session management with proper SSR
- ✅ Sign up/sign in flow with email verification

### Dashboard
- ✅ User statistics and progress tracking
- ✅ Recitation history with scores
- ✅ Profile management interface
- ✅ Responsive design for all devices

### Audio Recording & Analysis
- ✅ Browser-based audio recording
- ✅ Real-time audio visualization
- ✅ Audio feature extraction (MFCC, spectral features)
- ✅ File upload and processing
- ✅ Audio comparison with reference reciters

### Database Schema
```sql
-- Users profiles table
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  full_name TEXT,
  username TEXT UNIQUE,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Reciters reference table
CREATE TABLE reciters (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  style TEXT,
  language TEXT DEFAULT 'arabic',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Recitations table
CREATE TABLE recitations (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  audio_url TEXT,
  surah INTEGER,
  ayah_start INTEGER,
  ayah_end INTEGER,
  reciter_id INTEGER REFERENCES reciters(id),
  overall_score DECIMAL,
  pronunciation_score DECIMAL,
  rhythm_score DECIMAL,
  melody_score DECIMAL,
  feature_vector DECIMAL[],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## Deployment Configuration

### Vercel Settings
- **Build Command**: `npm run build`
- **Install Command**: `npm install --legacy-peer-deps`
- **Node Version**: 18 (specified in .nvmrc)
- **Python Functions**: Configured for audio processing APIs

### Environment Variables Required
```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

## Recent Fixes & Improvements

### Supabase SSR Implementation
- ✅ Migrated from deprecated `@supabase/auth-helpers-nextjs` to `@supabase/ssr`
- ✅ Implemented proper cookie handling with `getAll()` and `setAll()` methods
- ✅ Created correct middleware for auth token refresh
- ✅ Fixed client-side and server-side Supabase clients

### Build & Deployment Fixes
- ✅ Resolved package manager conflicts (npm vs pnpm)
- ✅ Fixed environment variable handling during build
- ✅ Added proper error handling for server components
- ✅ Configured Vercel for optimal deployment

### Authentication Flow
- ✅ Proper middleware for route protection
- ✅ Session management across client and server
- ✅ Fallback handling for missing credentials
- ✅ Secure authentication state management