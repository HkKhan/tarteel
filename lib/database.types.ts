export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          username: string | null
          full_name: string | null
          avatar_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          username?: string | null
          full_name?: string | null
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          username?: string | null
          full_name?: string | null
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      reciters: {
        Row: {
          id: string
          name: string
          bio: string | null
          era: string | null
          style: string | null
          image_url: string | null
          sample_audio_url: string | null
          created_at: string
          profile_image_url: string | null
          feature_vector: Json | null
        }
        Insert: {
          id?: string
          name: string
          bio?: string | null
          era?: string | null
          style?: string | null
          image_url?: string | null
          sample_audio_url?: string | null
          created_at?: string
          profile_image_url?: string | null
          feature_vector?: Json | null
        }
        Update: {
          id?: string
          name?: string
          bio?: string | null
          era?: string | null
          style?: string | null
          image_url?: string | null
          sample_audio_url?: string | null
          created_at?: string
          profile_image_url?: string | null
          feature_vector?: Json | null
        }
      }
      recitations: {
        Row: {
          id: string
          user_id: string
          surah: string
          audio_url: string | null
          duration: number | null
          matched_reciter_id: string | null
          tajweed_score: number | null
          pronunciation_score: number | null
          rhythm_score: number | null
          overall_score: number | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          surah: string
          audio_url?: string | null
          duration?: number | null
          matched_reciter_id?: string | null
          tajweed_score?: number | null
          pronunciation_score?: number | null
          rhythm_score?: number | null
          overall_score?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          surah?: string
          audio_url?: string | null
          duration?: number | null
          matched_reciter_id?: string | null
          tajweed_score?: number | null
          pronunciation_score?: number | null
          rhythm_score?: number | null
          overall_score?: number | null
          created_at?: string
        }
      }
      feedback: {
        Row: {
          id: string
          recitation_id: string
          category: string
          detail: string
          verse_number: number | null
          timestamp: number | null
          improvement_suggestion: string | null
          created_at: string
        }
        Insert: {
          id?: string
          recitation_id: string
          category: string
          detail: string
          verse_number?: number | null
          timestamp?: number | null
          improvement_suggestion?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          recitation_id?: string
          category?: string
          detail?: string
          verse_number?: number | null
          timestamp?: number | null
          improvement_suggestion?: string | null
          created_at?: string
        }
      }
    }
  }
}
