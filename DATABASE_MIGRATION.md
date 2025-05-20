# Database Migration Guide

This document outlines the steps to add missing columns to the `reciters` table in the Supabase database.

## Background

The application requires two columns that were missing in the `reciters` table:
1. `profile_image_url` - Stores the URL to the reciter's profile image
2. `feature_vector` - Stores the MFCC feature vector data used for audio matching

## Migration Steps

### 1. Apply SQL Migration

Run the migration script in the Supabase SQL Editor:

1. Go to your Supabase project dashboard
2. Navigate to the SQL Editor
3. Copy and paste the contents of `migration.sql` into the editor
4. Run the script

The migration script automatically checks if columns exist before trying to add them to avoid errors.

### 2. Update TypeScript Types

The TypeScript type definitions in `lib/database.types.ts` have been updated to include the new columns.

### 3. Generate Feature Vectors

After adding the columns, run the feature vector generation script to populate the data for existing reciters:

```bash
npx ts-node scripts/generate-feature-vectors.ts
```

This script:
- Finds all reciters without feature vectors
- Generates mock feature vectors (in a real implementation, these would be based on audio analysis)
- Updates each reciter record with the generated vector

### 4. Server-Side Functions Fix

The API implementation has been modified to avoid using client-side functions on the server:

- The functions `calculateSimilarity` and `generateTajweedFeedback` were moved from the client-side module to the server API route
- This resolves the error: `Error: Attempted to call calculateSimilarity() from the server but calculateSimilarity is on the client`
- In a production implementation, you may want to create a shared utilities directory with isomorphic versions of these functions

## Verifying the Migration

To verify the migration was successful:

1. Check that the `profile_image_url` and `feature_vector` columns exist in the `reciters` table
2. Run the application and test the recording feature to ensure it can match with reciters
3. Verify that no "column does not exist" errors appear in the logs

## Troubleshooting

If you encounter issues:

1. Check the Supabase database logs for SQL errors
2. Verify that the columns were added correctly using the Supabase table editor
3. Ensure the TypeScript types match the actual database schema
4. Check that the feature vector format matches what the matching algorithm expects

## Notes for Future Development

In a production environment, you would want to:

1. Implement proper audio analysis to generate real feature vectors from reciter samples
2. Add a more sophisticated matching algorithm that considers various aspects of recitation
3. Optimize the feature vector storage format for efficient querying 