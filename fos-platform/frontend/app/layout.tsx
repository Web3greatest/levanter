import type { Metadata } from 'next'
import './globals.css'
import { Toaster } from 'react-hot-toast'

export const metadata: Metadata = {
  title: 'Founder Operating System',
  description: 'The world\'s most advanced AI platform for founders and builders.',
  icons: { icon: '/favicon.ico' },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body className="bg-surface text-white h-screen overflow-hidden">
        {children}
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: { background: '#1a1a1b', color: '#e8e8ea', border: '1px solid #2a2a2b' },
          }}
        />
      </body>
    </html>
  )
}
