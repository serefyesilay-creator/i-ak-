'use client'

import { useState, useMemo, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRealtime } from '@/hooks/useRealtime'
import toast from 'react-hot-toast'
import { Plus, Search, Pin, Archive, Trash2, FileText, Tag, X, Pencil, Check } from 'lucide-react'
import { format } from 'date-fns'
import { tr } from 'date-fns/locale'
import type { Note, NoteCategory } from '@/types'
import NotModal from './NotModal'

interface Props {
  initialNotes: Note[]
  categories: NoteCategory[]
}

const PRESET_COLORS = ['#6366F1', '#22C55E', '#F59E0B', '#EF4444', '#EC4899', '#14B8A6', '#8B5CF6', '#F97316']

export default function NotlarClient({ initialNotes, categories: initialCategories }: Props) {
  const [notes, setNotes] = useState<Note[]>(initialNotes)
  const [categories, setCategories] = useState<NoteCategory[]>(initialCategories)
  const [search, setSearch] = useState('')
  const [filterCat, setFilterCat] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [editingNote, setEditingNote] = useState<Note | null>(null)
  const [showCatModal, setShowCatModal] = useState(false)
  const [userId, setUserId] = useState<string>('')
  const supabase = createClient()

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setUserId(data.user.id)
    })
  }, [])

  useRealtime<Note>({
    table: 'notes', userId,
    onInsert: (row) => setNotes(prev => prev.some(n => n.id === row.id) ? prev : [row, ...prev]),
    onUpdate: (row) => setNotes(prev => prev.map(n => n.id === row.id ? row : n)),
    onDelete: (id) => setNotes(prev => prev.filter(n => n.id !== id)),
  })

  const filtered = useMemo(() => {
    let list = notes
    if (filterCat) list = list.filter(n => n.category_id === filterCat)
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(n =>
        n.title.toLowerCase().includes(q) ||
        (typeof n.content === 'string' && n.content.toLowerCase().includes(q))
      )
    }
    return list
  }, [notes, search, filterCat])

  async function togglePin(note: Note) {
    const { error } = await supabase.from('notes').update({ is_pinned: !note.is_pinned }).eq('id', note.id)
    if (error) { toast.error('Hata'); return }
    setNotes(prev => prev.map(n => n.id === note.id ? { ...n, is_pinned: !n.is_pinned } : n)
      .sort((a, b) => (b.is_pinned ? 1 : 0) - (a.is_pinned ? 1 : 0)))
    toast.success(note.is_pinned ? 'Sabitleme kaldırıldı' : 'Not sabitlendi')
  }

  async function archiveNote(note: Note) {
    const { error } = await supabase.from('notes').update({ is_archived: true }).eq('id', note.id)
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
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>Notlar</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => setShowCatModal(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 14px', backgroundColor: 'var(--bg-surface)', color: 'var(--text-secondary)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 14, cursor: 'pointer' }}
          >
            <Tag size={15} /> Kategoriler
          </button>
          <button
            onClick={() => { setEditingNote(null); setShowModal(true) }}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', backgroundColor: 'var(--accent)', color: 'white', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
          >
            <Plus size={16} /> Yeni Not
          </button>
        </div>
      </div>

      {/* Search */}
      <div style={{ position: 'relative', marginBottom: 14 }}>
        <Search size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
        <input
          className="input"
          placeholder="Notlarda ara..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ paddingLeft: 32 }}
        />
      </div>

      {/* Category Filter */}
      {categories.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 20 }}>
          <button
            onClick={() => setFilterCat(null)}
            style={{
              padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer',
              backgroundColor: filterCat === null ? 'var(--accent)' : 'var(--bg-surface)',
              color: filterCat === null ? 'white' : 'var(--text-secondary)',
              border: filterCat === null ? 'none' : '1px solid var(--border)',
            }}
          >
            Tümü
          </button>
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => setFilterCat(filterCat === cat.id ? null : cat.id)}
              style={{
                padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                backgroundColor: filterCat === cat.id ? `${cat.color}25` : 'var(--bg-surface)',
                color: filterCat === cat.id ? cat.color : 'var(--text-secondary)',
                border: `1px solid ${filterCat === cat.id ? cat.color + '60' : 'var(--border)'}`,
              }}
            >
              {cat.name}
            </button>
          ))}
        </div>
      )}

      {/* Notes Grid */}
      {filtered.length === 0 ? (
        <div className="card" style={{ padding: 60, textAlign: 'center', color: 'var(--text-secondary)' }}>
          <FileText size={48} style={{ margin: '0 auto 16px', opacity: 0.3 }} />
          <p style={{ fontSize: 16, fontWeight: 500 }}>Not bulunamadı</p>
        </div>
      ) : (
        <div>
          {pinnedNotes.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
                📌 Sabitlenmiş
              </p>
              <NoteGrid notes={pinnedNotes} categories={categories} onEdit={n => { setEditingNote(n); setShowModal(true) }} onPin={togglePin} onArchive={archiveNote} onDelete={deleteNote} />
            </div>
          )}
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

      {/* Note Modal */}
      {showModal && (
        <NotModal
          note={editingNote}
          categories={categories}
          onClose={() => { setShowModal(false); setEditingNote(null) }}
          onSaved={handleSaved}
          onDelete={editingNote ? () => deleteNote(editingNote.id) : undefined}
        />
      )}

      {/* Category Modal */}
      {showCatModal && (
        <CategoryModal
          categories={categories}
          onClose={() => setShowCatModal(false)}
          onChange={setCategories}
        />
      )}
    </div>
  )
}

// ─── Category Modal ───────────────────────────────────────────────────────────

