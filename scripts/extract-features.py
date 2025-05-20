"""
Script to extract real MFCC features from reciter audio files and update the database
Run with: python scripts/extract-features.py
"""

import os
import sys
import json
import numpy as np
import librosa
import supabase
import dotenv
from glob import glob
from pathlib import Path

# Load environment variables
dotenv.load_dotenv()

SUPABASE_URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("Error: Missing environment variables. Please set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY")
    sys.exit(1)

# Initialize Supabase client
sb_client = supabase.create_client(SUPABASE_URL, SUPABASE_KEY)

def extract_mfcc_features(audio_path):
    """Extract MFCC features from an audio file"""
    try:
        # Load audio file
        print(f"Loading audio: {audio_path}")
        y, sr = librosa.load(audio_path, sr=None)  # Use native sample rate
        
        print(f"Audio loaded: {len(y)} samples, {sr}Hz, {len(y)/sr:.2f} seconds")
        
        # Set parameters
        n_mfcc = 13
        frame_length = 1024
        hop_length = 512
        
        # Extract MFCCs
        mfccs = librosa.feature.mfcc(
            y=y, 
            sr=sr, 
            n_mfcc=n_mfcc,
            n_fft=frame_length,
            hop_length=hop_length
        )
        
        # Convert to frames x coefficients format (transpose)
        mfccs = mfccs.T
        
        # Calculate mean and standard deviation of MFCCs
        mfcc_means = np.mean(mfccs, axis=0).tolist()
        mfcc_stddevs = np.std(mfccs, axis=0).tolist()
        
        print(f"Extracted {mfccs.shape[0]} MFCC frames, {len(mfcc_means)} coefficients")
        
        # Return feature vector with limited frames to keep size reasonable
        return {
            "mfccs": mfccs[:100].tolist(),  # Limit to 100 frames
            "mfccMeans": mfcc_means,
            "mfccStdDevs": mfcc_stddevs,
            "sampleRate": sr,
            "frameSize": frame_length,
            "hopSize": hop_length,
            "frameCount": mfccs.shape[0],
            "metadata": {
                "coefficientCount": n_mfcc,
                "duration": len(y) / sr,
                "extractionMethod": "librosa"
            }
        }
    except Exception as e:
        print(f"Error extracting features: {e}")
        raise

def extract_combined_features(reciter_path):
    """Extract and combine features from all 7 ayahs of Surah Al-Fatiha"""
    # List all audio files for each ayah (1-7)
    ayah_files = sorted([
        reciter_path / f"00100{i}.mp3" for i in range(1, 8)
    ])
    
    # Check if all files exist
    missing_files = [f for f in ayah_files if not f.exists()]
    if missing_files:
        print(f"  Missing ayah files: {', '.join(str(f) for f in missing_files)}")
        if len(missing_files) > 3:  # If too many files are missing, skip
            return None
    
    # Only process existing files
    ayah_files = [f for f in ayah_files if f.exists()]
    if not ayah_files:
        return None
        
    print(f"  Processing {len(ayah_files)} ayahs")
    
    # Extract MFCCs for each ayah
    all_mfccs = []
    total_duration = 0
    sample_rate = 0
    
    for i, ayah_file in enumerate(ayah_files):
        try:
            print(f"  Loading ayah {i+1}: {ayah_file.name}")
            # Load audio
            y, sr = librosa.load(str(ayah_file), sr=None)
            
            # Extract MFCCs
            n_mfcc = 13
            frame_length = 1024
            hop_length = 512
            
            mfccs = librosa.feature.mfcc(
                y=y, 
                sr=sr, 
                n_mfcc=n_mfcc,
                n_fft=frame_length,
                hop_length=hop_length
            ).T  # Transpose to frames x coefficients
            
            all_mfccs.append(mfccs)
            total_duration += len(y) / sr
            sample_rate = sr
            
            print(f"    Extracted {mfccs.shape[0]} frames from ayah {i+1}")
        except Exception as e:
            print(f"    Error processing ayah {i+1}: {e}")
            # Continue with other ayahs
    
    if not all_mfccs:
        print("  Failed to extract features from any ayah")
        return None
    
    # Combine all MFCCs
    combined_mfccs = np.vstack(all_mfccs)
    
    # Calculate mean and standard deviation across all frames
    mfcc_means = np.mean(combined_mfccs, axis=0).tolist()
    mfcc_stddevs = np.std(combined_mfccs, axis=0).tolist()
    
    # Sample at most 300 frames (to keep size reasonable)
    if combined_mfccs.shape[0] > 300:
        # Take evenly spaced samples
        indices = np.linspace(0, combined_mfccs.shape[0] - 1, 300, dtype=int)
        sampled_mfccs = combined_mfccs[indices]
    else:
        sampled_mfccs = combined_mfccs
    
    print(f"  Combined features: {combined_mfccs.shape[0]} frames, sampled to {sampled_mfccs.shape[0]}")
    
    return {
        "mfccs": sampled_mfccs.tolist(),
        "mfccMeans": mfcc_means,
        "mfccStdDevs": mfcc_stddevs,
        "sampleRate": sample_rate,
        "frameSize": frame_length,
        "hopSize": hop_length,
        "frameCount": combined_mfccs.shape[0],
        "metadata": {
            "coefficientCount": n_mfcc,
            "duration": total_duration,
            "extractionMethod": "librosa",
            "ayahCount": len(all_mfccs)
        }
    }

def process_reciters():
    """Process all reciter directories and update database"""
    # Path to reciter directories
    base_dir = Path(os.getcwd())
    fatiha_dir = base_dir / "public" / "everyayah_fatiha"
    
    # Get all reciter directories
    reciter_dirs = [p for p in fatiha_dir.iterdir() if p.is_dir()]
    print(f"Found {len(reciter_dirs)} reciter directories")
    
    # Process each reciter
    for reciter_path in reciter_dirs:
        reciter_dir = reciter_path.name
        reciter_name = reciter_dir.replace("_", " ")
        
        print(f"\nProcessing {reciter_name}")
        
        try:
            # Extract combined features from all ayahs
            features = extract_combined_features(reciter_path)
            
            if not features:
                print(f"  Could not extract features for {reciter_name}, skipping")
                continue
            
            # Store the MFCC features directly in feature_vector
            # No more means/variances structure
            feature_vector = features["mfccs"]
            
            # Get reciter from database
            response = sb_client.table("reciters").select("id, name").eq("name", reciter_name).execute()
            
            reciters = response.data
            
            if reciters and len(reciters) > 0:
                # Update existing reciter
                update_response = sb_client.table("reciters").update({
                    "feature_vector": feature_vector
                }).eq("id", reciters[0]["id"]).execute()
                
                if hasattr(update_response, 'error') and update_response.error:
                    print(f"  Error updating feature vector: {update_response.error}")
                else:
                    print(f"  Updated feature vector for {reciter_name}")
            else:
                # Insert new reciter
                insert_response = sb_client.table("reciters").insert({
                    "name": reciter_name,
                    "feature_vector": feature_vector
                }).execute()
                
                if hasattr(insert_response, 'error') and insert_response.error:
                    print(f"  Error inserting reciter: {insert_response.error}")
                else:
                    print(f"  Inserted new reciter {reciter_name}")
        except Exception as e:
            print(f"  Error processing {reciter_name}: {e}")
    
    print("\nFeature extraction and database update complete")

if __name__ == "__main__":
    process_reciters() 