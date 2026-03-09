'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'
import { X, Trash2 } from 'lucide-react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import type { Note, NoteCategory } from '@/types'

interface Props {
  note: Note | null
  categories: NoteCategory[]
  onClose: () => void
  onSaved: (note: Note, isEdit: boolean) => void
  onDelete?: () => void
}

function TiptapToolbar({ editor }: { editor: ReturnType<typeof useEditor> }) {
  if (!editor) return null

  const btn = (label: string, isActive: boolean, onClick: () => void) => (
    <button
      type="button"
      onClick={onClick}
      className={isActive ? 'is-active' : ''}
    >
      {label}
    </button>
  )

  return (
    <div className="tiptap-toolbar">
      {btn('B', editor.isActive('bold'), () => editor.chain().focus().toggleBold().run())}
      {btn('I', editor.isActive('italic'), () => editor.chain().focus().toggleItalic().run())}
      {btn('S', editor.isActive('strike'), () => editor.chain().focus().toggleStrike().run())}
      {btn('H1', editor.isActive('heading', { level: 1 }), () => editor.chain().focus().toggleHeading({ level: 1 }).run())}
      {btn('H2', editor.isActive('heading', { level: 2 }), () => editor.chain().focus().toggleHeading({ level: 2 }).run())}
      {btn('H3', editor.isActive('heading', { level: 3 }), () => editor.chain().focus().toggleHeading({ level: 3 }).run())}
      {btn('• Liste', editor.isActive('bulletList'), () => editor.chain().focus().toggleBulletList().run())}
      {btn('1. Liste', editor.isActive('orderedList'), () => editor.chain().focus().toggleOrderedList().run())}
      {btn('Kod', editor.isActive('codeBlock'), () => editor.chain().focus().toggleCodeBlock().run())}
      {btn('Alıntı', editor.isActive('blockquote'), () => editor.chain().focus().toggleBlockquote().run())}
    </div>
  )
}

export default function NotModal({ note, categories, onClose, onSaved, onDelete }: Props) {
  const [title, setTitle] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [tags, setTags] = useState('')
  const [isPinned, setIsPinned] = useState(false)
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: 'Not içeriğinizi buraya yazın...' }),
    ],
    content: '',
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: 'tiptap',
      },
    },
  })

  useEffect(() => {
    if (note) {
      setTitle(note.title)
      setCategoryId(note.category_id ?? '')
      setTags(note.tags.join(', '))
      setIsPinned(note.is_pinned)
      if (editor) {
        const content = typeof note.content === 'string' ? note.content : ''
        // If content looks like HTML, set it as HTML; otherwise set as text
        if (content.startsWith('<')) {
          editor.commands.setContent(content)
        } else {
          editor.commands.setContent(`<p>${content}</p>`)
        }
      }
    } else {
      setTitle(''); setCategoryId(''); setTags(''); setIsPinned(false)
      if (editor) editor.commands.setContent('')
    }
  }, [note, editor])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) { toast.error('Başlık gerekli'); return }
    setLoading(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // Save as HTML
    const htmlContent = editor?.getHTML() || ''

    const payload = {
      user_id: user.id,
      title: title.trim(),
      content: htmlContent,
      category_id: categoryId || null,
      tags: tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : [],
      is_pinned: isPinned,
      updated_at: new Date().toISOString(),
    }

    if (note) {
      const { data, error } = await supabase.from('notes').update(payload).eq('id', note.id).select().single()
      if (error) { toast.error('Güncellenemedi'); setLoading(false); return }
      toast.success('Not güncellendi')
      onSaved(data, true)
    } else {
      const { data, error } = await supabase.from('notes').insert({ ...payload, is_archived: false }).select().single()
      if (error) { toast.error('Eklenemedi'); setLoading(false); return }
      toast.success('Not eklendi')
      onSaved(data, false)
    }
    setLoading(false)
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 20, backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="animate-fade-in"
        style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, padding: 28, width: '100%', maxWidth: 640, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 24px 64px rgba(0,0,0,0.6)' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>
            {note ? 'Notu Düzenle' : 'Yeni Not'}
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={ls}>Başlık *</label>
            <input className="input" placeholder="Not başlığı" value={title} onChange={e => setTitle(e.target.value)} autoFocus />
          </div>

          {/* Rich Text Editor */}
          <div>
            <label style={ls}>İçerik</label>
            <div className="tiptap-editor">
              {editor && <TiptapToolbar editor={editor} />}
              <EditorContent editor={editor} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={ls}>Kategori</label>
              <select className="input" value={categoryId} onChange={e => setCategoryId(e.target.value)}>
                <option value="">Kategori Yok</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label style={ls}>Etiketler</label>
              <input className="input" placeholder="etiket1, etiket2" value={tags} onChange={e => setTags(e.target.value)} />
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <input type="checkbox" id="pinned" checked={isPinned} onChange={e => setIsPinned(e.target.checked)} style={{ width: 16, height: 16, accentColor: 'var(--accent)', cursor: 'pointer' }} />
            <label htmlFor="pinned" style={{ fontSize: 14, color: 'var(--text-primary)', cursor: 'pointer' }}>📌 Sabitle</label>
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
            {onDelete && (
              <button type="button" onClick={onDelete} style={{ padding: '10px 16px', backgroundColor: 'rgba(239,68,68,0.1)', color: 'var(--error)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Trash2 size={15} /> Sil
              </button>
            )}
            <button type="button" onClick={onClose} style={{ flex: 1, padding: '10px', backgroundColor: 'transparent', border: '1px solid var(--border)', color: 'var(--text-secondary)', borderRadius: 8, fontSize: 14, cursor: 'pointer' }}>
              İptal
            </button>
            <button type="submit" disabled={loading} style={{ flex: 2, padding: '10px', backgroundColor: 'var(--accent)', color: 'white', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}>
              {loading ? 'Kaydediliyor...' : (note ? 'Güncelle' : 'Kaydet')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

const ls: React.CSSProperties = { display: 'block', fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6, fontWeight: 500 }
