#!/usr/bin/env python3
import torch
import torch.nn as nn
import librosa
import numpy as np
import pickle
import sys
import json
import base64
import tempfile
import os

class SimpleSpeakerNet(nn.Module):
    def __init__(self, n_speakers=33, n_mels=40):
        super(SimpleSpeakerNet, self).__init__()
        self.n_mels = n_mels
        
        # Simple CNN architecture
        self.conv1 = nn.Conv2d(1, 32, (5, 5), padding=2)
        self.conv2 = nn.Conv2d(32, 64, (3, 3), padding=1)
        self.classifier = nn.Linear(64, n_speakers)
        self.dropout = nn.Dropout(0.3)
        
    def forward(self, x):
        # x shape: (batch, 1, time, mels)
        x = torch.relu(self.conv1(x))
        x = torch.relu(self.conv2(x))
        # Global average pooling over time and mel dimensions
        x = torch.mean(x, dim=(2, 3))  # (batch, 64)
        
        x = self.dropout(x)
        x = self.classifier(x)
        return x

def extract_features(audio_path, max_length=200):
    """Extract mel spectrogram features"""
    try:
        # Load audio
        audio, sr = librosa.load(audio_path, sr=16000, mono=True)
        
        # Extract mel spectrogram
        mel_spec = librosa.feature.melspectrogram(
            y=audio, sr=sr, n_mels=40, n_fft=512, hop_length=160
        )
        mel_spec = librosa.power_to_db(mel_spec, ref=np.max)
        
        # Normalize
        mel_spec = (mel_spec - mel_spec.mean()) / (mel_spec.std() + 1e-8)
        
        # Trim or pad to fixed length
        if mel_spec.shape[1] > max_length:
            # Take multiple segments for more robust prediction
            segments = []
            step = max(1, (mel_spec.shape[1] - max_length) // 4)  # 5 segments
            for start in range(0, mel_spec.shape[1] - max_length + 1, step):
                segment = mel_spec[:, start:start + max_length]
                segments.append(segment)
            return np.array(segments)
        else:
            # Pad with zeros
            pad_width = max_length - mel_spec.shape[1]
            mel_spec = np.pad(mel_spec, ((0, 0), (0, pad_width)), mode='constant')
            return np.array([mel_spec])  # Single segment
            
    except Exception as e:
        print(f"Error processing {audio_path}: {e}")
        return None

class QuranSpeakerPredictor:
    def __init__(self):
        self.device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
        
        # Use local files in the same directory
        script_dir = os.path.dirname(os.path.abspath(__file__))
        model_path = os.path.join(script_dir, "speaker_model_full.pth")
        mapping_path = os.path.join(script_dir, "speaker_mapping.pkl")
        
        # Load speaker mapping
        with open(mapping_path, "rb") as f:
            self.speaker_mapping = pickle.load(f)
        
        # Create reverse mapping (id -> name)
        self.id_to_speaker = {v: k for k, v in self.speaker_mapping.items()}
        
        # Load model
        self.model = SimpleSpeakerNet(n_speakers=len(self.speaker_mapping))
        self.model.load_state_dict(torch.load(model_path, map_location=self.device))
        self.model.to(self.device)
        self.model.eval()
        
        # print(f"Loaded original model for {len(self.speaker_mapping)} speakers")
    
    def predict_from_file(self, audio_path, top_k=5):
        """Predict the speaker for an audio file"""
        features = extract_features(audio_path)
        if features is None:
            return None
        
        # Convert to tensor
        features_tensor = torch.FloatTensor(features).unsqueeze(1).to(self.device)  # Add channel dim
        
        with torch.no_grad():
            outputs = self.model(features_tensor)
            
            # Average predictions across segments
            if len(outputs) > 1:
                outputs = torch.mean(outputs, dim=0, keepdim=True)
            
            # Get probabilities
            probs = torch.softmax(outputs, dim=1)
            
            # Get top predictions
            top_probs, top_indices = torch.topk(probs, min(top_k, len(self.speaker_mapping)))
            
            results = []
            for i in range(len(top_indices[0])):
                speaker_id = top_indices[0][i].item()
                confidence = top_probs[0][i].item()
                speaker_name = self.id_to_speaker[speaker_id]
                results.append({"speaker": speaker_name, "confidence": float(confidence)})
        
        return results
    
    def predict_from_base64(self, audio_base64, format="mp3", top_k=5):
        try:
            audio_data = base64.b64decode(audio_base64)
            
            with tempfile.NamedTemporaryFile(suffix=f".{format}", delete=False) as temp_file:
                temp_file.write(audio_data)
                temp_path = temp_file.name
            
            results = self.predict_from_file(temp_path, top_k)
            os.unlink(temp_path)
            
            return results
        except Exception as e:
            return None

def main():
    if len(sys.argv) != 2:
        print(json.dumps({"error": "Usage: python predictor.py <input_json>"}))
        return
    
    try:
        input_data = json.loads(sys.argv[1])
        predictor = QuranSpeakerPredictor()
        
        if "audio_path" in input_data:
            results = predictor.predict_from_file(
                input_data["audio_path"], 
                input_data.get("top_k", 5)
            )
        elif "audio_base64" in input_data:
            results = predictor.predict_from_base64(
                input_data["audio_base64"],
                input_data.get("format", "mp3"),
                input_data.get("top_k", 5)
            )
        else:
            print(json.dumps({"error": "Missing audio_path or audio_base64"}))
            return
        
        if results is None:
            print(json.dumps({"error": "Failed to process audio"}))
            return
        
        print(json.dumps({
            "success": True,
            "predictions": results,
            "num_speakers": len(predictor.speaker_mapping)
        }))
        
    except Exception as e:
        print(json.dumps({"error": str(e)}))

if __name__ == "__main__":
    main() 