"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { formatDistanceToNow } from "date-fns"
import { Play, Info } from "lucide-react"
import Link from "next/link"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"

interface Recitation {
  id: string
  surah: string
  created_at: string
  tajweed_score: number | null
  pronunciation_score: number | null
  rhythm_score: number | null
  overall_score: number | null
  audio_url: string | null
  reciters: {
    name: string
    image_url: string | null
  } | null
}

interface RecitationHistoryProps {
  recitations: Recitation[]
}

export default function RecitationHistory({ recitations }: RecitationHistoryProps) {
  const [selectedRecitation, setSelectedRecitation] = useState<Recitation | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  const handleViewDetails = (recitation: Recitation) => {
    setSelectedRecitation(recitation)
    setIsDialogOpen(true)
  }

  if (recitations.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-10 text-center">
          <p className="mb-4 text-muted-foreground">You haven't recorded any recitations yet.</p>
          <Button className="bg-emerald-600 hover:bg-emerald-700" asChild>
            <Link href="/record">Record Your First Recitation</Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {recitations.map((recitation) => (
          <Card key={recitation.id} className="overflow-hidden">
            <CardHeader className="pb-2">
              <div className="flex justify-between items-center">
                <CardTitle className="text-lg">{recitation.surah}</CardTitle>
                <div className="text-sm text-muted-foreground">
                  {formatDistanceToNow(new Date(recitation.created_at), { addSuffix: true })}
                </div>
              </div>
              <CardDescription>Overall Score: {recitation.overall_score || 0}%</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  {recitation.reciters && (
                    <>
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={recitation.reciters.image_url || undefined} alt={recitation.reciters.name} />
                        <AvatarFallback>{recitation.reciters.name[0]}</AvatarFallback>
                      </Avatar>
                      <span className="text-sm">{recitation.reciters.name}</span>
                    </>
                  )}
                </div>
                <div className="flex gap-2">
                  {recitation.audio_url && (
                    <Button size="sm" variant="outline">
                      <Play className="h-4 w-4" />
                    </Button>
                  )}
                  <Button size="sm" variant="outline" onClick={() => handleViewDetails(recitation)}>
                    <Info className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        {selectedRecitation && (
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Recitation Details</DialogTitle>
              <DialogDescription>
                {selectedRecitation.surah} •{" "}
                {formatDistanceToNow(new Date(selectedRecitation.created_at), { addSuffix: true })}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              {selectedRecitation.audio_url && (
                <div className="rounded-md border p-2">
                  <audio controls className="w-full">
                    <source src={selectedRecitation.audio_url} type="audio/mpeg" />
                    Your browser does not support the audio element.
                  </audio>
                </div>
              )}

              <div className="space-y-2">
                <h4 className="text-sm font-medium">Matched Reciter</h4>
                {selectedRecitation.reciters ? (
                  <div className="flex items-center gap-2">
                    <Avatar className="h-8 w-8">
                      <AvatarImage
                        src={selectedRecitation.reciters.image_url || undefined}
                        alt={selectedRecitation.reciters.name}
                      />
                      <AvatarFallback>{selectedRecitation.reciters.name[0]}</AvatarFallback>
                    </Avatar>
                    <span>{selectedRecitation.reciters.name}</span>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No reciter match available</p>
                )}
              </div>

              <div className="space-y-2">
                <h4 className="text-sm font-medium">Scores</h4>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Tajweed</span>
                    <span>{selectedRecitation.tajweed_score || 0}%</span>
                  </div>
                  <div className="h-2 w-full bg-emerald-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-600 rounded-full"
                      style={{ width: `${selectedRecitation.tajweed_score || 0}%` }}
                    ></div>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Pronunciation</span>
                    <span>{selectedRecitation.pronunciation_score || 0}%</span>
                  </div>
                  <div className="h-2 w-full bg-emerald-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-600 rounded-full"
                      style={{ width: `${selectedRecitation.pronunciation_score || 0}%` }}
                    ></div>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Rhythm</span>
                    <span>{selectedRecitation.rhythm_score || 0}%</span>
                  </div>
                  <div className="h-2 w-full bg-emerald-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-600 rounded-full"
                      style={{ width: `${selectedRecitation.rhythm_score || 0}%` }}
                    ></div>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm font-medium">
                    <span>Overall</span>
                    <span>{selectedRecitation.overall_score || 0}%</span>
                  </div>
                  <div className="h-2 w-full bg-emerald-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-600 rounded-full"
                      style={{ width: `${selectedRecitation.overall_score || 0}%` }}
                    ></div>
                  </div>
                </div>
              </div>

              <div className="pt-2">
                <Button className="w-full bg-emerald-600 hover:bg-emerald-700" asChild>
                  <Link href={`/recitation/${selectedRecitation.id}`}>View Detailed Feedback</Link>
                </Button>
              </div>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </>
  )
}
