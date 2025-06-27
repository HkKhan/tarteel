"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Mic, Save, Trash2, Loader2, Upload } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { processRecitation } from "@/lib/audio/recorder";

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
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("record");
  const [matchResults, setMatchResults] = useState<MatchResult[]>([]);
  const [feedback, setFeedback] = useState<{
    general: string[];
    specific: Record<string, AspectFeedback>;
  } | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [isDragOver, setIsDragOver] = useState(false);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [audioUrl]);

  const startRecording = async () => {
    try {
      audioChunksRef.current = [];
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, {
          type: "audio/mpeg",
        });
        const url = URL.createObjectURL(audioBlob);
        setAudioBlob(audioBlob);
        setAudioUrl(url);
        setActiveTab("preview");

        // Stop all tracks from the stream
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);

      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error("Error starting recording:", err);
      setError(
        "Could not access microphone. Please check your browser permissions."
      );
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);

      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      // Process the file directly
      processUploadedFile(file);
    }
  };

  const processUploadedFile = (file: File) => {
    console.log(
      "Processing uploaded file:",
      file.name,
      "Type:",
      file.type,
      "Size:",
      file.size
    );

    // Check if file is an audio file (more permissive check)
    const audioTypes = ["audio/", "video/mp4", "video/x-m4a"];
    const isAudioFile =
      audioTypes.some((type) => file.type.startsWith(type)) ||
      file.name.toLowerCase().match(/\.(mp3|wav|m4a|ogg|flac|aac)$/);

    if (!isAudioFile) {
      setError("Please upload an audio file (MP3, WAV, M4A, etc.).");
      return;
    }

    // Check file size (50MB max - more generous for audio files)
    if (file.size > 50 * 1024 * 1024) {
      setError("File is too large. Maximum size is 50MB.");
      return;
    }

    console.log("File validation passed, creating audio URL...");

    // Create a URL for the audio file
    const url = URL.createObjectURL(file);
    setAudioBlob(file);
    setAudioUrl(url);
    setError(null); // Clear any previous errors
    setActiveTab("preview");

    console.log("Audio URL created:", url);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    processUploadedFile(file);
  };

  const triggerFileUpload = () => {
    fileInputRef.current?.click();
  };

  const resetRecording = () => {
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }
    setAudioBlob(null);
    setAudioUrl(null);
    setRecordingTime(0);
    setActiveTab("record");
    setMatchResults([]);
    setFeedback(null);
    setError(null);

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  };

  const processRecordingHandler = async () => {
    if (!audioBlob) return;

    setIsProcessing(true);
    setError(null);

    try {
      // Use our new utility function to process the recording
      const responseData = await processRecitation(audioBlob);

      // Update the state with the results
      if (responseData.bestMatch && responseData.matchResults) {
        setMatchResults(responseData.matchResults);

        // Create simple feedback object format based on match results
        const specificFeedback: Record<string, AspectFeedback> = {};
        Object.entries(responseData.bestMatch.aspectScores || {}).forEach(
          ([aspect, score]) => {
            specificFeedback[aspect] = {
              score: Number(score),
              advice: `Your ${aspect} is ${
                Number(score) > 0.7 ? "good" : "needs improvement"
              }`,
            };
          }
        );

        setFeedback({
          general: responseData.generalFeedback || [],
          specific: specificFeedback,
        });
      } else {
        throw new Error("Invalid response format from server");
      }

      // Switch to the results tab
      setActiveTab("results");
    } catch (err) {
      console.error("Error processing recording:", err);
      setError("Failed to process your recitation. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

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
          <TabsTrigger
            value="results"
            disabled={!matchResults.length || isProcessing}
          >
            Results
          </TabsTrigger>
        </TabsList>

        <TabsContent value="record" className="space-y-6 pt-6">
          <div
            className={`flex flex-col items-center justify-center space-y-8 p-8 rounded-lg border-2 border-dashed transition-colors ${
              isDragOver
                ? "border-blue-400 bg-blue-50"
                : "border-gray-300 hover:border-gray-400"
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <div className="text-center">
              <p className="text-lg font-medium mb-2">Recite Surah Al-Fatiha</p>
              <p className="text-sm text-muted-foreground">
                Record your voice or upload an audio file
              </p>
              {isDragOver && (
                <p className="text-sm text-blue-600 font-medium mt-2">
                  Drop your audio file here!
                </p>
              )}
            </div>

            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*,.mp3,.wav,.m4a,.ogg,.flac"
              className="hidden"
              onChange={handleFileUpload}
            />

            <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
              {/* Recording button */}
              <div className="relative flex flex-col items-center">
                <Button
                  className={`h-32 w-32 rounded-full ${
                    isRecording
                      ? "bg-red-500 hover:bg-red-600 animate-pulse"
                      : "bg-emerald-600 hover:bg-emerald-700"
                  }`}
                  onClick={isRecording ? stopRecording : startRecording}
                  disabled={isProcessing}
                >
                  <Mic className="h-12 w-12" />
                </Button>
                {isRecording && (
                  <div className="absolute top-32 w-full text-center">
                    <span className="text-sm font-medium">
                      {formatTime(recordingTime)}
                    </span>
                  </div>
                )}
                <p className="text-center mt-4 text-sm font-medium">
                  Record Audio
                </p>
              </div>

              {/* Or divider */}
              <div className="text-muted-foreground text-lg font-medium px-4">
                OR
              </div>

              {/* Upload button */}
              <div className="relative flex flex-col items-center">
                <Button
                  className="h-32 w-32 rounded-full bg-blue-600 hover:bg-blue-700"
                  onClick={triggerFileUpload}
                  disabled={isProcessing || isRecording}
                >
                  <Upload className="h-12 w-12" />
                </Button>
                <p className="text-center mt-4 text-sm font-medium">
                  Upload MP3/Audio
                </p>
                <p className="text-center text-xs text-muted-foreground mt-1">
                  MP3, WAV, M4A supported
                </p>
              </div>
            </div>

            {isRecording && (
              <p className="text-red-500 animate-pulse mt-4">Recording...</p>
            )}
          </div>
        </TabsContent>

        <TabsContent value="preview" className="pt-6">
          {audioUrl && (
            <div className="flex flex-col items-center justify-center space-y-6">
              <div className="w-full max-w-md">
                <audio src={audioUrl} controls className="w-full" />
              </div>

              <div className="flex flex-wrap justify-center gap-4">
                <Button
                  variant="outline"
                  onClick={resetRecording}
                  disabled={isProcessing}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Discard
                </Button>

                <Button
                  className="bg-emerald-600 hover:bg-emerald-700"
                  onClick={processRecordingHandler}
                  disabled={isProcessing}
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Analyze Recitation
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="results" className="pt-6">
          {matchResults.length > 0 && (
            <div className="space-y-8">
              {/* Best Match Section */}
              <div className="bg-green-50 p-6 rounded-lg border border-green-200">
                <h3 className="text-xl font-semibold text-green-800 mb-4">
                  Best Match
                </h3>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="font-medium">
                      {matchResults[0].reciterName}
                    </span>
                    <span className="font-semibold text-green-600">
                      {Math.round(matchResults[0].similarityScore)}% match
                    </span>
                  </div>
                  <Progress
                    value={matchResults[0].similarityScore}
                    className="h-2"
                  />
                  {matchResults[0].recitationStyle && (
                    <p className="text-sm text-gray-600">
                      Style: {matchResults[0].recitationStyle}
                    </p>
                  )}
                </div>
              </div>

              {/* Feedback Section */}
              {feedback && (
                <div className="bg-blue-50 p-6 rounded-lg border border-blue-200">
                  <h3 className="text-xl font-semibold text-blue-800 mb-4">
                    Feedback
                  </h3>
                  <ul className="list-disc pl-5 space-y-2">
                    {feedback.general.map((item, idx) => (
                      <li key={idx} className="text-blue-700">
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Other Matches Section */}
              {matchResults.length > 1 && (
                <div>
                  <h3 className="text-xl font-semibold mb-4">
                    Other Close Matches
                  </h3>
                  <div className="space-y-4">
                    {matchResults.slice(1).map((match) => (
                      <div
                        key={match.reciterId}
                        className="bg-gray-50 p-4 rounded-lg border"
                      >
                        <div className="flex justify-between items-center">
                          <span className="font-medium">
                            {match.reciterName}
                          </span>
                          <span className="font-semibold text-gray-600">
                            {Math.round(match.similarityScore)}% match
                          </span>
                        </div>
                        <Progress
                          value={match.similarityScore}
                          className="h-2 mt-2"
                        />
                        {match.recitationStyle && (
                          <p className="text-sm text-gray-600 mt-1">
                            Style: {match.recitationStyle}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Action Button */}
              <div className="flex justify-center">
                <Button variant="outline" onClick={resetRecording}>
                  Record Again
                </Button>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
