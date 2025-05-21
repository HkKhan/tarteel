"use client";

import React, { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, CheckCircle2, XCircle, Upload } from "lucide-react";

export default function NewReciterPage() {
  const [isUploading, setIsUploading] = useState(false);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [reciterName, setReciterName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<boolean>(false);
  const [uploadedData, setUploadedData] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      if (file.type !== "audio/mpeg" && file.type !== "audio/mp3") {
        setError("Please upload an MP3 file");
        setAudioFile(null);
        return;
      }
      setAudioFile(file);
      setError(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setUploadedData(null);

    if (!audioFile) {
      setError("Please select an audio file");
      return;
    }

    if (!reciterName) {
      setError("Please enter a reciter name");
      return;
    }

    setIsUploading(true);

    // Add a timeout controller
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout

    try {
      const formData = new FormData();
      formData.append("audio", audioFile);
      formData.append("name", reciterName);
      
      const response = await fetch("/api/new-reciter", {
        method: "POST",
        body: formData,
        signal: controller.signal
      });

      clearTimeout(timeoutId); // Clear the timeout if fetch completes

      if (!response.ok) {
        const data = await response.json().catch(() => ({ error: `Server error: ${response.status}` }));
        throw new Error(data.error || `Failed to upload reciter (${response.status})`);
      }

      const data = await response.json().catch(() => null);
      if (!data) {
        throw new Error("Invalid response from server");
      }

      setSuccess(true);
      setUploadedData(data);
      setReciterName("");
      setAudioFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (err: any) {
      console.error("Upload error:", err);
      if (err.name === 'AbortError') {
        setError("Request timed out. The server took too long to process the audio.");
      } else {
        setError(err instanceof Error ? err.message : "An unknown error occurred");
      }
    } finally {
      clearTimeout(timeoutId); // Ensure timeout is cleared
      setIsUploading(false);
    }
  };

  return (
    <div className="container max-w-2xl py-10">
      <Card>
        <CardHeader>
          <CardTitle>Add New Reciter</CardTitle>
          <CardDescription>
            Upload an MP3 recording of Surah Al-Fatiha by a reciter to add them to the database.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <XCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {success && (
            <Alert className="mb-4 bg-green-50 text-green-800 border-green-200">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertTitle>Success!</AlertTitle>
              <AlertDescription>
                Reciter has been successfully added to the database.
                {uploadedData && (
                  <div className="mt-2">
                    <p><strong>Name:</strong> {uploadedData.name}</p>
                    <p><strong>Style:</strong> {uploadedData.style}</p>
                    <audio 
                      src={uploadedData.audio_url} 
                      controls 
                      className="mt-2 w-full"
                    />
                  </div>
                )}
              </AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit}>
            <div className="space-y-4">
              <div>
                <Label htmlFor="reciterName">Reciter Name</Label>
                <Input
                  id="reciterName"
                  value={reciterName}
                  onChange={(e) => setReciterName(e.target.value)}
                  placeholder="Enter the reciter's name"
                  disabled={isUploading}
                  required
                />
              </div>

              <div>
                <Label htmlFor="audioFile">Audio File (MP3 of Surah Al-Fatiha)</Label>
                <div className="mt-1 flex items-center">
                  <Input
                    ref={fileInputRef}
                    id="audioFile"
                    type="file"
                    accept="audio/mpeg,audio/mp3"
                    onChange={handleFileChange}
                    disabled={isUploading}
                    required
                    className="flex-1"
                  />
                </div>
                {audioFile && (
                  <p className="text-sm text-gray-500 mt-1">
                    Selected: {audioFile.name} ({(audioFile.size / 1024 / 1024).toFixed(2)} MB)
                  </p>
                )}
              </div>
            </div>

            <Button 
              type="submit" 
              className="mt-6 w-full" 
              disabled={isUploading || !audioFile || !reciterName}
            >
              {isUploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Upload Reciter
                </>
              )}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex justify-between text-sm text-gray-500">
          <p>File must be an MP3 of Surah Al-Fatiha</p>
        </CardFooter>
      </Card>
    </div>
  );
} 