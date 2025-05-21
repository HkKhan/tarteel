import numpy as np
import os
import tempfile
import base64
import librosa
import scipy.signal
from fastdtw import fastdtw
from scipy.spatial.distance import euclidean
from sklearn.preprocessing import StandardScaler
import json
import sys
import argparse

def process_audio(audio_base64, audio_type='audio/mpeg', segment=True):
    """
    Process audio data to extract features for reciter matching.
    
    Args:
        audio_base64: Base64 encoded audio data
        audio_type: MIME type of the audio (default: 'audio/mpeg')
        segment: Whether to segment the audio into verses/ayat (default: True)
        
    Returns:
        Dictionary containing the extracted features and processed data
    """
    # Convert base64 to binary
    audio_data = base64.b64decode(audio_base64.split(',')[1] if ',' in audio_base64 else audio_base64)
    
    # Determine file extension based on audio type
    if audio_type == 'audio/wav' or audio_type == 'audio/wave':
        file_extension = '.wav'
    elif audio_type == 'audio/mp3' or audio_type == 'audio/mpeg':
        file_extension = '.mp3'
    else:
        # Default to mp3 for other types
        file_extension = '.mp3'
    
    # Save to temp file for librosa to read
    with tempfile.NamedTemporaryFile(delete=False, suffix=file_extension) as temp_file:
        temp_filename = temp_file.name
        temp_file.write(audio_data)
    
    try:
        # Load audio with librosa
        y, sr = librosa.load(temp_filename, sr=22050)
        
        # Delete temp file
        os.unlink(temp_filename)
        
        # Extract segments if requested
        segments = []
        if segment:
            segments = segment_audio(y, sr)
        
        # Apply voice normalization
        y_normalized = apply_voice_normalization(y, sr)
        
        # Extract core features
        mfccs = librosa.feature.mfcc(y=y_normalized, sr=sr, n_mfcc=20)
        chroma = librosa.feature.chroma_stft(y=y_normalized, sr=sr)
        mel_spec = librosa.feature.melspectrogram(y=y_normalized, sr=sr, n_mels=128)
        tempo = librosa.feature.tempogram(y=y_normalized, sr=sr)
        
        # Extract recitation-specific features
        pitch_contour = extract_pitch_contour(y_normalized, sr)
        formants = extract_formants(y_normalized, sr)
        pause_patterns = extract_pause_patterns(y_normalized, sr)
        
        # Create temporal sequence feature representation
        sequence_features = create_sequence_features(mfccs, chroma, pitch_contour)
        
        # Create aggregated feature vector (for first-stage matching)
        feature_vector = np.concatenate([
            np.mean(mfccs, axis=1),         # Mean of each MFCC coefficient
            np.std(mfccs, axis=1),          # Std dev of each MFCC coefficient
            np.mean(chroma, axis=1),        # Mean of each chroma bin
            np.mean(mel_spec, axis=1)[:20], # Mean of first 20 mel bands
            np.mean(tempo, axis=1)[:20],    # Mean of first 20 tempo features
            np.array([np.mean(pitch_contour)]),  # Mean pitch as 1D array
            np.array([np.std(pitch_contour)]),   # Pitch variation as 1D array
            np.mean(formants, axis=1),      # Mean formant values
            np.array([np.mean(pause_patterns)])  # Pause pattern features as 1D array
        ])
        
        # Normalize the feature vector
        normalized_vector = feature_vector / np.linalg.norm(feature_vector)
        
        return {
            'feature_vector': normalized_vector.tolist(),  # For first-stage matching
            'sequence_features': sequence_features.tolist(),  # For second-stage DTW matching
            'segments': [seg.tolist() for seg in segments] if segments else [],
            'mfccs': mfccs.tolist(),
            'chroma': chroma.tolist(),
            'mel_spec': mel_spec.tolist(),
            'pitch_contour': pitch_contour.tolist(),
            'formants': formants.tolist(),
            'pause_patterns': pause_patterns.tolist(),
            'feature_shapes': {
                'mfcc_shape': mfccs.shape,
                'chroma_shape': chroma.shape,
                'mel_shape': mel_spec.shape,
                'vector_dimension': len(normalized_vector)
            }
        }
        
    except Exception as e:
        # Ensure temp file is deleted in case of error
        if os.path.exists(temp_filename):
            os.unlink(temp_filename)
        raise e

