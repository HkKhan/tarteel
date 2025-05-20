import type React from "react"
import "@/app/globals.css"
import { ThemeProvider } from "@/components/theme-provider"

export const metadata = {
  title: "Qiraa - Improve Your Quranic Recitation",
  description: "Improve your Quranic recitation with voice analysis and personalized feedback",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-background">
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem={false}
          disableTransitionOnChange
          storageKey="qiraa-theme"
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
