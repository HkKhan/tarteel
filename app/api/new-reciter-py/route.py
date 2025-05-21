from http.server import BaseHTTPRequestHandler
import os
import json
import uuid
import sys
import base64
import tempfile
from supabase import create_client, Client

# Add the project root to Python path to import the module
sys.path.append('/Users/haneefkhan/Desktop/dev/tarteel')
# Import after adding to path
from lib.audio.python_processor import process_audio

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
            reciter_name = data.get('name')
            audio_type = data.get('audioType', 'audio/mpeg')  # Default to audio/mpeg if not specified
            
            if not audio_base64 or not reciter_name:
                self._send_error("Audio data and reciter name are required")
                return
                
            try:
                # Generate unique filename for storage
                file_name = f"reciters/{str(uuid.uuid4())}"
                file_extension = '.mp3'
                storage_content_type = 'audio/mpeg'
                
                if audio_type == 'audio/wav' or audio_type == 'audio/wave':
                    file_extension = '.wav'
                    storage_content_type = 'audio/wav'
                
                file_name = file_name + file_extension
                
                # Upload the audio to Supabase Storage (for temporary access)
                audio_data = base64.b64decode(audio_base64.split(',')[1] if ',' in audio_base64 else audio_base64)
                with tempfile.NamedTemporaryFile(delete=False, suffix=file_extension) as temp_file:
                    temp_filename = temp_file.name
                    temp_file.write(audio_data)
                    
                with open(temp_filename, 'rb') as f:
                    result = supabase.storage.from_("audio").upload(file_name, f, {"content-type": storage_content_type})
                
                # Get public URL (only for response, not stored in DB)
                public_url = supabase.storage.from_("audio").get_public_url(file_name)
                
                # Clean up temp file
                if os.path.exists(temp_filename):
                    os.unlink(temp_filename)
                
                # Process the audio using the shared module
                processed_audio = process_audio(audio_base64, audio_type)
                
                # Determine recitation style
                style = 'Hafs'
                if 'warsh' in reciter_name.lower():
                    style = 'Warsh'
                elif 'assim' in reciter_name.lower():
                    style = 'Assim'
                
                # Check if reciter exists
                existing_reciters = supabase.table('reciters').select('id, name').eq('name', reciter_name).execute()
                
                if existing_reciters.data:
                    # Update existing reciter
                    reciter_id = existing_reciters.data[0]['id']
                    
                    # Update the record with only the columns that exist
                    supabase.table('reciters').update({
                        'name': reciter_name,
                        'feature_vector': processed_audio['feature_vector'],
                        'style': style
                    }).eq('id', reciter_id).execute()
                else:
                    # Create new reciter
                    result = supabase.table('reciters').insert({
                        'name': reciter_name,
                        'feature_vector': processed_audio['feature_vector'],
                        'style': style
                    }).execute()
                    
                    reciter_id = result.data[0]['id']
                
                # Send success response
                self._send_success({
                    'success': True,
                    'reciterId': reciter_id,
                    'name': reciter_name,
                    'audio_url': public_url,  # Include in response but not stored in DB
                    'style': style,
                    'features': processed_audio['feature_shapes']
                })
                
            except Exception as e:
                self._send_error(f"Error processing reciter: {str(e)}")
                
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