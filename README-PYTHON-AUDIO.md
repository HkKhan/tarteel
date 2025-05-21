# Python-Based Audio Processing

This project uses Python-based Vercel Edge Functions for audio processing to achieve better performance than browser-based processing. The system is designed with dual implementations for development and production environments.

## Architecture

The audio processing system consists of:

1. Frontend UI components for recording audio or uploading files
2. JavaScript utilities to encode audio as base64
3. JavaScript API routes for development/fallback
4. Python Edge Functions for production processing (much faster)
5. Database integration with Supabase for storing and retrieving embeddings

## Components

### Python Edge Functions (Production Only)

- `/api/process-recitation/route.py` - For matching recitations against existing reciters
- `/api/new-reciter-py/route.py` - For registering new reciters

### JavaScript API Routes (Development & Fallback)

- `/api/process-recitation/route.ts` - TypeScript implementation for development
- `/api/new-reciter-py/route.ts` - TypeScript implementation for development

### Frontend Integration

The JavaScript utilities in `lib/audio/recorder.ts` handle:
- Converting audio blobs to base64
- Sending data to the API endpoints
- Processing the responses

## How It Works

### Development Mode

In development mode, the system uses the TypeScript implementations which:
- Accept the same API format as the Python functions
- Use the same data structures and response formats
- Mock complex audio processing to avoid dependencies
- Actually store data in Supabase for consistency

### Production Mode

In production, Vercel routes requests to the Python Edge Functions which:
- Process audio files with librosa (much faster than browser-based processing)
- Extract high-quality audio features
- Perform vector similarity search
- Return detailed analysis results

### Recording & Matching Flow

1. The user records audio in the browser
2. The audio is converted to base64
3. The base64 data is sent to `/api/process-recitation`
4. The API processes the audio and searches for matches
5. Results are returned to the frontend

### Adding New Reciters Flow

1. The user uploads an audio file
2. The file is converted to base64
3. The data is sent to `/api/new-reciter-py`
4. The API processes the audio and stores it
5. The feature vector and metadata are saved to the database

## Development Setup

### Requirements

- Python 3.9 or higher
- Vercel CLI for local development
- Supabase project with pgvector extension
- Node.js and npm/yarn

### Local Development

1. Install JavaScript dependencies:
   ```
   npm install
   ```

2. Install Python dependencies (for deployment):
   ```
   pip install -r requirements.txt
   ```

3. Set up environment variables:
   ```
   SUPABASE_URL=your-supabase-url
   SUPABASE_KEY=your-supabase-key
   ```

4. Run the development server:
   ```
   npm run dev
   ```

### Deploying to Production

Deploy to Vercel as usual. The Vercel configuration will route requests to the Python Edge Functions.

```
vercel --prod
```

## Configuration

The `vercel.json` file contains configuration for the Python Edge Functions:

```json
{
  "functions": {
    "app/api/process-recitation/route.py": {
      "runtime": "python3.9",
      "memory": 1024
    },
    "app/api/new-reciter-py/route.py": {
      "runtime": "python3.9",
      "memory": 1024
    }
  },
  "routes": [
    { "src": "/api/process-recitation", "dest": "/api/process-recitation/route.py" },
    { "src": "/api/new-reciter-py", "dest": "/api/new-reciter-py/route.py" }
  ]
}
```

## Troubleshooting

- If you encounter memory issues, increase the memory allocation in `vercel.json`
- For performance issues, consider using a larger instance size for the Edge Functions
- If the Python functions aren't being called in production, check the Vercel build logs 