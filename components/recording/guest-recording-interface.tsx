"use client"

import { useState, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Mic, Save, Trash2, Loader2 } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"

// Define the types for our feedback and match results
interface AspectFeedback {
  score: number;
  advice: string;
}

interface MatchResult {
  reciterId: string;
  reciterName: string;
  reciterImageUrl: string | null;
  recitationStyle?: string;
  similarityScore: number;
  aspectScores: Record<string, number>;
}

export default function GuestRecordingInterface() {
  const [isRecording, setIsRecording] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState("record")
  const [matchResults, setMatchResults] = useState<MatchResult[]>([])
  const [feedback, setFeedback] = useState<{
    general: string[];
    specific: Record<string, AspectFeedback>;
  } | null>(null)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const router = useRouter()

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
    setMatchResults([])
    setFeedback(null)
    setError(null)
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
  }

  const processRecording = async () => {
    if (!audioBlob) return

    setIsProcessing(true)
    setError(null)

    try {
      // 1. Process the audio to extract features
      const formData = new FormData()
      formData.append('audio', audioBlob)
      
      const processResponse = await fetch('/api/process-audio', {
        method: 'POST',
        body: formData
      })
      
      if (!processResponse.ok) {
        throw new Error('Failed to process audio')
      }
      
      const { featureVector } = await processResponse.json()
      
      // 2. Send the feature vector to the reciter-match API
      const matchResponse = await fetch('/api/reciter-match', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ featureVector })
      })
      
      if (!matchResponse.ok) {
        throw new Error('Failed to match reciter')
      }
      
      const { matches, feedback } = await matchResponse.json()
      
      // Update the state with the results
      setMatchResults(matches)
      setFeedback(feedback)
      
      // Switch to the results tab
      setActiveTab("results")
    } catch (err) {
      console.error("Error processing recording:", err)
      setError("Failed to process your recitation. Please try again.")
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="container py-8 max-w-3xl mx-auto">
      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="record" disabled={isProcessing}>
            Record
          </TabsTrigger>
          <TabsTrigger value="preview" disabled={!audioUrl || isProcessing}>
            Preview
          </TabsTrigger>
          <TabsTrigger value="results" disabled={!matchResults.length || isProcessing}>
            Results
          </TabsTrigger>
        </TabsList>

        <TabsContent value="record" className="space-y-6 pt-6">
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

                <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={processRecording} disabled={isProcessing}>
                  {isProcessing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Analyze
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="results" className="pt-6">
          {matchResults.length > 0 && feedback && (
            <div className="space-y-8">
              <div className="text-center">
                <h2 className="text-2xl font-bold mb-2">Your Voice Analysis</h2>
                <p className="text-muted-foreground">Here's how your recitation compares to classical reciters</p>
              </div>

              <div className="space-y-6">
                <h3 className="text-xl font-semibold">Top Matches</h3>
                <div className="grid gap-4 md:grid-cols-3">
                  {matchResults.map((match, index) => (
                    <div key={match.reciterId} className="border rounded-lg p-4 bg-card">
                      <div className="flex flex-col items-center gap-2 text-center">
                        <div className="font-bold">{index + 1}. {match.reciterName}</div>
                        <div className="text-sm text-muted-foreground">
                          {match.recitationStyle} style
                        </div>
                        <div className="mt-2">
                          <span className="text-2xl font-bold text-emerald-600">
                            {Math.round(match.similarityScore)}%
                          </span>
                          <span className="text-sm text-muted-foreground"> match</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-xl font-semibold">General Feedback</h3>
                <ul className="space-y-2">
                  {feedback.general.map((item, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <div className="mt-1 h-2 w-2 rounded-full bg-emerald-600" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="space-y-6">
                <h3 className="text-xl font-semibold">Tajweed Aspect Analysis</h3>
                <div className="grid gap-6 md:grid-cols-2">
                  {Object.entries(feedback.specific).map(([aspect, { score, advice }]) => (
                    <div key={aspect} className="border rounded-lg p-4">
                      <div className="flex justify-between items-center mb-2">
                        <h4 className="text-lg font-medium capitalize">{aspect}</h4>
                        <span className="text-sm font-bold">
                          {Math.round(score)}%
                        </span>
                      </div>
                      <Progress value={score} className="h-2 mb-4" />
                      <p className="text-sm text-muted-foreground">{advice}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-center pt-4">
                <Button onClick={resetRecording} className="bg-emerald-600 hover:bg-emerald-700">
                  Try Again
                </Button>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
} 