import { useState } from 'react'
import { useAvatarStore } from '../../stores/avatarStore'
import { useCollectionStore, type KeptAvatar } from '../../stores/collectionStore'
import { decodeAppearance, MAX_NAME } from '../../lib/avatarCode'
import { HAIR_STYLES } from '../../three/avatar/hair'

/**
 * The avatars somebody is holding.
 *
 * Each row is drawn from its code rather than from a stored thumbnail. A real
 * rendered preview would mean standing up a scene per row, which for a dozen
 * avatars is a dozen WebGL contexts; the three colours that identify an avatar
 * at a glance are already in the code and cost nothing to read out of it.
 */
export default function Collection() {
  const avatars = useCollectionStore((s) => s.avatars)

  if (avatars.length === 0) {
    return (
      <p className="text-xs leading-relaxed text-white/45">
        Nothing here yet. Scan somebody&rsquo;s code, paste one into Trade, or save your own look to
        start a collection.
      </p>
    )
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-white/45">
        {avatars.length} {avatars.length === 1 ? 'avatar' : 'avatars'}. Wearing one does not lose
        it &mdash; it stays here.
      </p>
      {avatars.map((avatar) => (
        <Row key={avatar.id} avatar={avatar} />
      ))}
    </div>
  )
}

function Row({ avatar }: { avatar: KeptAvatar }) {
  const wear = useAvatarStore((s) => s.wear)
  const { remove, rename } = useCollectionStore()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(avatar.name)

  const appearance = decodeAppearance(avatar.code)

  const commit = () => {
    rename(avatar.id, draft)
    setEditing(false)
  }

  if (!appearance) {
    // A code kept by an older build that this one can no longer read. Saying
    // so beats a row that silently does nothing when tapped.
    return (
      <div className="flex items-center justify-between gap-2 rounded-md border border-white/10 bg-white/[0.03] px-2.5 py-2">
        <span className="min-w-0 truncate text-xs text-white/40">
          {avatar.name} &mdash; unreadable code
        </span>
        <button
          type="button"
          onClick={() => remove(avatar.id)}
          className="shrink-0 text-xs text-white/40 hover:text-red-300"
        >
          Remove
        </button>
      </div>
    )
  }

  const hairLabel = HAIR_STYLES.find((h) => h.value === appearance.hairStyle)?.label ?? 'Hair'

  return (
    <div className="rounded-md border border-white/10 bg-white/[0.03] p-2.5">
      <div className="flex items-center gap-2.5">
        {/* Skin, hair and top: the three that make one avatar recognisable
            from another in a list. */}
        <div className="flex shrink-0 gap-0.5" aria-hidden>
          {[appearance.skinColor, appearance.hairColor, appearance.topColor].map((color, i) => (
            <span
              key={i}
              className="h-8 w-2.5 rounded-sm border border-white/10"
              style={{ backgroundColor: color }}
            />
          ))}
        </div>

        <div className="min-w-0 flex-1">
          {editing ? (
            <input
              autoFocus
              value={draft}
              maxLength={MAX_NAME}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commit()
                if (e.key === 'Escape') {
                  setDraft(avatar.name)
                  setEditing(false)
                }
              }}
              className="w-full rounded border border-white/25 bg-black/30 px-1.5 py-0.5 text-sm text-white focus:outline-none"
            />
          ) : (
            <button
              type="button"
              onClick={() => setEditing(true)}
              title="Rename"
              className="block max-w-full truncate text-left text-sm text-white/85 hover:text-white"
            >
              {avatar.name}
            </button>
          )}
          <p className="truncate text-xs text-white/40">
            {hairLabel} · {appearance.expression}
            {appearance.hat !== 'none' && ` · ${appearance.hat}`}
          </p>
        </div>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-1.5">
        <button
          type="button"
          onClick={() => wear(appearance)}
          className="rounded border border-white/15 px-2 py-1 text-xs text-white/70 transition hover:border-white/40 hover:text-white"
        >
          Wear
        </button>
        <button
          type="button"
          onClick={() => remove(avatar.id)}
          className="rounded border border-white/15 px-2 py-1 text-xs text-white/50 transition hover:border-red-400/50 hover:text-red-300"
        >
          Remove
        </button>
      </div>
    </div>
  )
}
