import { Link } from '@tanstack/react-router'
import { FileSignature, Home, PenTool } from 'lucide-react'

export default function Header() {
  return (
    <header className="p-4 flex items-center justify-between bg-gray-800 text-white shadow-lg">
      <Link to="/" className="flex items-center gap-2">
        <FileSignature size={28} className="text-cyan-400" />
        <span className="text-xl font-bold">LinkSign</span>
      </Link>

      <nav className="flex items-center gap-4">
        <Link
          to="/"
          className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-700 transition-colors"
          activeProps={{ className: 'flex items-center gap-2 px-3 py-2 rounded-lg bg-cyan-600' }}
        >
          <Home size={18} />
          <span>Home</span>
        </Link>
        <Link
          to="/create"
          className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-700 transition-colors"
          activeProps={{ className: 'flex items-center gap-2 px-3 py-2 rounded-lg bg-cyan-600' }}
        >
          <PenTool size={18} />
          <span>Create</span>
        </Link>
      </nav>
    </header>
  )
}
