import { useEffect, useMemo, useState } from 'react'
import QRCode from 'qrcode'
import { useAvatarStore } from '../../stores/avatarStore'
import { useCollectionStore } from '../../stores/collectionStore'
import { encodeAppearance, decodeAppearance, avatarUrl, MAX_NAME } from '../../lib/avatarCode'
import ExportModelButton from './ExportModelButton'

/**
 * Handing your avatar to somebody, and taking one from them.
 *
 * The code shown here is the whole avatar, not a link to one held somewhere.
 * That is what lets two people in a room trade with no account, no server and
 * no connection between them — one holds up a screen, the other points a
 * camera at it. The code is also short enough to read aloud or type, which is
 * the fallback when there is no camera to point.
 */
export default function TradePanel() {
  const appearance = useAvatarStore()
  const { ownerName, setOwnerName, keep, has } = useCollectionStore()

  const code = useMemo(() => encodeAppearance(appearance), [appearance])
  const url = useMemo(() => avatarUrl(code, ownerName), [code, ownerName])

  const [qr, setQr] = useState<string | null>(null)
  const [copied, setCopied] = useState<'code' | 'link' | null>(null)

  useEffect(() => {
    let cancelled = false
    QRCode.toDataURL(url, {
      margin: 1,
      width: 260,
      color: { dark: '#12121a', light: '#ffffff' },
    })
      .then((image) => {
        if (!cancelled) setQr(image)
      })
      .catch((error) => console.warn('[trade] could not draw the code:', error))
    return () => {
      cancelled = true
    }
  }, [url])

  // The tick beside a copy button, cleared on a timer rather than left showing
  // forever, so it reads as "just happened" rather than as a state.
  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(null), 1600)
    return () => clearTimeout(timer)
  }, [copied])

  const copy = async (text: string, which: 'code' | 'link') => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(which)
    } catch {
      // Clipboard access is refused in plenty of ordinary situations — an
      // insecure origin, a webview without permission. The code is on screen
      // and selectable, so this is not worth an error dialog.
      console.warn('[trade] clipboard refused; the code is still on screen')
    }
  }

  const keepMine = () => {
    // Saving your own look before changing into something else, which is the
    // other half of a collection being useful.
    keep(code, ownerName.trim() ? `${ownerName.trim()} (me)` : 'My avatar')
  }

  return (
    <div className="space-y-4">
      <p className="text-xs leading-relaxed text-white/45">
        This code <em>is</em> your avatar &mdash; all 52 characters of it. Anyone who scans it gets
        the character itself, ready to keep, wear or change. No connection needed.
      </p>

      <div className="flex justify-center">
        {qr ? (
          <img
            src={qr}
            alt="QR code containing this avatar"
            className="h-40 w-40 rounded-lg bg-white p-1"
          />
        ) : (
          <div className="h-40 w-40 animate-pulse rounded-lg bg-white/10" />
        )}
      </div>

      <label className="block space-y-1.5">
        <span className="text-xs text-white/60">Trade as</span>
        <input
          type="text"
          value={ownerName}
          maxLength={MAX_NAME}
          onChange={(e) => setOwnerName(e.target.value)}
          placeholder="Your name"
          className="w-full rounded-md border border-white/15 bg-white/5 px-2.5 py-1.5 text-sm text-white placeholder:text-white/30 focus:border-white/40 focus:outline-none"
        />
      </label>

      <div className="space-y-1.5">
        <code className="block break-all rounded-md bg-black/40 px-2.5 py-2 font-mono text-[10px] leading-relaxed text-white/70">
          {code}
        </code>
        <div className="grid grid-cols-2 gap-1.5">
          <button
            type="button"
            onClick={() => copy(code, 'code')}
            className="rounded-md border border-white/15 px-2 py-1.5 text-xs text-white/70 transition hover:border-white/40 hover:text-white"
          >
            {copied === 'code' ? 'Copied' : 'Copy code'}
          </button>
          <button
            type="button"
            onClick={() => copy(url, 'link')}
            className="rounded-md border border-white/15 px-2 py-1.5 text-xs text-white/70 transition hover:border-white/40 hover:text-white"
          >
            {copied === 'link' ? 'Copied' : 'Copy link'}
          </button>
        </div>
      </div>

      <button
        type="button"
        onClick={keepMine}
        disabled={has(code)}
        className="w-full rounded-md border border-white/15 px-3 py-2 text-sm text-white/70 transition hover:border-white/40 hover:text-white disabled:cursor-default disabled:border-white/10 disabled:text-white/30"
      >
        {has(code) ? 'Already in your collection' : 'Save this look to my collection'}
      </button>

      <ImportField />
      <ExportModelButton />
    </div>
  )
}

/** Taking a code in by hand, for when there is no camera pointed at a screen —
 *  a code sent in a message, or read out over the phone. */
function ImportField() {
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [kept, setKept] = useState<string | null>(null)
  const keep = useCollectionStore((s) => s.keep)
  const wear = useAvatarStore((s) => s.wear)

  const decoded = useMemo(() => (text.trim() ? decodeAppearance(text) : null), [text])

  const submit = (action: 'keep' | 'wear') => {
    if (!decoded) {
      setError('That is not a code this app can read.')
      return
    }
    setError(null)
    const code = text.trim()
    if (action === 'keep') {
      const added = keep(code, 'Traded avatar')
      setKept(added ? 'Added to your collection.' : 'You already have that one.')
    } else {
      wear(decoded)
      setKept('Wearing it now.')
    }
    setText('')
  }

  useEffect(() => {
    if (!kept) return
    const timer = setTimeout(() => setKept(null), 2400)
    return () => clearTimeout(timer)
  }, [kept])

  return (
    <div className="space-y-1.5 border-t border-white/10 pt-4">
      <span className="text-xs text-white/60">Received a code?</span>
      <textarea
        value={text}
        onChange={(e) => {
          setText(e.target.value)
          setError(null)
        }}
        rows={2}
        placeholder="Paste it here"
        spellCheck={false}
        className="w-full resize-none rounded-md border border-white/15 bg-white/5 px-2.5 py-1.5 font-mono text-[10px] text-white placeholder:font-sans placeholder:text-xs placeholder:text-white/30 focus:border-white/40 focus:outline-none"
      />
      <div className="grid grid-cols-2 gap-1.5">
        <button
          type="button"
          onClick={() => submit('keep')}
          disabled={!text.trim()}
          className="rounded-md border border-white/15 px-2 py-1.5 text-xs text-white/70 transition hover:border-white/40 hover:text-white disabled:cursor-default disabled:border-white/10 disabled:text-white/30"
        >
          Keep it
        </button>
        <button
          type="button"
          onClick={() => submit('wear')}
          disabled={!text.trim()}
          className="rounded-md border border-white/15 px-2 py-1.5 text-xs text-white/70 transition hover:border-white/40 hover:text-white disabled:cursor-default disabled:border-white/10 disabled:text-white/30"
        >
          Try it on
        </button>
      </div>
      {error && <p className="text-xs text-red-300/80">{error}</p>}
      {kept && <p className="text-xs text-emerald-300/80">{kept}</p>}
    </div>
  )
}
