import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Mic, Play, CheckCircle, ArrowRight } from "lucide-react"
import Link from "next/link"

export default function Home() {
  // Simplified version without cookie-based auth check
  const isLoggedIn = false

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b">
        <div className="container flex h-16 items-center justify-between px-4 md:px-6">
          <div className="flex items-center gap-2">
            <span className="text-xl font-bold">Tajweed</span>
            <span className="text-xl font-bold text-emerald-600">Matcher</span>
          </div>
          <nav className="hidden md:flex gap-6">
            <Link href="#" className="text-sm font-medium hover:underline underline-offset-4">
              Home
            </Link>
            <Link href="#" className="text-sm font-medium hover:underline underline-offset-4">
              How It Works
            </Link>
            <Link href="#" className="text-sm font-medium hover:underline underline-offset-4">
              Reciters
            </Link>
            <Link href="/new-reciter" className="text-sm font-medium hover:underline underline-offset-4">
              Add Reciter
            </Link>
            <Link href="#" className="text-sm font-medium hover:underline underline-offset-4">
              About
            </Link>
          </nav>
          <div className="flex items-center gap-3">
            <Button className="bg-emerald-600 hover:bg-emerald-700" asChild>
              <Link href="/record">Try Now - No Sign Up!</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/auth/signin">Sign In</Link>
            </Button>
          </div>
        </div>
      </header>
      <main className="flex-1">
        <section className="w-full py-12 md:py-24 lg:py-32 bg-[url('/pattern-bg.png')] bg-opacity-5 bg-contain">
          <div className="container px-4 md:px-6">
            <div className="flex flex-col items-center justify-center space-y-4 text-center">
              <div className="space-y-2">
                <h1 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl lg:text-6xl/none">
                  Perfect Your Quranic Recitation
                </h1>
                <p className="mx-auto max-w-[700px] text-muted-foreground md:text-xl">
                  Receive personalized feedback by matching your voice to classical reciters.
                  <span className="block mt-2 text-emerald-600 font-semibold">Try instantly - no sign up required!</span>
                </p>
              </div>
              <div className="mx-auto w-full max-w-sm space-y-4 my-10">
                <div className="flex flex-col items-center justify-center space-y-4">
                  <Button
                    className="h-32 w-32 rounded-full bg-emerald-600 hover:bg-emerald-700 shadow-lg transition-all hover:scale-105"
                    size="icon"
                    asChild
                  >
                    <Link href="/record">
                      <Mic className="h-14 w-14" />
                      <span className="sr-only">Record Recitation</span>
                    </Link>
                  </Button>
                  <p className="text-md font-medium text-center">Record Surah Al-Fatiha to get started</p>
                  <p className="text-sm text-emerald-600 font-medium">No account needed - start immediately!</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="w-full py-12 md:py-24 lg:py-32">
          <div className="container px-4 md:px-6">
            <div className="flex flex-col items-center justify-center space-y-4 text-center">
              <div className="space-y-2">
                <h2 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl">How It Works</h2>
                <p className="mx-auto max-w-[700px] text-muted-foreground md:text-xl">
                  Three simple steps to improve your recitation with AI-powered analysis
                </p>
              </div>

              <div className="grid gap-6 sm:grid-cols-1 md:grid-cols-3 lg:gap-12 py-8">
                <Card className="flex flex-col items-center p-6 text-center shadow-md hover:shadow-lg transition-shadow border-t-4 border-t-emerald-600">
                  <div className="mb-4 rounded-full bg-emerald-100 p-3">
                    <Mic className="h-6 w-6 text-emerald-600" />
                  </div>
                  <h3 className="text-xl font-bold">1. Record</h3>
                  <p className="text-muted-foreground mt-2">
                    Record yourself reciting Surah Al-Fatiha using our simple interface
                  </p>
                  <div className="mt-6 flex items-center justify-center">
                    <div className="relative h-24 w-24 rounded-full bg-muted flex items-center justify-center">
                      <div className="absolute inset-0 rounded-full border-2 border-dashed border-muted-foreground animate-spin-slow"></div>
                      <Mic className="h-10 w-10 text-emerald-600" />
                    </div>
                  </div>
                </Card>

                <Card className="flex flex-col items-center p-6 text-center shadow-md hover:shadow-lg transition-shadow border-t-4 border-t-emerald-600">
                  <div className="mb-4 rounded-full bg-emerald-100 p-3">
                    <Play className="h-6 w-6 text-emerald-600" />
                  </div>
                  <h3 className="text-xl font-bold">2. Analyze</h3>
                  <p className="text-muted-foreground mt-2">
                    Our system analyzes your vocal traits and matches you to a classical reciter
                  </p>
                  <div className="mt-6 flex items-center justify-center">
                    <div className="relative h-24 w-24 flex items-center justify-center">
                      <div className="absolute inset-0 bg-emerald-100 rounded-lg"></div>
                      <div className="absolute h-full w-1/3 bg-emerald-300 animate-pulse"></div>
                      <div className="absolute h-1/2 w-1/4 bg-emerald-500 left-1/3 animate-pulse delay-100"></div>
                      <div className="absolute h-3/4 w-1/5 bg-emerald-400 left-2/3 animate-pulse delay-200"></div>
                    </div>
                  </div>
                </Card>

                <Card className="flex flex-col items-center p-6 text-center shadow-md hover:shadow-lg transition-shadow border-t-4 border-t-emerald-600">
                  <div className="mb-4 rounded-full bg-emerald-100 p-3">
                    <CheckCircle className="h-6 w-6 text-emerald-600" />
                  </div>
                  <h3 className="text-xl font-bold">3. Improve</h3>
                  <p className="text-muted-foreground mt-2">
                    Receive specific, actionable feedback to align with that reciter's style
                  </p>
                  <div className="mt-6 flex items-center justify-center">
                    <div className="relative h-24 w-24 flex flex-col items-center justify-center gap-2">
                      <div className="h-4 w-full bg-emerald-200 rounded-full overflow-hidden">
                        <div className="h-full w-3/4 bg-emerald-600 rounded-full"></div>
                      </div>
                      <div className="h-4 w-full bg-emerald-200 rounded-full overflow-hidden">
                        <div className="h-full w-1/2 bg-emerald-600 rounded-full"></div>
                      </div>
                      <div className="h-4 w-full bg-emerald-200 rounded-full overflow-hidden">
                        <div className="h-full w-5/6 bg-emerald-600 rounded-full"></div>
                      </div>
                    </div>
                  </div>
                </Card>
              </div>
            </div>
          </div>
        </section>

        <section className="w-full py-12 md:py-24 lg:py-32 bg-emerald-50 dark:bg-emerald-950/10">
          <div className="container px-4 md:px-6">
            <div className="grid gap-6 lg:grid-cols-2 lg:gap-12 items-center">
              <div className="space-y-4">
                <h2 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl">
                  Start Your Journey Today
                </h2>
                <p className="text-muted-foreground md:text-xl">
                  Join thousands of Muslims worldwide who are improving their Quranic recitation through our AI-powered
                  platform. No account required to get started!
                </p>
                <div className="flex flex-col sm:flex-row gap-4">
                  <Button className="bg-emerald-600 hover:bg-emerald-700" asChild>
                    <Link href="/record">
                      Try Now - Free! <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                  <Button variant="outline" asChild>
                    <Link href="/auth/signin">
                      Sign Up for History
                    </Link>
                  </Button>
                </div>
              </div>
              <div className="flex items-center justify-center">
                <div className="relative w-full max-w-sm">
                  <div className="absolute -left-4 -top-4 h-72 w-72 bg-emerald-100 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob"></div>
                  <div className="absolute -bottom-8 right-4 h-72 w-72 bg-emerald-200 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-2000"></div>
                  <div className="absolute -right-4 -top-12 h-72 w-72 bg-emerald-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-4000"></div>
                  <div className="relative">
                    <div className="rounded-lg border bg-card text-card-foreground shadow-lg p-6">
                      <div className="flex flex-col space-y-4">
                        <div className="flex items-center space-x-4">
                          <div className="h-12 w-12 rounded-full bg-emerald-100 flex items-center justify-center">
                            <span className="text-emerald-600 font-arabic text-xl">ق</span>
                          </div>
                          <div>
                            <h3 className="font-bold">Sheikh Abdul Basit</h3>
                            <p className="text-sm text-muted-foreground">Classical Reciter Match</p>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span>Tajweed Accuracy</span>
                            <span>78%</span>
                          </div>
                          <div className="h-2 w-full bg-emerald-100 rounded-full overflow-hidden">
                            <div className="h-full w-[78%] bg-emerald-600 rounded-full"></div>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span>Makhaarij (Pronunciation)</span>
                            <span>65%</span>
                          </div>
                          <div className="h-2 w-full bg-emerald-100 rounded-full overflow-hidden">
                            <div className="h-full w-[65%] bg-emerald-600 rounded-full"></div>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span>Rhythm & Pace</span>
                            <span>82%</span>
                          </div>
                          <div className="h-2 w-full bg-emerald-100 rounded-full overflow-hidden">
                            <div className="h-full w-[82%] bg-emerald-600 rounded-full"></div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
      <footer className="border-t bg-muted/40">
        <div className="container flex flex-col gap-4 py-10 md:flex-row md:gap-8 md:py-12">
          <div className="flex-1 space-y-4">
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold">Tajweed</span>
              <span className="text-xl font-bold text-emerald-600">Matcher</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Improving Quranic recitation through technology and tradition.
            </p>
          </div>
          <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-8">
            <div className="space-y-3">
              <h3 className="text-sm font-medium">Product</h3>
              <ul className="space-y-2 text-sm">
                <li>
                  <Link href="#" className="text-muted-foreground hover:text-foreground">
                    Features
                  </Link>
                </li>
                <li>
                  <Link href="#" className="text-muted-foreground hover:text-foreground">
                    Pricing
                  </Link>
                </li>
                <li>
                  <Link href="#" className="text-muted-foreground hover:text-foreground">
                    FAQ
                  </Link>
                </li>
              </ul>
            </div>
            <div className="space-y-3">
              <h3 className="text-sm font-medium">Company</h3>
              <ul className="space-y-2 text-sm">
                <li>
                  <Link href="#" className="text-muted-foreground hover:text-foreground">
                    About
                  </Link>
                </li>
                <li>
                  <Link href="#" className="text-muted-foreground hover:text-foreground">
                    Blog
                  </Link>
                </li>
                <li>
                  <Link href="#" className="text-muted-foreground hover:text-foreground">
                    Careers
                  </Link>
                </li>
              </ul>
            </div>
            <div className="space-y-3">
              <h3 className="text-sm font-medium">Resources</h3>
              <ul className="space-y-2 text-sm">
                <li>
                  <Link href="#" className="text-muted-foreground hover:text-foreground">
                    Reciters
                  </Link>
                </li>
                <li>
                  <Link href="#" className="text-muted-foreground hover:text-foreground">
                    Tutorials
                  </Link>
                </li>
                <li>
                  <Link href="#" className="text-muted-foreground hover:text-foreground">
                    Community
                  </Link>
                </li>
              </ul>
            </div>
            <div className="space-y-3">
              <h3 className="text-sm font-medium">Legal</h3>
              <ul className="space-y-2 text-sm">
                <li>
                  <Link href="#" className="text-muted-foreground hover:text-foreground">
                    Privacy
                  </Link>
                </li>
                <li>
                  <Link href="#" className="text-muted-foreground hover:text-foreground">
                    Terms
                  </Link>
                </li>
                <li>
                  <Link href="#" className="text-muted-foreground hover:text-foreground">
                    Contact
                  </Link>
                </li>
              </ul>
            </div>
          </div>
        </div>
        <div className="container flex flex-col items-center justify-between gap-4 py-6 md:h-14 md:flex-row md:py-0">
          <p className="text-center text-sm leading-loose text-muted-foreground md:text-left">
            © 2025 Tajweed Matcher. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  )
}