def apply_voice_normalization(y, sr):
    """
    Apply voice normalization techniques:
    - Vocal Tract Length Normalization (VTLN)
    - Cepstral Mean and Variance Normalization (CMVN)
    
    Args:
        y: Audio signal
        sr: Sample rate
        
    Returns:
        Normalized audio signal
    """
    # Simple VTLN approximation - warp the frequency spectrum
    # In real implementation, this would involve estimating a warping factor
    # For simplicity, we'll use a fixed warping factor here
    alpha = 0.95  # warping factor between 0.9-1.1 typically
    
    # Apply pre-emphasis as a simple form of spectral shaping
    y_preemph = librosa.effects.preemphasis(y)
    
    # For a true VTLN implementation, you would:
    # 1. Compute STFT
    # 2. Apply frequency warping to the spectrum
    # 3. Inverse STFT
    # This is simplified for demonstration
    
    # Apply CMVN-like normalization by standardizing the audio
    y_norm = y_preemph - np.mean(y_preemph)
    if np.std(y_preemph) > 0:
        y_norm = y_norm / np.std(y_preemph)
    
    return y_norm

def segment_audio(y, sr):
    """
    Segment audio into verses/ayat based on silence detection.
    
    Args:
        y: Audio signal
        sr: Sample rate
        
    Returns:
        List of segment feature arrays
    """
    # Detect silence to find potential verse boundaries
    intervals = librosa.effects.split(y, top_db=30)
    
    # Minimum length for a valid segment (in frames)
    min_length = sr * 0.5  # 500ms
    
    segments = []
    for start, end in intervals:
        if end - start > min_length:
            # For each significant segment, extract features
            segment = y[start:end]
            mfccs = librosa.feature.mfcc(y=segment, sr=sr, n_mfcc=13)
            segments.append(np.mean(mfccs, axis=1))
    
    return segments

def extract_pitch_contour(y, sr):
    """
    Extract pitch contour for tajweed analysis.
    
    Args:
        y: Audio signal
        sr: Sample rate
        
    Returns:
        Array of pitch values
    """
    # Use librosa's pitch tracking
    pitches, magnitudes = librosa.core.piptrack(y=y, sr=sr)
    
    # For each frame, find the pitch with highest magnitude
    pitch_contour = []
    for t in range(pitches.shape[1]):
        index = magnitudes[:,t].argmax()
        pitch_contour.append(pitches[index,t])
    
    # Convert to numpy array
    pitch_contour = np.array(pitch_contour)
    
    # Filter out unreliable pitch estimates
    pitch_contour[pitch_contour <= 0] = 0
    
    # Ensure we have at least one valid element
    if len(pitch_contour) == 0 or np.all(pitch_contour == 0):
        pitch_contour = np.array([0.0])
    
    return pitch_contour

def extract_formants(y, sr, n_formants=3):
    """
    Extract formants to capture voice characteristics.
    
    Args:
        y: Audio signal
        sr: Sample rate
        n_formants: Number of formants to extract
        
    Returns:
        Array of formant frequencies
    """
    # Pre-emphasis to enhance high frequencies
    y_preemph = librosa.effects.preemphasis(y)
    
    # Frame the signal
    frame_length = int(sr * 0.025)  # 25ms frames
    hop_length = int(sr * 0.01)     # 10ms hop
    
    # Calculate LPC coefficients (approximates vocal tract)
    n_lpc = 2 + n_formants * 2  # Rule of thumb for LPC order
    formants = np.zeros((n_formants, len(range(0, len(y_preemph) - frame_length, hop_length))))
    
    for i, frame in enumerate(range(0, len(y_preemph) - frame_length, hop_length)):
        frame_data = y_preemph[frame:frame + frame_length]
        # Apply window
        frame_data = frame_data * scipy.signal.windows.hamming(len(frame_data))
        
        # LPC analysis
        try:
            a = librosa.lpc(frame_data, n_lpc)
            
            # Find roots of the polynomial
            roots = np.polynomial.polynomial.polyroots(a)
            
            # Keep only the stable roots
            roots = [r for r in roots if np.abs(r) < 1]
            
            # Calculate angles for the roots
            angles = np.angle(roots)
            
            # Convert angles to frequencies and sort
            freqs = np.abs(angles) * sr / (2 * np.pi)
            freqs = sorted(freqs)
            
            # Store up to n_formants
            for j in range(min(n_formants, len(freqs))):
                formants[j, i] = freqs[j]
        except:
            # If LPC analysis fails, use zeros
            pass
    
    return formants

