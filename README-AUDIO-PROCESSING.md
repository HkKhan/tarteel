# Audio Processing System

This document describes the audio processing system used for reciter matching in the Tajweed application.

## Overview

The audio processing pipeline includes several stages:

1. **Preprocessing**: Converting, resampling, filtering, and normalizing audio
2. **Feature Extraction**: Extracting MFCC, chroma, and other features from audio
3. **Vector Embedding**: Creating compact vector representations for similarity search
4. **Matching**: Finding similar reciters using various similarity metrics

## Key Components

### Audio Preprocessor (`lib/audio/preprocessor.ts`)

Handles initial audio cleaning and preparation:
- Resampling to 22.05kHz mono
- Silence trimming with -30dB threshold
- Peak normalization to -3dB
- Bandpass filtering (80Hz-8kHz)
- Frame splitting (20ms frames, 10ms overlap)

### Audio Processor (`lib/audio/processor.ts`)

Core feature extraction functionality:
- TensorFlow.js integration for mel spectrogram generation
- MFCC extraction (20 coefficients)
- Chroma feature extraction (12 bands)
- Temporal feature analysis
- Feature fusion with vowel emphasis

### Similarity Search (`lib/matching/similaritySearch.ts`)

Implements matching algorithms:
- Dynamic Time Warping for temporal alignment
- Cosine similarity with sliding window
- Feature-specific similarity metrics
- Tajweed aspect scoring and feedback generation

### Vector Store (`lib/supabase/vectorStore.ts`)

Handles database integration for vector search:
- pgvector integration with Supabase
- Vector storage and retrieval
- HNSW indexing for efficient search

### TensorFlow Model (`lib/tensorflowModel.ts`)

Manages the TensorFlow.js model:
- Loading and caching speech commands model
- Feature extraction via intermediate layers
- Memory management helpers

## Integration Points

### New Reciter API (`app/api/new-reciter/route.ts`)

When uploading a new reciter:
1. Accepts audio file and reciter information
2. Processes audio using the feature extraction pipeline
3. Stores the feature vector in the database

### Reciter Match API (`app/api/reciter-match/route.ts`)

When matching a user's recitation:
1. Accepts audio file (and optional preferred reciter ID)
2. Extracts features from the audio
3. Finds matching reciters using vector search
4. Generates detailed feedback on different tajweed aspects

## Frontend Integration

Both the Try page (`/try`) and New Reciter page (`/new-reciter`) work with the audio processing system:

- The Try page allows users to record and compare their recitation with renowned reciters
- The New Reciter page allows admins to add new reciters to the database

## Configuration

Audio processing parameters are defined in `config/audio.ts` and include:
- Target sample rate and other preprocessing settings
- Feature extraction parameters
- Vector dimensions
- Matching thresholds and window sizes

## Testing

To test the API integration, use the provided script:

```
node scripts/test-api-routes.js
```

Make sure to add a test MP3 file to `public/test-audio.mp3` before running the tests. 