import { Hono } from 'hono'
import { paymentMiddleware } from 'x402-hono'
import { facilitator } from '@coinbase/x402'
import handler from '@tanstack/react-start/server-entry'
import { getServerConfig } from './config/env'

const app = new Hono()

// Get server configuration
const config = getServerConfig()

// Wallet tesoro que recibe los pagos de los usuarios
const payTo = config.blockchain.payToAddress as `0x${string}`

// x402 payment middleware para /api/create
// Usa CDP facilitator - requiere CDP_API_KEY_ID y CDP_API_KEY_SECRET
app.use(
  paymentMiddleware(
    payTo,
    {
      'POST /api/create': {
        price: config.payment.price,
        // @ts-ignore - Ignore TypeScript error for network type
        network: config.blockchain.network,
        config: {
          description: 'Create a new document contract',
        },
      },
    },
    facilitator
  )
)

// POST /api/create - Crear contrato (x402 protegido)
app.post('/api/create', async (c) => {
  const requestId = Math.random().toString(36).slice(2, 10)
  console.log('[x402][create][start]', {
    requestId,
    method: c.req.method,
    path: c.req.path,
    hasPaymentHeader: !!c.req.header('x-payment'),
    paymentHeaderPreview: c.req.header('x-payment')?.slice(0, 32),
  })

  // Log payment details from X-PAYMENT header (base64 JSON for exact EVM scheme)
  const paymentHeader = c.req.header('x-payment')
  if (paymentHeader) {
    try {
      const decoded = JSON.parse(atob(paymentHeader)) as {
        scheme: string
        network: string
        payload?: {
          authorization?: {
            from: string      // Wallet que paga
            to: string        // Contrato USDC
            value: string     // Monto en hex
            validAfter: string
            validBefore: string
            nonce: string
          }
          signature?: string
        }
      }
      const auth = decoded.payload?.authorization
      if (auth) {
        // EIP-3009 transferWithAuthorization:
        // - from: wallet que autoriza el pago
        // - to: wallet destino (payTo, quien recibe el dinero)
        // - value: monto en unidades atómicas (USDC = 6 decimales)
        // El contrato USDC procesa la tx
        const valueNum = parseInt(auth.value, 10) // Es decimal, no hex
        console.log('[x402][create][payment-auth]', {
          requestId,
          scheme: decoded.scheme,
          network: decoded.network,
          payer: auth.from,           // Wallet que paga
          recipient: auth.to,         // Wallet que recibe (payTo)
          valueAtomic: auth.value,    // Unidades atómicas
          valueUSDC: (valueNum / 1_000_000).toFixed(6),  // 250000 = $0.25
          isPayToCorrect: auth.to.toLowerCase() === payTo.toLowerCase(),
        })
      }
    } catch (error) {
      console.warn('[x402][create][payment][decode-error]', { requestId, error })
    }
  }

  try {
    const { docHash } = await c.req.json()

    console.log('[x402][create][payload]', {
      requestId,
      docHash,
    })

    const response = c.json({
      status: 'created',
      docHash,
      network: config.blockchain.network,
      contractAddress: config.blockchain.contractAddress,
    })

    console.log('[x402][create][success]', {
      requestId,
      docHash,
    })

    // Log X-PAYMENT-RESPONSE si está disponible (contiene txHash del settlement)
    const paymentResponse = response.headers.get('x-payment-response')
    if (paymentResponse) {
      try {
        const settlementData = JSON.parse(atob(paymentResponse))
        console.log('[x402][create][settlement]', {
          requestId,
          transaction: settlementData.transaction, // txHash de la transacción on-chain
          network: settlementData.network,
          payer: settlementData.payer,
          success: settlementData.success,
        })
      } catch (error) {
        console.warn('[x402][create][settlement][decode-error]', { requestId, error })
      }
    }

    return response
  } catch (error) {
    console.error('[x402][create][error]', { requestId, error })
    return c.json({ error: 'Invalid payload' }, 400)
  }
})

// Delegar SSR a TanStack Start
app.all('*', async (c) => {
  return handler.fetch(c.req.raw)
})

export default app
