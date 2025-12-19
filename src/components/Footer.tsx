export default function Footer() {
  return (
    <footer className="border-t border-border/60 bg-background">
      <div className="mx-auto max-w-5xl px-6 py-10">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">LinkSignX402</p>
            <p className="text-sm text-muted-foreground">
              This is a hackathon project built for the{' '}
              <a
                className="underline underline-offset-4 hover:text-foreground"
                href="https://www.x402hackathon.com/"
                target="_blank"
                rel="noopener noreferrer"
              >
                x402 Hackathon
              </a>
              .
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
            <a
              className="text-muted-foreground hover:text-foreground transition-colors"
              href="https://github.com/renzo4web"
              target="_blank"
              rel="noopener noreferrer"
            >
              GitHub
            </a>
            <a
              className="text-muted-foreground hover:text-foreground transition-colors"
              href="https://x.com/turbopila"
              target="_blank"
              rel="noopener noreferrer"
            >
              X (Twitter)
            </a>
            <a
              className="text-muted-foreground hover:text-foreground transition-colors"
              href="https://renzo.devpulse.xyz/"
              target="_blank"
              rel="noopener noreferrer"
            >
              Portfolio
            </a>
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-2 border-t border-border/50 pt-6 md:flex-row md:items-center md:justify-between">
          <p className="text-xs text-muted-foreground">© LinkSignX402. All rights reserved.</p>
          <p className="text-xs text-muted-foreground">
            Built by Renzo Barrios.
          </p>
        </div>
      </div>
    </footer>
  )
}
