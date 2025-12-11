# Environment Configuration

Este directorio contiene la configuración centralizada de variables de entorno.

## 📁 Estructura

```
src/config/
  ├── env.ts       # Configuración centralizada (usa AQUÍ todas las env vars)
  └── README.md    # Esta guía
```

## ✅ Ventajas de este Sistema

1. **Un solo lugar**: Todas las variables se cargan en `env.ts`
2. **Sin fallbacks**: Si falta algo, falla inmediatamente con error claro
3. **Separación clara**: Secretos del servidor vs variables públicas del cliente
4. **Type-safe**: TypeScript te ayuda a no mezclar server/client
5. **Detección temprana**: Errores en desarrollo, no en producción

## 🚀 Cómo Usar

### En el Cliente (Componentes React)

```tsx
import { getClientConfig } from '@/config/env'

function PaymentButton() {
  const config = getClientConfig()
  
  return (
    <button>
      Pay {config.payment.price} on {config.blockchain.networkName}
    </button>
  )
}
```

### En el Servidor (Server Functions)

```tsx
import { createServerFn } from '@tanstack/react-start'
import { getServerConfig } from '@/config/env'

export const processPayment = createServerFn()
  .handler(async () => {
    const config = getServerConfig()
    
    // Acceso a secretos (solo servidor)
    const apiKeyId = config.cdp.apiKeyId
    const apiKeySecret = config.cdp.apiKeySecret
    
    // Configuración de blockchain
    const payTo = config.blockchain.payToAddress
    const price = config.payment.price
    
    // ... lógica de pago
  })
```

### ❌ Errores Comunes

```tsx
// ❌ MALO: Intentar usar getServerConfig() en el cliente
function ClientComponent() {
  const config = getServerConfig() // ¡ERROR! Contiene secretos
}

// ✅ BUENO: Usar getClientConfig() en el cliente
function ClientComponent() {
  const config = getClientConfig() // ✅ Seguro
}
```

## � Wrangler Integration

The project uses both Vite and Wrangler. To keep variables in sync:

```bash
# After editing .env, sync to Wrangler
pnpm sync-wrangler
```

This auto-generates `.dev.vars` from your `.env` (server variables only).

For production Cloudflare Workers:
- **Secrets**: Use `wrangler secret put CDP_API_KEY_ID`
- **Public vars**: Add to `wrangler.jsonc` under `vars` section

## 🔧 Adding a New Variable

### Step 1: Add to `.env`

```bash
# Para servidor (secreto)
MY_API_SECRET="secret123"

# Para cliente (público)
VITE_MY_PUBLIC_VALUE="public123"
```

### Paso 2: Agregar a `src/env.d.ts`

```typescript
interface ImportMetaEnv {
  readonly VITE_MY_PUBLIC_VALUE: string
}

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      readonly MY_API_SECRET: string
    }
  }
}
```

### Paso 3: Agregar a `src/config/env.ts`

```typescript
// Para servidor
const serverConfig = {
  myApi: {
    secret: getEnvVar('MY_API_SECRET', process.env.MY_API_SECRET),
  },
}

// Para cliente
const clientConfig = {
  myPublic: {
    value: getEnvVar('VITE_MY_PUBLIC_VALUE', import.meta.env.VITE_MY_PUBLIC_VALUE),
  },
}
```

### Paso 4: Usar

```tsx
// Cliente
const config = getClientConfig()
console.log(config.myPublic.value)

// Servidor
const config = getServerConfig()
console.log(config.myApi.secret)
```

## 🛡️ Seguridad

- **Secretos**: Sin prefijo `VITE_` → Solo servidor
- **Públicos**: Con prefijo `VITE_` → Cliente + Servidor
- **Nunca**: Poner secretos con prefijo `VITE_`

## 🐛 Debugging

Si ves un error como:

```
❌ Missing required environment variable: VITE_PAYMENT_PRICE
Please check your .env file and ensure VITE_PAYMENT_PRICE is set.
```

**Solución:**
1. Verifica que `.env` existe
2. Verifica que la variable está definida
3. Reinicia el dev server: `pnpm dev`

## 📝 Checklist para Deploy

- [ ] Todas las variables están en `.env.example`
- [ ] `VITE_PAYMENT_PRICE` coincide con `PAYMENT_PRICE`
- [ ] Secretos NO tienen prefijo `VITE_`
- [ ] Variables públicas SÍ tienen prefijo `VITE_`
- [ ] `.env` está en `.gitignore`
- [ ] Variables configuradas en Cloudflare Workers dashboard