function CategoryModal({ categories, onClose, onChange }: {
  categories: NoteCategory[]
  onClose: () => void
  onChange: (cats: NoteCategory[]) => void
}) {
  const supabase = createClient()
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState(PRESET_COLORS[0])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editColor, setEditColor] = useState('')
  const [saving, setSaving] = useState(false)

  async function addCategory() {
    if (!newName.trim()) { toast.error('Kategori adı zorunlu'); return }
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); return }
    const { data, error } = await supabase
      .from('note_categories')
      .insert({ user_id: user.id, name: newName.trim(), color: newColor })
      .select().single()
    if (error) { toast.error('Eklenemedi'); setSaving(false); return }
    onChange([...categories, data])
    setNewName('')
    setNewColor(PRESET_COLORS[0])
    toast.success('Kategori eklendi')
    setSaving(false)
  }

  async function saveEdit(id: string) {
    if (!editName.trim()) { toast.error('Ad boş olamaz'); return }
    const { error } = await supabase
      .from('note_categories')
      .update({ name: editName.trim(), color: editColor })
      .eq('id', id)
    if (error) { toast.error('Kaydedilemedi'); return }
    onChange(categories.map(c => c.id === id ? { ...c, name: editName.trim(), color: editColor } : c))
    setEditingId(null)
    toast.success('Kategori güncellendi')
  }

  async function deleteCategory(id: string) {
    if (!confirm('Bu kategoriyi silmek istiyor musunuz?')) return
    const { error } = await supabase.from('note_categories').delete().eq('id', id)
    if (error) { toast.error('Silinemedi'); return }
    onChange(categories.filter(c => c.id !== id))
    toast.success('Kategori silindi')
  }

  function startEdit(cat: NoteCategory) {
    setEditingId(cat.id)
    setEditName(cat.name)
    setEditColor(cat.color)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 20, backdropFilter: 'blur(4px)' }} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="animate-fade-in" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, padding: 28, width: '100%', maxWidth: 440, boxShadow: '0 24px 64px rgba(0,0,0,0.6)', maxHeight: '85vh', overflowY: 'auto' }}>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>Kategoriler</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}><X size={20} /></button>
        </div>

        {/* Existing Categories */}
        {categories.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Mevcut Kategoriler</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {categories.map(cat => (
                <div key={cat.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', backgroundColor: 'var(--bg-surface)', borderRadius: 8 }}>
                  {editingId === cat.id ? (
                    <>
                      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                        {PRESET_COLORS.map(c => (
                          <button key={c} onClick={() => setEditColor(c)} style={{ width: 16, height: 16, borderRadius: '50%', backgroundColor: c, border: editColor === c ? '2px solid white' : '2px solid transparent', cursor: 'pointer', padding: 0 }} />
                        ))}
                      </div>
                      <input
                        className="input"
                        value={editName}
                        onChange={e => setEditName(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') saveEdit(cat.id); if (e.key === 'Escape') setEditingId(null) }}
                        style={{ flex: 1, padding: '6px 10px', fontSize: 13 }}
                        autoFocus
                      />
                      <button onClick={() => saveEdit(cat.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#22C55E', padding: 4 }}><Check size={16} /></button>
                      <button onClick={() => setEditingId(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 4 }}><X size={16} /></button>
                    </>
                  ) : (
                    <>
                      <div style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: cat.color, flexShrink: 0 }} />
                      <span style={{ flex: 1, fontSize: 14, color: 'var(--text-primary)' }}>{cat.name}</span>
                      <button onClick={() => startEdit(cat)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 4, opacity: 0.6 }}><Pencil size={14} /></button>
                      <button onClick={() => deleteCategory(cat.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--error)', padding: 4, opacity: 0.6 }}><Trash2 size={14} /></button>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Add New */}
        <div>
          <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>Yeni Kategori</p>
          <div style={{ marginBottom: 10 }}>
            <label style={ls}>Renk</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {PRESET_COLORS.map(c => (
                <button
                  key={c}
                  onClick={() => setNewColor(c)}
                  style={{ width: 28, height: 28, borderRadius: '50%', backgroundColor: c, border: newColor === c ? '3px solid white' : '3px solid transparent', cursor: 'pointer', padding: 0, boxShadow: newColor === c ? `0 0 0 2px ${c}` : 'none', transition: 'box-shadow 0.15s' }}
                />
              ))}
            </div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={ls}>Kategori Adı</label>
            <input
              className="input"
              placeholder="Kişisel, İş, Fikirler vb."
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addCategory()}
            />
          </div>
          <button
            onClick={addCategory}
            disabled={saving || !newName.trim()}
            style={{ width: '100%', padding: '10px', backgroundColor: 'var(--accent)', color: 'white', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: saving || !newName.trim() ? 'not-allowed' : 'pointer', opacity: saving || !newName.trim() ? 0.6 : 1 }}
          >
            {saving ? 'Ekleniyor…' : 'Kategori Ekle'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Note Grid ────────────────────────────────────────────────────────────────

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
                  display: 'inline-block', fontSize: 11, padding: '2px 7px', borderRadius: 4,
                  backgroundColor: `${cat.color}20`, color: cat.color, marginBottom: 8, fontWeight: 600,
                }}
              >
                {cat.name}
              </span>
            )}
            <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>{note.title}</h3>
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
    <button onClick={onClick} title={title} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', borderRadius: 4, display: 'flex', alignItems: 'center', transition: 'background 0.15s' }}>
      {children}
    </button>
  )
}

const ls: React.CSSProperties = { display: 'block', fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6, fontWeight: 500 }
