"use client"

import { useState, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Mic, Save, Trash2, Loader2 } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface RecordingInterfaceProps {
  userId: string
}

export default function RecordingInterface({ userId }: RecordingInterfaceProps) {
  const [isRecording, setIsRecording] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState("record")

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl)
      }
    }
  }, [audioUrl])

  const startRecording = async () => {
    try {
      audioChunksRef.current = []
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream)

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/mpeg" })
        const url = URL.createObjectURL(audioBlob)
        setAudioBlob(audioBlob)
        setAudioUrl(url)
        setActiveTab("preview")

        // Stop all tracks from the stream
        stream.getTracks().forEach((track) => track.stop())
      }

      mediaRecorderRef.current = mediaRecorder
      mediaRecorder.start()
      setIsRecording(true)
      setRecordingTime(0)

      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1)
      }, 1000)
    } catch (err) {
      console.error("Error starting recording:", err)
      setError("Could not access microphone. Please check your browser permissions.")
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)

      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
  }

  const resetRecording = () => {
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl)
    }
    setAudioBlob(null)
    setAudioUrl(null)
    setRecordingTime(0)
    setActiveTab("record")
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
  }

  const saveRecording = async () => {
    if (!audioBlob) return

    setIsProcessing(true)
    setError(null)

    try {
      // 1. Upload the audio file to Supabase Storage
      const fileName = `recitations/${userId}/${Date.now()}.mp3`
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("audio")
        .upload(fileName, audioBlob, {
          contentType: "audio/mpeg",
        })

      if (uploadError) {
        throw new Error(uploadError.message)
      }

      // 2. Get the public URL for the uploaded file
      const {
        data: { publicUrl },
      } = supabase.storage.from("audio").getPublicUrl(fileName)

      // 3. Simulate analysis (in a real app, you'd send the audio to an analysis service)
      // For demo purposes, we'll generate random scores
      const tajweedScore = Math.floor(Math.random() * 30) + 60 // 60-90
      const pronunciationScore = Math.floor(Math.random() * 30) + 60 // 60-90
      const rhythmScore = Math.floor(Math.random() * 30) + 60 // 60-90
      const overallScore = Math.floor((tajweedScore + pronunciationScore + rhythmScore) / 3)

      // 4. Get a random reciter to match with
      const { data: reciters, error: recitersError } = await supabase.from("reciters").select("id")

      if (recitersError) {
        throw new Error(recitersError.message)
      }

      const randomReciterId = reciters[Math.floor(Math.random() * reciters.length)].id

      // 5. Save the recitation data to the database
      const { data: recitationData, error: recitationError } = await supabase
        .from("recitations")
        .insert({
          user_id: userId,
          surah: "Al-Fatiha",
          audio_url: publicUrl,
          duration: recordingTime,
          matched_reciter_id: randomReciterId,
          tajweed_score: tajweedScore,
          pronunciation_score: pronunciationScore,
          rhythm_score: rhythmScore,
          overall_score: overallScore,
        })
        .select()

      if (recitationError) {
        throw new Error(recitationError.message)
      }

      // 6. Redirect to the results page
      router.push(`/dashboard`)
      router.refresh()
    } catch (err) {
      console.error("Error saving recording:", err)
      setError("Failed to save your recitation. Please try again.")
      setIsProcessing(false)
    }
  }

  return (
    <div className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="record" disabled={isProcessing}>
            Record
          </TabsTrigger>
          <TabsTrigger value="preview" disabled={!audioUrl || isProcessing}>
            Preview
          </TabsTrigger>
        </TabsList>

        <TabsContent value="record" className="pt-6">
          <div className="flex flex-col items-center justify-center space-y-8">
            <div className="text-center">
              <p className="text-lg font-medium mb-2">Recite Surah Al-Fatiha</p>
              <p className="text-sm text-muted-foreground">Press the microphone button to start recording</p>
            </div>

            <div className="relative">
              <Button
                className={`h-32 w-32 rounded-full ${
                  isRecording ? "bg-red-500 hover:bg-red-600 animate-pulse" : "bg-emerald-600 hover:bg-emerald-700"
                }`}
                onClick={isRecording ? stopRecording : startRecording}
                disabled={isProcessing}
              >
                <Mic className="h-12 w-12" />
              </Button>
              {isRecording && (
                <div className="absolute -bottom-8 left-0 right-0 text-center">
                  <span className="text-sm font-medium">{formatTime(recordingTime)}</span>
                </div>
              )}
            </div>

            {isRecording && <p className="text-red-500 animate-pulse">Recording...</p>}
          </div>
        </TabsContent>

        <TabsContent value="preview" className="pt-6">
          {audioUrl && (
            <div className="flex flex-col items-center justify-center space-y-6">
              <div className="w-full max-w-md">
                <audio src={audioUrl} controls className="w-full" />
              </div>

              <div className="flex flex-wrap justify-center gap-4">
                <Button variant="outline" onClick={resetRecording} disabled={isProcessing}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Discard
                </Button>

                <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={saveRecording} disabled={isProcessing}>
                  {isProcessing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Save & Analyze
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