def extract_pause_patterns(y, sr):
    """
    Extract pause patterns which are critical for recognizing reciters.
    
    Args:
        y: Audio signal
        sr: Sample rate
        
    Returns:
        Array characterizing pauses
    """
    # RMS energy
    hop_length = int(sr * 0.01)  # 10ms hop
    rms = librosa.feature.rms(y=y, hop_length=hop_length)[0]
    
    # Find pauses (low energy segments)
    threshold = 0.05 * np.max(rms)  # Adaptive threshold
    is_pause = (rms < threshold).astype(np.int8)
    
    # Calculate pause statistics
    pause_lengths = []
    current_pause = 0
    
    for i in range(len(is_pause)):
        if is_pause[i] == 1:
            current_pause += 1
        elif current_pause > 0:
            pause_lengths.append(current_pause)
            current_pause = 0
    
    if current_pause > 0:
        pause_lengths.append(current_pause)
    
    # Create pause features
    if pause_lengths:
        pause_features = np.array([
            len(pause_lengths),             # Number of pauses
            np.mean(pause_lengths),         # Average pause length
            np.std(pause_lengths) if len(pause_lengths) > 1 else 0,  # Pause length variation
            np.max(pause_lengths) if pause_lengths else 0,           # Longest pause
        ])
    else:
        pause_features = np.zeros(4)
    
    return pause_features

def create_sequence_features(mfccs, chroma, pitch):
    """
    Create a temporal sequence representation for DTW matching.
    
    Args:
        mfccs: MFCC features
        chroma: Chroma features
        pitch: Pitch contour
        
    Returns:
        Sequence feature array
    """
    # Use a subset of features to keep the sequence matrix manageable
    sequence_length = min(mfccs.shape[1], len(pitch))
    
    # Create a matrix where each column is a time frame and rows are features
    sequence = np.zeros((mfccs.shape[0] + 4, sequence_length))
    
    # Add MFCCs
    sequence[:mfccs.shape[0], :mfccs.shape[1]] = mfccs[:, :sequence_length]
    
    # Add key chroma features
    chroma_features = np.mean(chroma, axis=0)[:sequence_length]
    if len(chroma_features) > 0:
        sequence[-4, :len(chroma_features)] = chroma_features
    
    # Add pitch features
    if len(pitch) > 0:
        sequence[-3, :min(len(pitch), sequence_length)] = pitch[:sequence_length]
    
    # Add pitch derivative (change)
    if len(pitch) > 1:
        pitch_diff = np.diff(pitch, prepend=pitch[0])[:sequence_length]
        sequence[-2, :min(len(pitch_diff), sequence_length)] = pitch_diff
    
    # Add energy envelope
    energy = np.sqrt(np.sum(mfccs**2, axis=0))[:sequence_length]
    sequence[-1, :len(energy)] = energy
    
    return sequence

