import { AuthForm } from "@/components/auth/auth-form"
import Link from "next/link"

export default function SignInPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b">
        <div className="container flex h-16 items-center justify-between px-4 md:px-6">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-xl font-bold">Tajweed</span>
            <span className="text-xl font-bold text-emerald-600">Matcher</span>
          </Link>
        </div>
      </header>
      <main className="flex-1 flex items-center justify-center p-4 bg-muted/40">
        <AuthForm />
      </main>
    </div>
  )
}
