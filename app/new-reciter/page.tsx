"use client";

import { useState, useRef, ChangeEvent, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";

export default function NewReciterPage() {
  const [name, setName] = useState('');
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [audioBase64, setAudioBase64] = useState<string | null>(null);
  const [processingMethod, setProcessingMethod] = useState<'js' | 'python'>('python');
  const [success, setSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const handleAudioChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      setAudioFile(file);
      
      // Convert to base64 for Python method
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result as string;
        setAudioBase64(base64);
      };
      reader.readAsDataURL(file);
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
    
    try {
      // Choose API endpoint based on selected method
      const endpoint = processingMethod === 'python' 
        ? '/api/new-reciter-py' 
        : '/api/new-reciter';
      
      let response;
      
      if (processingMethod === 'python') {
        // Use Python processor with enhanced audio fingerprinting
        if (!audioBase64) {
          throw new Error('Audio file not properly loaded');
        }
        
        response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name,
            audio: audioBase64
          }),
        });
      } else {
        // Use classic JS method
        const formData = new FormData();
        formData.append('name', name);
        formData.append('audio', audioFile);
        
        response = await fetch(endpoint, {
          method: 'POST',
          body: formData,
        });
      }
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to create reciter');
      }
      
      // Success!
      setSuccess(true);
      
      // Reset form
      setName('');
      setAudioFile(null);
      setAudioBase64(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      
      // Redirect to home after a brief delay
      setTimeout(() => {
        router.push('/');
      }, 2000);
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
            Add a new reciter to the database with enhanced audio fingerprinting
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
                Please upload a clear recording of the reciter (MP3 format recommended, 30 seconds to 2 minutes).
              </p>
            </div>
            
            <div>
              <Label>Processing Method</Label>
              <RadioGroup 
                value={processingMethod} 
                onValueChange={(value) => setProcessingMethod(value as 'js' | 'python')}
                className="mt-2"
              >
                <div className="flex items-start space-x-2 mb-2">
                  <RadioGroupItem value="python" id="python" />
                  <div>
                    <Label htmlFor="python" className="font-medium">
                      Enhanced Fingerprinting (Recommended)
                    </Label>
                    <p className="text-sm text-gray-500">
                      Uses advanced techniques: sequence matching, voice normalization, DTW
                    </p>
                  </div>
                </div>
                
                <div className="flex items-start space-x-2">
                  <RadioGroupItem value="js" id="js" />
                  <div>
                    <Label htmlFor="js" className="font-medium">
                      Classic Method
                    </Label>
                    <p className="text-sm text-gray-500">
                      Original method using simple vector matching
                    </p>
                  </div>
                </div>
              </RadioGroup>
            </div>
            
            <Button 
              type="submit" 
              className="w-full"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                'Create Reciter'
              )}
            </Button>
          </form>
        </CardContent>
        <CardFooter>
          <div className="w-full">
            <h3 className="font-medium mb-2">About Enhanced Fingerprinting</h3>
            <p className="text-sm text-gray-500 mb-2">
              The enhanced fingerprinting method uses advanced techniques to better identify reciters:
            </p>
            <ul className="text-sm text-gray-500 list-disc pl-5 space-y-1">
              <li>Dynamic Time Warping (DTW) for temporal sequence matching</li>
              <li>Voice normalization for better consistency across recordings</li>
              <li>Segmentation to compare matching verses</li>
              <li>Pitch contour tracking for tajweed characteristics</li>
              <li>Formant analysis to capture voice characteristics</li>
              <li>Pause pattern detection for individual reciter style</li>
            </ul>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
} 