import { createFileRoute, Link } from '@tanstack/react-router'
import { FileSignature, Shield, Wallet } from 'lucide-react'

export const Route = createFileRoute('/')({ component: Home })

function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
      <section className="relative py-20 px-6 text-center">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-center gap-4 mb-6">
            <FileSignature size={64} className="text-cyan-400" />
            <h1 className="text-5xl md:text-6xl font-black text-white">
              LinkSign
            </h1>
          </div>

          <p className="text-2xl text-gray-300 mb-4">
            Digital handshakes on the blockchain
          </p>

          <p className="text-lg text-gray-400 max-w-2xl mx-auto mb-8">
            Write. Pay. Sign. On chain. Create agreements that are verified and
            immutable using x402 payments and blockchain signatures.
          </p>

          <Link
            to="/create"
            className="inline-block px-8 py-3 bg-cyan-500 hover:bg-cyan-600 text-white font-semibold rounded-lg transition-colors shadow-lg shadow-cyan-500/50"
          >
            Start a new handshake
          </Link>
        </div>
      </section>

      <section className="py-16 px-6 max-w-5xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
            <Wallet className="w-10 h-10 text-cyan-400 mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">
              No accounts needed
            </h3>
            <p className="text-gray-400">
              Just connect your wallet. No emails, no passwords, no accounts to
              manage.
            </p>
          </div>

          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
            <Shield className="w-10 h-10 text-cyan-400 mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">
              Pay with x402
            </h3>
            <p className="text-gray-400">
              Micropayments via the x402 protocol. Create for $0.25, sign for
              $0.10.
            </p>
          </div>

          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
            <FileSignature className="w-10 h-10 text-cyan-400 mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">
              Blockchain proof
            </h3>
            <p className="text-gray-400">
              Your agreement fingerprint is stored on-chain. Immutable and
              verifiable forever.
            </p>
          </div>
        </div>
      </section>
    </div>
  )
}
