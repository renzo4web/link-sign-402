import { useState } from 'react'
import { x402Client, x402HTTPClient, wrapFetchWithPayment } from '@x402/fetch'
import { registerExactEvmScheme } from '@x402/evm/exact/client'
import type { ClientEvmSigner } from '@x402/evm'

export type SignAgreementResponse = {
  agreementId: string
  signer: string
  paymentRef: string
  chainRef: string
  txHash: string
  confirmed?: boolean
  link: string
}

type SignResult =
  | { success: true; data: SignAgreementResponse }
  | { success: false; error: string }
  | null

export function useAgreementSign() {
  const [result, setResult] = useState<SignResult>(null)
  const [isLoading, setIsLoading] = useState(false)

  const sign = async (
    agreementId: string,
    signerAddress: string,
    getSigner: () => ClientEvmSigner | null
  ) => {
    const signer = getSigner()
    if (!signer) {
      setResult({ success: false, error: 'Wallet not ready' })
      return
    }

    setIsLoading(true)
    setResult(null)

    try {
      const client = new x402Client()
      const httpClient = new x402HTTPClient(client)
      registerExactEvmScheme(client, { signer })

      const fetchWithPayment = wrapFetchWithPayment(fetch, client)

      const res = await fetchWithPayment('/api/sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agreementId, signerAddress }),
      })

      if (res.ok) {
        const data = (await res.json()) as SignAgreementResponse
        setResult({ success: true, data })
        return
      }

      if (res.status === 402) {
        const body = (await res.json().catch(() => null)) as any
        let errorMessage = 'Payment required'

        if (body?.error) {
          errorMessage = body.details ? `${body.error}: ${body.details}` : body.error
        } else {
          try {
            const paymentRequired = httpClient.getPaymentRequiredResponse((name) =>
              res.headers.get(name)
            )
            if (paymentRequired.error) errorMessage = paymentRequired.error
          } catch (err) {
            errorMessage = err instanceof Error ? err.message : String(err)
          }
        }

        setResult({ success: false, error: errorMessage })
        return
      }

      const body = (await res.json().catch(() => ({}))) as any
      setResult({ success: false, error: body?.error || `Request failed (${res.status})` })
    } catch (e: any) {
      setResult({ success: false, error: e.message || String(e) })
    } finally {
      setIsLoading(false)
    }
  }

  const reset = () => setResult(null)

  return { result, isLoading, sign, reset }
}
