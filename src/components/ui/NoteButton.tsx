'use client'

import { useState } from 'react'
import { StickyNote } from 'lucide-react'

interface Props {
  note: string | null
  onSave: (note: string | null) => Promise<void> | void
  /** Satır hover edildiğinde, not yokken bile ikon görünsün */
  showWhenEmpty?: boolean
  accent?: string
}

export default function NoteButton({ note, onSave, showWhenEmpty = false, accent = '#F59E0B' }: Props) {
  const [open, setOpen] = useState(false)
  const [hover, setHover] = useState(false)
  const [draft, setDraft] = useState(note ?? '')
  const [saving, setSaving] = useState(false)

  const hasNote = !!note && note.trim().length > 0
  const visible = hasNote || showWhenEmpty || open

  async function handleSave() {
    setSaving(true)
    const val = draft.trim()
    await onSave(val ? val : null)
    setSaving(false)
    setOpen(false)
  }

  function openEditor() {
    setDraft(note ?? '')
    setHover(false)
    setOpen(true)
  }

  return (
    <div style={{ position: 'relative', flexShrink: 0, display: 'flex' }}>
      <button
        onClick={openEditor}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        title={hasNote ? 'Notu görüntüle / düzenle' : 'Not ekle'}
        style={{
          background: 'none', border: 'none', padding: 4, display: 'flex',
          cursor: visible ? 'pointer' : 'default',
          color: hasNote ? accent : 'var(--text-secondary)',
          opacity: visible ? (hasNote ? 1 : 0.5) : 0,
          pointerEvents: visible ? 'auto' : 'none',
          transition: 'opacity 0.15s',
        }}
      >
        <StickyNote size={15} fill={hasNote ? accent : 'none'} />
      </button>

      {/* Tooltip — üstüne gelince notu oku */}
      {hover && hasNote && !open && (
        <div
          style={{
            position: 'absolute', bottom: '100%', right: 0, marginBottom: 6, zIndex: 60,
            backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8,
            padding: '8px 11px', width: 220, boxShadow: '0 12px 32px rgba(0,0,0,0.5)',
            fontSize: 12.5, lineHeight: 1.5, color: 'var(--text-primary)', whiteSpace: 'pre-wrap',
            textAlign: 'left',
          }}
        >
          {note}
        </div>
      )}

      {/* Düzenleme kutusu — tıklayınca aç, sonradan düzenle/sil */}
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 70 }} />
          <div
            style={{
              position: 'absolute', bottom: '100%', right: 0, marginBottom: 6, zIndex: 71,
              backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10,
              padding: 12, width: 244, boxShadow: '0 16px 40px rgba(0,0,0,0.6)', textAlign: 'left',
            }}
          >
            <textarea
              autoFocus
              value={draft}
              onChange={e => setDraft(e.target.value)}
              placeholder="Not yaz…"
              rows={3}
              onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSave() }}
              style={{
                width: '100%', resize: 'vertical', borderRadius: 8, border: '1px solid var(--border)',
                backgroundColor: 'var(--bg-body, #1a1a1a)', color: 'var(--text-primary)',
                fontSize: 13, padding: 8, fontFamily: 'inherit', outline: 'none', lineHeight: 1.5,
              }}
            />
            <div style={{ display: 'flex', gap: 6, marginTop: 8, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setOpen(false)}
                style={{ padding: '5px 10px', background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-secondary)', borderRadius: 6, fontSize: 12.5, cursor: 'pointer' }}
              >
                İptal
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                style={{ padding: '5px 12px', background: accent, border: 'none', color: '#fff', borderRadius: 6, fontSize: 12.5, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}
              >
                {saving ? '…' : 'Kaydet'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
