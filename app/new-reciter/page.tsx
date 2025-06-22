"use client";

import { useState, useRef, ChangeEvent, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";

export default function NewReciterPage() {
  const [name, setName] = useState('');
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [predictions, setPredictions] = useState<any[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const handleAudioChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      setAudioFile(file);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    
    if (!name) {
      setError('Reciter name is required');
      return;
    }
    
    if (!audioFile) {
      setError('Audio file is required');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    setSuccess(false);
    setPredictions([]);
    
    try {
      // Use the new speaker prediction API
      const formData = new FormData();
      formData.append('name', name);
      formData.append('audio', audioFile);
      
      const response = await fetch('/api/new-reciter', {
        method: 'POST',
        body: formData,
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to create reciter');
      }
      
      // Success!
      setSuccess(true);
      setPredictions(data.predictions || []);
      
      // Reset form
      setName('');
      setAudioFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      
      // Redirect to home after a brief delay
      setTimeout(() => {
        router.push('/');
      }, 3000);
    } catch (err: any) {
      setError(err.message || 'An error occurred');
      console.error('Error creating reciter:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container max-w-2xl py-10">
      <Card>
        <CardHeader>
          <CardTitle>Create New Reciter</CardTitle>
          <CardDescription>
            Add a new reciter to the database with AI-powered speaker recognition
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
              </AlertDescription>
            </Alert>
          )}

          {predictions.length > 0 && (
            <Card className="mb-4 bg-blue-50 border-blue-200">
              <CardHeader>
                <CardTitle className="text-lg text-blue-800">Speaker Recognition Results</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {predictions.map((prediction, index) => (
                    <div key={index} className="flex justify-between items-center">
                      <span className="font-medium text-blue-900">{prediction.speaker}</span>
                      <span className="text-blue-700">{(prediction.confidence * 100).toFixed(1)}%</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
          
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <Label htmlFor="name">Reciter Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
                placeholder="e.g., Sheikh Abdul-Basit Abdus-Samad"
                disabled={isLoading}
                required
              />
            </div>
            
            <div>
              <Label htmlFor="audio">Audio Sample</Label>
              <Input
                ref={fileInputRef}
                id="audio"
                type="file"
                accept="audio/*"
                onChange={handleAudioChange}
                disabled={isLoading}
                required
              />
              <p className="text-sm text-gray-500 mt-1">
                Please upload a clear recording of the reciter (MP3, WAV, or M4A format, 30 seconds to 2 minutes).
              </p>
            </div>
            
            <Button 
              type="submit" 
              className="w-full"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing with AI...
                </>
              ) : (
                'Create Reciter'
              )}
            </Button>
          </form>
        </CardContent>
        <CardFooter>
          <div className="w-full">
            <h3 className="font-medium mb-2">About AI Speaker Recognition</h3>
            <p className="text-sm text-gray-500 mb-2">
              Our AI-powered speaker recognition system uses advanced deep learning to identify reciters:
            </p>
            <ul className="text-sm text-gray-500 list-disc pl-5 space-y-1">
              <li>Deep neural network trained on Quranic recitations</li>
              <li>Mel-frequency cepstral coefficients (MFCC) for voice analysis</li>
              <li>Speaker-specific voice characteristics detection</li>
              <li>Confidence scoring for prediction reliability</li>
              <li>Support for multiple audio formats</li>
            </ul>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
} 