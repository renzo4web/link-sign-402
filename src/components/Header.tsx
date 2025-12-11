import { Link } from '@tanstack/react-router'
import { FileSignature, Home, PenTool } from 'lucide-react'
import { Button } from './ui/button'

export default function Header() {
  return (
    <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between transition-all">
        <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <div className="p-2 rounded-lg bg-primary/10">
            <FileSignature className="w-5 h-5 text-primary" />
          </div>
          <span className="text-xl font-bold tracking-tight">LinkSignX402</span>
        </Link>

        <nav className="flex items-center gap-2">
          <Link to="/">
            {({ isActive }) => (
              <Button variant={isActive ? 'secondary' : 'ghost'} size="sm" className="gap-2">
                <Home className="w-4 h-4" />
                <span>Home</span>
              </Button>
            )}
          </Link>
          <Link to="/create">
            {({ isActive }) => (
              <Button variant={isActive ? 'secondary' : 'ghost'} size="sm" className="gap-2">
                <PenTool className="w-4 h-4" />
                <span>Create</span>
              </Button>
            )}
          </Link>
        </nav>
      </div>
    </header>
  )
}