def calculate_similarity(vector1, vector2, method="combined", sequence1=None, sequence2=None):
    """
    Calculates similarity using a weighted approach of cosine similarity and DTW.
    
    Args:
        vector1: First feature vector for quick matching
        vector2: Second feature vector for quick matching
        method: Similarity method ("cosine", "dtw", or "combined")
        sequence1: First sequence features for DTW (optional)
        sequence2: Second sequence features for DTW (optional)
        
    Returns:
        Float representing similarity score (0 to 1)
    """
    # Convert lists to numpy arrays if needed
    if isinstance(vector1, list):
        vector1 = np.array(vector1)
    if isinstance(vector2, list):
        vector2 = np.array(vector2)
    
    # Stage 1: Cosine similarity (fast matching)
    cosine_sim = np.dot(vector1, vector2)
    
    if method == "cosine" or sequence1 is None or sequence2 is None:
        return float(cosine_sim)
    
    # Convert sequences to numpy arrays if needed
    if isinstance(sequence1, list):
        sequence1 = np.array(sequence1)
    if isinstance(sequence2, list):
        sequence2 = np.array(sequence2)
    
    # Stage 2: DTW for temporal alignment (if sequences provided)
    if method in ["dtw", "combined"]:
        try:
            # Select subset of frames to make DTW computation more efficient
            step = max(1, min(sequence1.shape[1], sequence2.shape[1]) // 100)
            seq1_subset = sequence1[:, ::step]
            seq2_subset = sequence2[:, ::step]
            
            # Transpose to have time as first dimension
            seq1_subset = seq1_subset.T 
            seq2_subset = seq2_subset.T
            
            # Calculate DTW distance
            distance, _ = fastdtw(seq1_subset, seq2_subset, dist=euclidean)
            
            # Normalize DTW distance
            max_len = max(seq1_subset.shape[0], seq2_subset.shape[0])
            normalized_dist = 1.0 - (distance / (max_len * seq1_subset.shape[1]))
            dtw_sim = max(0.0, normalized_dist)  # Ensure non-negative
            
            if method == "dtw":
                return float(dtw_sim)
            else:  # combined
                # Weighted combination of cosine and DTW
                # Weight sequence-preserving features (DTW) higher
                return float(0.4 * cosine_sim + 0.6 * dtw_sim)
        except Exception as e:
            # Fall back to cosine similarity if DTW fails
            print(f"DTW failed: {e}. Falling back to cosine similarity.")
            return float(cosine_sim)
    
    # Default: return cosine similarity
    return float(cosine_sim)

def compare_segments(segments1, segments2):
    """
    Compare corresponding segments between two recitations.
    
    Args:
        segments1: List of segment features for first recitation
        segments2: List of segment features for second recitation
        
    Returns:
        Average similarity across matched segments
    """
    if not segments1 or not segments2:
        return 0.0
    
    # Convert lists to numpy arrays if needed
    segments1 = [np.array(seg) if isinstance(seg, list) else seg for seg in segments1]
    segments2 = [np.array(seg) if isinstance(seg, list) else seg for seg in segments2]
    
    # Match segments using DTW to align them
    if len(segments1) >= len(segments2):
        reference, query = segments1, segments2
    else:
        reference, query = segments2, segments1
    
    # Build a similarity matrix
    sim_matrix = np.zeros((len(reference), len(query)))
    for i, ref_seg in enumerate(reference):
        for j, q_seg in enumerate(query):
            sim_matrix[i, j] = np.dot(ref_seg / np.linalg.norm(ref_seg), 
                                      q_seg / np.linalg.norm(q_seg))
    
    # Find best matches using dynamic programming
    similarities = []
    used_indices = set()
    
    for j in range(len(query)):
        best_sim = -1
        best_idx = -1
        
        for i in range(len(reference)):
            if i not in used_indices and sim_matrix[i, j] > best_sim:
                best_sim = sim_matrix[i, j]
                best_idx = i
        
        if best_idx >= 0:
            used_indices.add(best_idx)
            similarities.append(best_sim)
    
    # Calculate average similarity across matched segments
    return float(np.mean(similarities) if similarities else 0.0)

def two_stage_matcher(sample1, sample2):
    """
    Implements the two-stage matching process.
    
    Args:
        sample1: First audio sample features dictionary
        sample2: Second audio sample features dictionary
    
    Returns:
        Dictionary with similarity scores and match details
    """
    # Stage 1: Fast matching using feature vectors
    vector1 = np.array(sample1['feature_vector'])
    vector2 = np.array(sample2['feature_vector'])
    
    cosine_sim = calculate_similarity(vector1, vector2, method="cosine")
    
    # If Stage 1 similarity is too low, we can skip Stage 2
    if cosine_sim < 0.5:  # Threshold can be adjusted
        return {
            'similarity': float(cosine_sim),
            'method': 'cosine_only',
            'stage': 1
        }
    
    # Stage 2: Detailed matching with DTW
    sequence1 = np.array(sample1['sequence_features'])
    sequence2 = np.array(sample2['sequence_features'])
    
    combined_sim = calculate_similarity(
        vector1, vector2, 
        method="combined", 
        sequence1=sequence1, 
        sequence2=sequence2
    )
    
    # Stage 3 (optional): Segment comparison if available
    segment_sim = 0.0
    if sample1.get('segments') and sample2.get('segments'):
        segment_sim = compare_segments(sample1['segments'], sample2['segments'])
        
        # Weighted combination of both similarity methods
        final_sim = 0.3 * combined_sim + 0.7 * segment_sim
    else:
        final_sim = combined_sim
    
    return {
        'similarity': float(final_sim),
        'cosine_similarity': float(cosine_sim),
        'dtw_similarity': float(combined_sim),
        'segment_similarity': float(segment_sim) if segment_sim > 0 else None,
        'method': 'full',
        'stage': 3 if segment_sim > 0 else 2
    }

# Add CLI handler to enable calling from JavaScript
if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Audio processing for Tarteel')
    parser.add_argument('--process', help='Process audio data (base64 encoded or @file path)')
    parser.add_argument('--audio-type', default='audio/mpeg', help='MIME type of the audio')
    parser.add_argument('--match', help='Match two audio samples (JSON encoded or @file path)')
    
    args = parser.parse_args()
    
    # Process audio
    if args.process:
        try:
            # Check if input is from file (starts with @)
            if args.process.startswith('@'):
                file_path = args.process[1:]  # Remove @ prefix
                if not os.path.exists(file_path):
                    print(json.dumps({"error": f"Input file not found: {file_path}"}), file=sys.stderr)
                    sys.exit(1)
                try:
                    with open(file_path, 'r') as file:
                        audio_data = file.read()
                except Exception as e:
                    print(json.dumps({"error": f"Failed to read input file: {str(e)}"}), file=sys.stderr)
                    sys.exit(1)
            else:
                audio_data = args.process
                
            features = process_audio(audio_data, args.audio_type)
            print(json.dumps(features))
            sys.exit(0)
        except Exception as e:
            print(json.dumps({"error": str(e)}), file=sys.stderr)
            sys.exit(1)
    
    # Match audio samples
    if args.match:
        try:
            # Check if input is from file (starts with @)
            if args.match.startswith('@'):
                file_path = args.match[1:]  # Remove @ prefix
                if not os.path.exists(file_path):
                    print(json.dumps({"error": f"Input file not found: {file_path}"}), file=sys.stderr)
                    sys.exit(1)
                try:
                    with open(file_path, 'r') as file:
                        samples_data = file.read()
                except Exception as e:
                    print(json.dumps({"error": f"Failed to read input file: {str(e)}"}), file=sys.stderr)
                    sys.exit(1)
                
                samples = json.loads(samples_data)
            else:
                samples = json.loads(args.match)
                
            if not isinstance(samples, dict) or 'sample1' not in samples or 'sample2' not in samples:
                print(json.dumps({"error": "Invalid input format for matching"}), file=sys.stderr)
                sys.exit(1)
                
            # Perform two-stage matching
            result = two_stage_matcher(samples['sample1'], samples['sample2'])
            print(json.dumps(result))
            sys.exit(0)
        except Exception as e:
            print(json.dumps({"error": str(e)}), file=sys.stderr)
            sys.exit(1)
    
    # No valid arguments provided
    if not args.process and not args.match:
        parser.print_help()
        sys.exit(1) 