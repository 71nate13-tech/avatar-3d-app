import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { MOMENTS, momentUrl } from '../data/moments'

/**
 * The codes themselves, so a moment can actually be tested by scanning one.
 *
 * Each is generated from the address the app is currently being served from,
 * rather than a hardcoded host. Scanned from a phone on the same network, a
 * code opened from the dev server therefore reaches that dev server; published
 * somewhere, the same code points at wherever it was published. Nothing needs
 * configuring for the demo to work.
 */
export default function MomentCodes() {
  const [codes, setCodes] = useState<Record<string, string>>({})

  useEffect(() => {
    let cancelled = false
    Promise.all(
      MOMENTS.map(async (moment) => {
        const url = momentUrl(moment.id)
        const image = await QRCode.toDataURL(url, {
          margin: 1,
          width: 220,
          color: { dark: '#12121a', light: '#ffffff' },
        })
        return [moment.id, image] as const
      }),
    ).then((entries) => {
      if (!cancelled) setCodes(Object.fromEntries(entries))
    })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="space-y-4">
      <p className="text-xs leading-relaxed text-white/45">
        Scan one with a phone camera to see your avatar inside that brand&rsquo;s scene. The phone
        has to be on the same network as this device.
      </p>
      {MOMENTS.map((moment) => (
        <div key={moment.id} className="flex items-center gap-3">
          {codes[moment.id] ? (
            <img
              src={codes[moment.id]}
              alt={`QR code for ${moment.brand}`}
              className="h-20 w-20 shrink-0 rounded bg-white"
            />
          ) : (
            <div className="h-20 w-20 shrink-0 animate-pulse rounded bg-white/10" />
          )}
          <div className="min-w-0">
            <p className="truncate text-sm text-white/85">{moment.brand}</p>
            <p className="truncate text-xs text-white/40">{moment.headline}</p>
            <a
              href={momentUrl(moment.id)}
              className="text-xs text-white/50 underline hover:text-white/80"
            >
              Open here
            </a>
          </div>
        </div>
      ))}
    </div>
  )
}
