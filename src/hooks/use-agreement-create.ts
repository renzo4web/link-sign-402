import { useState } from 'react'
import { x402Client, x402HTTPClient, wrapFetchWithPayment } from '@x402/fetch'
import { registerExactEvmScheme } from '@x402/evm/exact/client'
import type { ClientEvmSigner } from '@x402/evm'

export type CreateAgreementResponse = {
  agreementId: string
  docHash: string
  cid: string
  creator: string
  paymentRef: string
  chainRef: string
  txHash: string | null
  confirmed?: boolean
  link: string
  alreadyExisted?: boolean
}

type CreateResult =
  | { success: true; data: CreateAgreementResponse; fileName: string }
  | { success: false; error: string }
  | null

async function fileToBase64(file: File): Promise<string> {
  const buf = await file.arrayBuffer()
  const bytes = new Uint8Array(buf)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!)
  return btoa(binary)
}

export function useAgreementCreate() {
  const [result, setResult] = useState<CreateResult>(null)
  const [isLoading, setIsLoading] = useState(false)

  const create = async (
    file: File,
    creatorAddress: string,
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
      const fileBase64 = await fileToBase64(file)

      const client = new x402Client()
      const httpClient = new x402HTTPClient(client)
      registerExactEvmScheme(client, { signer })

      const fetchWithPayment = wrapFetchWithPayment(fetch, client)

      const res = await fetchWithPayment('/api/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileBase64,
          fileName: file.name,
          creatorAddress,
        }),
      })

      if (res.ok) {
        const data = (await res.json()) as CreateAgreementResponse
        setResult({ success: true, data, fileName: file.name })
      } else if (res.status === 402) {
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
      } else {
        const body = (await res.json().catch(() => ({}))) as any
        setResult({ success: false, error: body?.error || `Request failed (${res.status})` })
      }
    } catch (e: any) {
      setResult({ success: false, error: e.message || String(e) })
    } finally {
      setIsLoading(false)
    }
  }

  const reset = () => setResult(null)

  return { result, isLoading, create, reset }
}
