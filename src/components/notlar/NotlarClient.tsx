'use client'

import { useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'
import { Plus, Search, Pin, Archive, Trash2, FileText } from 'lucide-react'
import { format } from 'date-fns'
import { tr } from 'date-fns/locale'
import type { Note, NoteCategory } from '@/types'
import NotModal from './NotModal'

interface Props {
  initialNotes: Note[]
  categories: NoteCategory[]
}

export default function NotlarClient({ initialNotes, categories }: Props) {
  const [notes, setNotes] = useState<Note[]>(initialNotes)
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingNote, setEditingNote] = useState<Note | null>(null)
  const supabase = createClient()

  const filtered = useMemo(() => {
    if (!search) return notes
    const q = search.toLowerCase()
    return notes.filter(n =>
      n.title.toLowerCase().includes(q) ||
      (typeof n.content === 'string' && n.content.toLowerCase().includes(q))
    )
  }, [notes, search])

  async function togglePin(note: Note) {
    const { error } = await supabase
      .from('notes')
      .update({ is_pinned: !note.is_pinned })
      .eq('id', note.id)

    if (error) { toast.error('Hata'); return }
    setNotes(prev => prev.map(n => n.id === note.id ? { ...n, is_pinned: !n.is_pinned } : n)
      .sort((a, b) => (b.is_pinned ? 1 : 0) - (a.is_pinned ? 1 : 0)))
    toast.success(note.is_pinned ? 'Sabitleme kaldırıldı' : 'Not sabitlendi')
  }

  async function archiveNote(note: Note) {
    const { error } = await supabase
      .from('notes')
      .update({ is_archived: true })
      .eq('id', note.id)

    if (error) { toast.error('Hata'); return }
    setNotes(prev => prev.filter(n => n.id !== note.id))
    toast.success('Not arşivlendi')
  }

  async function deleteNote(id: string) {
    if (!confirm('Bu notu silmek istediğinize emin misiniz?')) return
    const { error } = await supabase.from('notes').delete().eq('id', id)
    if (error) { toast.error('Silinemedi'); return }
    setNotes(prev => prev.filter(n => n.id !== id))
    toast.success('Not silindi')
    setShowModal(false)
    setEditingNote(null)
  }

  function handleSaved(note: Note, isEdit: boolean) {
    if (isEdit) {
      setNotes(prev => prev.map(n => n.id === note.id ? note : n))
    } else {
      setNotes(prev => [note, ...prev])
    }
    setShowModal(false)
    setEditingNote(null)
  }

  const pinnedNotes = filtered.filter(n => n.is_pinned)
  const regularNotes = filtered.filter(n => !n.is_pinned)

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>Notlar</h1>
        <button
          onClick={() => { setEditingNote(null); setShowModal(true) }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '9px 16px',
            backgroundColor: 'var(--accent)',
            color: 'white',
            border: 'none',
            borderRadius: 8,
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          <Plus size={16} /> Yeni Not
        </button>
      </div>

      {/* Search */}
      <div style={{ position: 'relative', marginBottom: 20 }}>
        <Search size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
        <input
          className="input"
          placeholder="Notlarda ara..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ paddingLeft: 32 }}
        />
      </div>

      {filtered.length === 0 ? (
        <div className="card" style={{ padding: 60, textAlign: 'center', color: 'var(--text-secondary)' }}>
          <FileText size={48} style={{ margin: '0 auto 16px', opacity: 0.3 }} />
          <p style={{ fontSize: 16, fontWeight: 500 }}>Not bulunamadı</p>
        </div>
      ) : (
        <div>
          {/* Pinned */}
          {pinnedNotes.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
                📌 Sabitlenmiş
              </p>
              <NoteGrid notes={pinnedNotes} categories={categories} onEdit={n => { setEditingNote(n); setShowModal(true) }} onPin={togglePin} onArchive={archiveNote} onDelete={deleteNote} />
            </div>
          )}

          {/* Regular */}
          {regularNotes.length > 0 && (
            <div>
              {pinnedNotes.length > 0 && (
                <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
                  Diğer Notlar
                </p>
              )}
              <NoteGrid notes={regularNotes} categories={categories} onEdit={n => { setEditingNote(n); setShowModal(true) }} onPin={togglePin} onArchive={archiveNote} onDelete={deleteNote} />
            </div>
          )}
        </div>
      )}

      {showModal && (
        <NotModal
          note={editingNote}
          categories={categories}
          onClose={() => { setShowModal(false); setEditingNote(null) }}
          onSaved={handleSaved}
          onDelete={editingNote ? () => deleteNote(editingNote.id) : undefined}
        />
      )}
    </div>
  )
}

function NoteGrid({ notes, categories, onEdit, onPin, onArchive, onDelete }: {
  notes: Note[]
  categories: NoteCategory[]
  onEdit: (n: Note) => void
  onPin: (n: Note) => void
  onArchive: (n: Note) => void
  onDelete: (id: string) => void
}) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 12 }}>
      {notes.map(note => {
        const cat = categories.find(c => c.id === note.category_id)
        const rawContent = typeof note.content === 'string'
          ? note.content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 100)
          : ''

        return (
          <div
            key={note.id}
            className="card"
            style={{ padding: 16, cursor: 'pointer', position: 'relative' }}
            onClick={() => onEdit(note)}
          >
            {cat && (
              <span
                style={{
                  display: 'inline-block',
                  fontSize: 11,
                  padding: '2px 7px',
                  borderRadius: 4,
                  backgroundColor: `${cat.color}20`,
                  color: cat.color,
                  marginBottom: 8,
                  fontWeight: 600,
                }}
              >
                {cat.name}
              </span>
            )}
            <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>
              {note.title}
            </h3>
            {rawContent && (
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                {rawContent}{rawContent.length >= 100 ? '...' : ''}
              </p>
            )}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 }}>
              <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                {format(new Date(note.updated_at), 'd MMM HH:mm', { locale: tr })}
              </span>
              <div style={{ display: 'flex', gap: 4 }} onClick={e => e.stopPropagation()}>
                <ActionBtn onClick={() => onPin(note)} title={note.is_pinned ? 'Sabitlemeyi kaldır' : 'Sabitle'}>
                  <Pin size={13} color={note.is_pinned ? 'var(--accent)' : 'var(--text-secondary)'} />
                </ActionBtn>
                <ActionBtn onClick={() => onArchive(note)} title="Arşivle">
                  <Archive size={13} color="var(--text-secondary)" />
                </ActionBtn>
                <ActionBtn onClick={() => onDelete(note.id)} title="Sil">
                  <Trash2 size={13} color="var(--error)" />
                </ActionBtn>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function ActionBtn({ children, onClick, title }: { children: React.ReactNode; onClick: () => void; title: string }) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        padding: '4px',
        borderRadius: 4,
        display: 'flex',
        alignItems: 'center',
        transition: 'background 0.15s',
      }}
    >
      {children}
    </button>
  )
}
