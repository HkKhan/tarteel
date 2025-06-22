# Speaker Recognition Model Integration Plan

## Overview
This plan integrates the trained speaker recognition model from `model/speakerID/` into the Next.js web application to replace the current audio processing system with the PyTorch-based speaker classification model.

## Current Model Assets
- **Trained Models**: 
  - `speaker_model_full.pth` (final model)
  - `speaker_model_full_best.pth` (best performing model)
  - `speaker_mapping.pkl` (speaker ID to name mapping)
- **Inference Script**: `full_inference.py` with `QuranSpeakerClassifier` class
- **Dependencies**: PyTorch, librosa, numpy, pickle

## Integration Steps

### Phase 1: Backend API Integration (Immediate)

#### 1.1 Create Python Microservice
- Create `lib/speaker_prediction/` directory
- Copy essential model files:
  - `speaker_model_full_best.pth`
  - `speaker_mapping.pkl`
  - Core inference logic from `full_inference.py`
- Create a streamlined `predictor.py` with minimal dependencies

#### 1.2 Create Next.js API Route
- Create `app/api/predict-speaker/route.ts`
- Handle file uploads (audio files)
- Execute Python predictor via subprocess
- Return JSON response with speaker predictions

#### 1.3 Update Frontend Components
- Modify `app/new-reciter/page.tsx` to use new API
- Remove old python-proxy dependencies
- Update UI to show speaker prediction results

### Phase 2: Enhanced Integration (Future)

#### 2.1 Real-time Processing
- Implement WebSocket for real-time audio processing
- Stream audio chunks for faster prediction
- Add confidence threshold handling

#### 2.2 Database Integration
- Store speaker predictions in Supabase
- Track prediction accuracy over time
- Cache results for repeated audio files

### Phase 3: Production Optimization

#### 3.1 Model Serving
- Consider using TorchServe or FastAPI for model serving
- Implement model versioning
- Add health checks and monitoring

#### 3.2 Performance Optimization
- Implement audio preprocessing optimization
- Add GPU support detection
- Cache feature extraction results

## File Structure After Integration

```
lib/
├── speaker_prediction/
│   ├── predictor.py
│   ├── speaker_model_full_best.pth
│   ├── speaker_mapping.pkl
│   └── requirements.txt
├── supabase/
└── utils/

app/
├── api/
│   ├── predict-speaker/
│   │   └── route.ts
│   ├── new-reciter/
│   │   └── route.ts (updated)
│   └── reciter-match/
│       └── route.ts (updated)
└── new-reciter/
    └── page.tsx (updated)
```

## API Interface Design

### Endpoint: POST /api/predict-speaker
**Request:**
```json
{
  "audio": "base64_encoded_audio_data",
  "format": "mp3|wav|m4a",
  "top_k": 5
}
```

**Response:**
```json
{
  "success": true,
  "predictions": [
    {
      "speaker": "speaker_name",
      "confidence": 0.85
    },
    ...
  ],
  "processing_time": 1.2
}
```

## Dependencies to Install
```bash
# Python dependencies for model
pip install torch librosa numpy

# Node.js - no new dependencies needed
```

## Cleanup Completed
✅ Removed old Python processing scripts from `/scripts/`
✅ Removed deprecated API routes (`new-reciter-py`, `process-recitation`, `audio/match-detailed`)
✅ Removed old documentation files
✅ Cleaned up references to `python_processor`

## Next Steps
1. Implement Phase 1 (Backend API Integration)
2. Test with actual audio files
3. Update frontend to use new API
4. Deploy and monitor performance

## Risk Mitigation
- Keep fallback mechanism during transition
- Implement proper error handling
- Add comprehensive logging
- Test with various audio formats and qualities 