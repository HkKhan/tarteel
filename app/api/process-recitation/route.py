from http.server import BaseHTTPRequestHandler
import numpy as np
import os
import json
import sys
from supabase import create_client, Client

# Add the project root to Python path to import the module
sys.path.append('/Users/haneefkhan/Desktop/dev/tarteel')
from lib.audio.python_processor import process_audio, calculate_similarity

# Initialize Supabase client
supabase_url = os.environ.get("SUPABASE_URL")
supabase_key = os.environ.get("SUPABASE_KEY")
supabase: Client = create_client(supabase_url, supabase_key)

class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        # Get content length
        content_length = int(self.headers['Content-Length'])
        
        # Read the POST data
        post_data = self.rfile.read(content_length)
        
        try:
            # Parse the JSON data
            data = json.loads(post_data)
            audio_base64 = data.get('audio')
            audio_type = data.get('audioType', 'audio/mpeg')  # Default to audio/mpeg if not specified
            
            if not audio_base64:
                self._send_error("No audio data provided")
                return
            
            try:
                # Process the audio using the shared module
                processed_audio = process_audio(audio_base64, audio_type)
                
                # Get reciters from database
                reciters_result = supabase.table('reciters').select('id, name, style, feature_vector').execute()
                reciters = reciters_result.data
                
                # Calculate cosine similarity with each reciter
                matches = []
                for reciter in reciters:
                    reciter_vector = reciter['feature_vector']
                    
                    # Calculate cosine similarity using shared function
                    similarity = calculate_similarity(processed_audio['feature_vector'], reciter_vector)
                    
                    # Create aspect scores (for demonstration)
                    aspect_scores = {
                        'intonation': min(1.0, max(0.0, similarity * np.random.uniform(0.9, 1.1))),
                        'pace': min(1.0, max(0.0, similarity * np.random.uniform(0.9, 1.1))),
                        'melody': min(1.0, max(0.0, similarity * np.random.uniform(0.9, 1.1))),
                        'strength': min(1.0, max(0.0, similarity * np.random.uniform(0.9, 1.1))),
                        'articulation': min(1.0, max(0.0, similarity * np.random.uniform(0.9, 1.1))),
                        'fluency': min(1.0, max(0.0, similarity * np.random.uniform(0.9, 1.1))),
                        'rhythm': min(1.0, max(0.0, similarity * np.random.uniform(0.9, 1.1)))
                    }
                    
                    # Add to matches
                    if similarity > 0.4:  # Threshold to filter out very poor matches
                        matches.append({
                            'id': reciter['id'],
                            'name': reciter['name'],
                            'style': reciter['style'],
                            'similarity_score': float(similarity),
                            'aspect_scores': aspect_scores
                        })
                
                # Sort by similarity score
                matches.sort(key=lambda x: x['similarity_score'], reverse=True)
                
                # Take top 5 matches
                top_matches = matches[:5]
                
                # Send success response
                self._send_success({
                    'matches': top_matches,
                    'feature_info': processed_audio['feature_shapes']
                })
                
            except Exception as e:
                self._send_error(f"Error processing audio: {str(e)}")
                
        except Exception as e:
            self._send_error(f"Error parsing request: {str(e)}")
    
    def _send_success(self, data):
        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps(data).encode())
    
    def _send_error(self, error_message):
        self.send_response(400)
        self.send_header('Content-type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps({"error": error_message}).encode()) 