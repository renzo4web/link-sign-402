import { ConnectButton } from '@rainbow-me/rainbowkit'
import { useEffect, useState } from 'react'

export function WalletConnect() {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <div 
        aria-hidden="true" 
        style={{ 
          opacity: 0, 
          pointerEvents: 'none', 
          userSelect: 'none',
          height: '40px',
          width: '160px' 
        }} 
      />
    )
  }

  return <ConnectButton showBalance={false} accountStatus="address" chainStatus="icon" />
}
