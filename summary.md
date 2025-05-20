# Tajweed Matcher Project Summary

## Project Overview
Tajweed Matcher is a Next.js application designed to help users improve their Quranic recitation by:

1. Capturing a voice sample (recitation of Surah Al-Fatiha)
2. Analyzing voice characteristics 
3. Matching the user with a classical reciter based on voice similarity
4. Providing specific, actionable feedback to improve recitation style

## Tech Stack
- **Framework**: Next.js 15 with React 19
- **Styling**: Tailwind CSS with shadcn/ui components
- **Authentication**: Supabase Auth
- **Database**: Supabase PostgreSQL
- **Storage**: Supabase Storage (for audio files)

## Main Features
1. **User Authentication** - Sign up/login system via Supabase Auth
2. **Voice Recording** - Browser-based audio recording using Web Audio API
3. **Recitation Analysis** - Voice pattern matching (simulated in current version)
4. **Reciter Matching** - Pairing users with classical reciters based on voice characteristics
5. **Dashboard** - Tracking progress and history of recitations

## Project Structure
- **app/** - Next.js app router pages
  - **page.tsx** - Landing page with introduction to the app
  - **record/** - Recording interface for capturing recitations
  - **dashboard/** - User dashboard showing history and progress
  - **auth/** - Authentication pages (signin/signup)
- **components/** - Reusable React components
  - **ui/** - Base UI components (shadcn/ui)
  - **recording/** - Components for audio recording
  - **auth/** - Authentication-related components
  - **dashboard/** - Dashboard-specific components
- **lib/** - Utility functions and services
  - **supabase/** - Supabase client configuration

## Database Schema
The application uses several tables in Supabase:
1. **profiles** - User profile information
2. **reciters** - Information about classical Quran reciters
3. **recitations** - User's recitation history with analysis metrics

## Future Development
- Implement actual voice analysis using audio processing algorithms or AI
- Add more reciters and detailed recitation style guides
- Implement detailed feedback with specific tajweed rules
- Add waveform visualization during recording