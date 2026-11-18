'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, CalendarDays, FileText, FolderOpen, FolderPlus, LoaderCircle, LogOut, Pencil, Plus, Settings, Trash2 } from 'lucide-react'
import { useAccount } from '@/hooks/use-account'
import { emptyNotebook, importGuestNotebook, loadNotebook, NoteConflict, readLocalNotebook, updateNotebook, type Note } from '@/lib/notes'
import { getSupabase } from '@/lib/supabase'
import { noteLinks } from '@/lib/note-links'

const dateFormat = new Intl.DateTimeFormat('vi', { dateStyle: 'short', timeStyle: 'short' })

function nextVersion(previous?: string) {
  return new Date(Math.max(Date.now(), previous ? Date.parse(previous) + 1 : 0)).toISOString()
}

export function Notes() {
  const user = useAccount()
  if (user === undefined) return <main className="content" aria-busy="true"><LoaderCircle className="spin" /></main>
  return <Notebook key={user?.id ?? 'guest'} userId={user?.id} />
}

function Notebook({ userId }: { userId?: string }) {
  const [data, setData] = useState(emptyNotebook)
  const [ready, setReady] = useState(false)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const [error, setError] = useState('')
  const [folderId, setFolderId] = useState<string | null>(null)
  const [folderDraft, setFolderDraft] = useState<{ id: string; name: string } | null>(null)
  const [draft, setDraft] = useState<Note | null>(null)
  const [saved, setSaved] = useState(false)
  const [search, setSearch] = useState('')
  const [guestAvailable, setGuestAvailable] = useState(false)
  const [conflict, setConflict] = useState(false)
  const active = useRef(false)
  const request = useRef(0)
  const writing = useRef(false)
  const folder = data.folders.find(({ id }) => id === folderId)
  const original = data.notes.find(({ id }) => id === draft?.id)
  const dirty = !!draft && (original
    ? draft.title !== original.title || draft.body !== original.body || draft.folder_id !== original.folder_id
    : Boolean(draft.title || draft.body))

  const load = useCallback(async () => {
    const version = ++request.current
    setLoading(true)
    setLoadError(false)
    try {
      const notebook = await loadNotebook(userId)
      if (!active.current || version !== request.current) return
      setData(notebook)
      setReady(true)
      if (userId) {
        try {
          const guest = readLocalNotebook()
          setGuestAvailable(guest.folders.some((item) => !notebook.folders.some(({ id }) => id === item.id))
            || guest.notes.some((item) => !notebook.notes.some(({ id }) => id === item.id)))
        } catch {
          setGuestAvailable(false)
        }
      }
    } catch {
      if (active.current && version === request.current) setLoadError(true)
    } finally {
      if (active.current && version === request.current) setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    active.current = true
    let cancelled = false
    queueMicrotask(() => { if (!cancelled) void load() })
    return () => {
      active.current = false
      cancelled = true
      request.current += 1
    }
  }, [load])

  useEffect(() => {
    if (!dirty) return
    function protectDraft(event: BeforeUnloadEvent) {
      event.preventDefault()
    }
    window.addEventListener('beforeunload', protectDraft)
    return () => window.removeEventListener('beforeunload', protectDraft)
  }, [dirty])

  function canLeave() {
    return !dirty || window.confirm('Ghi chú có thay đổi chưa lưu. Bạn muốn rời đi?')
  }

  function selectFolder(id: string) {
    if (folderId === id || busy || !canLeave()) return
    setFolderId(id)
    setDraft(null)
    setSaved(false)
    setConflict(false)
    setFolderDraft(null)
    setError('')
  }

  function openDraft(note: Note | null) {
    if (busy || (note && note.id === draft?.id) || !canLeave()) return
    setDraft(note)
    if (note) setFolderId(note.folder_id)
    setSaved(false)
    setConflict(false)
    setError('')
  }

  function addNote() {
    if (!folder) return
    openDraft({ id: crypto.randomUUID(), folder_id: folder.id, title: '', body: '', updated_at: new Date().toISOString() })
  }

  async function commit(action: () => ReturnType<typeof updateNotebook>, onSaved: () => void) {
    if (writing.current || loading || !ready) return
    writing.current = true
    setBusy(true)
    setError('')
    try {
      const next = await action()
      if (!active.current) return
      setData(next)
      onSaved()
    } catch {
      if (active.current) setError('Không lưu được thay đổi. Nội dung bạn nhập vẫn còn. Hãy thử lại.')
    } finally {
      writing.current = false
      if (active.current) setBusy(false)
    }
  }

  function change(update: Parameters<typeof updateNotebook>[1], onSaved: () => void) {
    return commit(async () => {
      try {
        return await updateNotebook(data, update, userId)
      } catch (error) {
        if (active.current && error instanceof NoteConflict) setConflict(true)
        throw error
      }
    }, onSaved)
  }

  function saveFolder(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!folderDraft?.name.trim()) return
    const entry = { ...folderDraft, name: folderDraft.name.trim() }
    if (entry.id !== folderId && !canLeave()) return
    void change({ kind: 'folder', folder: entry }, () => {
      if (entry.id !== folderId) {
        setFolderId(entry.id)
        setDraft(null)
      }
      setFolderDraft(null)
    })
  }

  function saveNote(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!draft?.title.trim()) return
    const version = original?.updated_at
    const updated_at = nextVersion(version)
    const note = { ...draft, title: draft.title.trim(), updated_at }
    void change({ kind: 'save', note, previousVersion: version }, () => {
      setDraft(note)
      setFolderId(note.folder_id)
      setSaved(true)
      setConflict(false)
    })
  }

  async function readLatestVersion() {
    if (!draft || !window.confirm('Mở bản mới nhất? Hãy sao chép nội dung bạn đang viết trước khi tiếp tục.')) return
    const id = draft.id
    await commit(() => loadNotebook(userId).then((fresh) => {
      const latest = fresh.notes.find((note) => note.id === id)
      setDraft(latest ?? null)
      if (latest) setFolderId(latest.folder_id)
      return fresh
    }), () => { setConflict(false); setSaved(false) })
  }

  async function signOut() {
    if (busy || !canLeave()) return
    const result = await getSupabase()?.auth.signOut({ scope: 'local' })
    if (result?.error) setError('Không đăng xuất được. Hãy thử lại.')
  }

  const folders = [...data.folders].sort((a, b) => a.name.localeCompare(b.name, 'vi'))
  const query = search.trim().toLocaleLowerCase('vi')
  const notes = data.notes.filter(({ folder_id, title, body }) => query
    ? `${title}\n${body}`.toLocaleLowerCase('vi').includes(query)
    : folder_id === folderId)
    .sort((a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at))
  const links = draft ? noteLinks(draft.body) : []

  return <main className="workspace notes-workspace">
    <header className="topbar">
      <nav className="notes-nav" aria-label="Không gian của bạn">
        <Link href="/" onClick={(event) => { if (busy || !canLeave()) event.preventDefault() }}><CalendarDays size={18} /> Lịch</Link>
        <span aria-current="page"><FileText size={18} /> Ghi chú</span>
      </nav>
      <div className="notes-nav">
        <Link href="/account" aria-label="Cài đặt và dữ liệu" onClick={(event) => { if (busy || !canLeave()) event.preventDefault() }}><Settings size={18} /></Link>
        {userId
          ? <button className="notes-quiet" type="button" onClick={() => void signOut()} disabled={busy}><LogOut size={17} /> Đăng xuất</button>
          : <Link href="/login" className="notes-quiet" onClick={(event) => { if (busy || !canLeave()) event.preventDefault() }}>Đăng nhập</Link>}
      </div>
    </header>
    <div className="content notes-content">
      <div className="page-heading"><h1>Ghi chú<span className="heading-dot">.</span></h1></div>
      {!userId && <p className="guest-banner">Chế độ khách · Ghi chú được lưu trên trình duyệt này.</p>}
      {userId && guestAvailable && <div className="guest-banner">
        <span>Có thư mục hoặc ghi chú khách trên thiết bị này.</span>
        <button type="button" disabled={busy} onClick={() => void commit(() => importGuestNotebook(userId), () => setGuestAvailable(false))}>
          Nhập vào tài khoản
        </button>
      </div>}
      {loading && <p className="panel-empty" role="status"><LoaderCircle className="spin" /> Đang tải ghi chú…</p>}
      {loadError && <div className="error-banner" role="alert">
        <span>Không tải được ghi chú. Kiểm tra kết nối và cấu hình cơ sở dữ liệu.</span>
        <button type="button" onClick={() => void load()}>Thử lại</button>
      </div>}
      {error && !conflict && <p className="error-banner" role="alert">{error}</p>}
      {ready && <div className={`notes-grid ${draft ? 'has-draft' : ''}`}>
        <section className="notes-card notes-folders" aria-labelledby="folders-heading">
          <div className="notes-section-head">
            <h2 id="folders-heading">Thư mục</h2>
            <button type="button" className="notes-quiet" disabled={busy}
              onClick={() => setFolderDraft({ id: crypto.randomUUID(), name: '' })}><FolderPlus size={17} /> Thêm</button>
          </div>
          {folderDraft && <form className="notes-folder-form" onSubmit={saveFolder}>
            <label className="field">Tên thư mục<input autoFocus required maxLength={100} disabled={busy} value={folderDraft.name}
              onChange={(event) => setFolderDraft({ ...folderDraft, name: event.target.value })} /></label>
            <div className="notes-actions">
              <button className="notes-quiet" type="button" disabled={busy} onClick={() => setFolderDraft(null)}>Hủy</button>
              <button className="primary-button" disabled={busy || !folderDraft.name.trim()}>Lưu thư mục</button>
            </div>
          </form>}
          {folders.length ? <ul className="notes-list">{folders.map((item) => <li key={item.id}>
            <button type="button" aria-pressed={item.id === folderId} disabled={busy} onClick={() => selectFolder(item.id)}><FolderOpen size={17} /><span>{item.name}</span></button>
          </li>)}</ul> : <p className="notes-hint">Chưa có thư mục.</p>}
        </section>
        <section className="notes-card notes-index" aria-label="Ghi chú trong thư mục">
          <div className="notes-section-head">
            <h2>{folder?.name ?? 'Chọn thư mục'}</h2>
            {folder && <div className="notes-nav">
              <button type="button" className="notes-quiet" disabled={busy} aria-label="Đổi tên thư mục" title="Đổi tên thư mục" onClick={() => setFolderDraft(folder)}><Pencil size={17} /></button>
              <button type="button" className="notes-quiet" disabled={busy} aria-label="Xóa thư mục" title="Xóa thư mục" onClick={() => {
                if (!window.confirm(`Xóa thư mục “${folder.name}” và tất cả ghi chú bên trong?`)) return
                void change({ kind: 'deleteFolder', id: folder.id }, () => {
                  setFolderId(null)
                  setFolderDraft(null)
                  setDraft(null)
                  setConflict(false)
                })
              }}><Trash2 size={17} /></button>
            </div>}
          </div>
          <label className="field notes-search">Tìm trong tất cả ghi chú<input type="search" value={search}
            onChange={(event) => setSearch(event.target.value)} placeholder="Tên hoặc nội dung" /></label>
          {folder && <button className="notes-new primary-button" type="button" disabled={busy} onClick={addNote}><Plus size={17} /> Ghi chú mới</button>}
          {notes.length ? <ul className="notes-list">{notes.map((note) => <li key={note.id}>
            <button type="button" aria-pressed={draft?.id === note.id} disabled={busy} onClick={() => openDraft(note)}><FileText size={17} /><span>{note.title}</span></button>
          </li>)}</ul> : <p className="notes-hint">{query ? 'Không có ghi chú phù hợp.' : folder ? 'Thư mục này chưa có ghi chú.' : 'Tạo hoặc chọn một thư mục để bắt đầu.'}</p>}
        </section>
        <section className="notes-card notes-editor" aria-label="Soạn ghi chú">
          {draft ? <form onSubmit={saveNote} className="notes-form">
            <div className="notes-section-head">
              <button type="button" className="notes-quiet" disabled={busy} onClick={() => openDraft(null)}><ArrowLeft size={17} /> Danh sách</button>
              <span className="notes-status" role="status">{busy ? 'Đang lưu…' : dirty ? 'Chưa lưu' : saved ? 'Đã lưu' : original ? dateFormat.format(new Date(original.updated_at)) : ''}</span>
            </div>
            <label className="field">Tiêu đề<input required maxLength={180} disabled={busy} placeholder="Tên ghi chú" value={draft.title}
              onChange={(event) => setDraft({ ...draft, title: event.target.value })} /></label>
            <label className="field">Thư mục<select value={draft.folder_id} disabled={busy}
              onChange={(event) => setDraft({ ...draft, folder_id: event.target.value })}>
              {folders.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select></label>
            <label className="field">Nội dung<textarea rows={12} maxLength={50000} disabled={busy} placeholder="Viết ghi chú…" value={draft.body}
              onChange={(event) => setDraft({ ...draft, body: event.target.value })} /></label>
            {links.length > 0 && <div className="note-links">
              <h3>Liên kết</h3>
              <ul>{links.map((link) => <li key={link}><a href={link} target="_blank" rel="noopener noreferrer">{link}</a></li>)}</ul>
            </div>}
            {conflict && <div className="error-banner" role="alert">
              <span>Ghi chú đã thay đổi ở nơi khác. Bạn có thể sao chép bản đang viết trước khi tải bản mới nhất.</span>
              <button type="button" disabled={busy} onClick={() => void readLatestVersion()}>Mở bản mới nhất</button>
            </div>}
            <div className="notes-actions">
              {original && <button type="button" className="delete-button" disabled={busy} onClick={() => {
                if (window.confirm('Xóa ghi chú này?')) void change({ kind: 'delete', id: original.id }, () => setDraft(null))
              }}>Xóa ghi chú</button>}
              <button className="primary-button" disabled={busy || conflict || !draft.title.trim() || (!dirty && Boolean(original))}>Lưu ghi chú</button>
            </div>
          </form> : <div className="notes-editor-empty"><FileText size={28} /><p>Chọn một ghi chú để đọc hoặc viết ghi chú mới.</p></div>}
        </section>
      </div>}
    </div>
  </main>
}
