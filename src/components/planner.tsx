'use client'

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import Link from 'next/link'
import { addMonths, addWeeks, format, isSameMonth, parseISO } from 'date-fns'
import { vi } from 'date-fns/locale'
import { ArrowDownUp, CalendarDays, Check, ChevronLeft, ChevronRight, CircleHelp, Clock3, FileText, ListFilter, LoaderCircle, LogIn, LogOut, MoreHorizontal, Plus, RotateCcw, Settings, X } from 'lucide-react'
import type { User } from '@supabase/supabase-js'
import { useAccount } from '@/hooks/use-account'
import { useTasks } from '@/hooks/use-tasks'
import { getSupabase } from '@/lib/supabase'
import { calendarDays, dateKey, defaultWarningDays, isDueSoon, isOverdue, todayKey, visibleTasks, warningDaysSchema, type Task, type TaskFilter, type TaskInput, type TaskSort } from '@/lib/task'

type Modal = { kind: 'closed' } | { kind: 'create'; date: string } | { kind: 'edit'; task: Task }
type ContextMenu = { task: Task; x: number; y: number } | null
const weekdays = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']
const filters: { key: TaskFilter; label: string }[] = [
  { key: 'all', label: 'Tất cả' }, { key: 'today', label: 'Hôm nay' }, { key: 'week', label: 'Tuần này' }, { key: 'dueSoon', label: 'Gần đến hạn' }, { key: 'done', label: 'Hoàn thành' },
]
const priorities = { low: 'Thấp', medium: 'Vừa', high: 'Cao' }
const mobileQuery = '(max-width: 700px)'
function subscribeMobile(callback: () => void) { const query = window.matchMedia(mobileQuery); query.addEventListener('change', callback); return () => query.removeEventListener('change', callback) }
function mobileSnapshot() { return window.matchMedia(mobileQuery).matches }

export function Planner() {
  const user = useAccount()
  const [authError, setAuthError] = useState(false)
  useEffect(() => {
    const url = new URL(window.location.href)
    const hash = new URLSearchParams(url.hash.slice(1))
    if (!url.searchParams.has('error') && !hash.has('error')) return
    window.history.replaceState(null, '', '/')
    queueMicrotask(() => setAuthError(true))
  }, [])
  if (authError) return <main className="content">
    <p className="error-banner" role="alert">Không hoàn tất đăng nhập. Hãy thử lại.</p>
    <Link href="/login" className="primary-button">Đăng nhập</Link>
  </main>
  if (user === undefined) return <main className="content" aria-busy="true"><LoaderCircle className="spin" /></main>
  return <AccountPlanner key={user?.id ?? 'guest'} user={user} />
}

function AccountPlanner({ user }: { user: User | null }) {
  const { tasks, account, loading, error, setError, save, remove, guestCount, importGuestTasks, reload } = useTasks(user)
  const [anchor, setAnchor] = useState(() => new Date())
  const [today, setToday] = useState(todayKey)
  const selectedDate = dateKey(anchor)
  const [chosenView, setView] = useState<'month' | 'week' | null>(null)
  const isMobile = useSyncExternalStore(subscribeMobile, mobileSnapshot, () => false)
  const view = chosenView ?? (isMobile ? 'week' : 'month')
  const [filter, setFilter] = useState<TaskFilter>('all')
  const [sort, setSort] = useState<TaskSort>('date')
  const [tag, setTag] = useState<string | null>(null)
  const [modal, setModal] = useState<Modal>({ kind: 'closed' })
  const [menu, setMenu] = useState<ContextMenu>(null)
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const suppressClick = useRef(false)
  const taskPanel = useRef<HTMLElement>(null)

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    function refreshToday() {
      clearTimeout(timer)
      const now = new Date()
      setToday(dateKey(now))
      const midnight = new Date(now)
      midnight.setHours(24, 0, 0, 0)
      timer = setTimeout(refreshToday, midnight.getTime() - now.getTime())
    }
    timer = setTimeout(refreshToday, 0)
    window.addEventListener('focus', refreshToday)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('focus', refreshToday)
    }
  }, [])

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) { if (event.key === 'Escape') setMenu(null) }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [])

  const days = useMemo(() => calendarDays(anchor, view), [anchor, view])
  const shownTasks = useMemo(() => visibleTasks(tasks, filter, sort, tag, parseISO(today)), [tasks, filter, sort, tag, today])
  const byDate = useMemo(() => {
    const map = new Map<string, Task[]>()
    for (const task of shownTasks) map.set(task.due_date, [...(map.get(task.due_date) ?? []), task])
    return map
  }, [shownTasks])
  const selectedTasks = filter === 'all' ? (byDate.get(selectedDate) ?? []) : shownTasks
  const filterTitle = filters.find(({ key }) => key === filter)?.label
  const dueSoonCount = tasks.filter((task) => isDueSoon(task, parseISO(today))).length
  const tags = [...new Set(tasks.map((task) => task.tag).filter((value): value is string => Boolean(value)))].sort()
  const openCount = tasks.filter((task) => task.status !== 'done').length
  const doneCount = tasks.filter((task) => task.status === 'done').length

  async function signOut() {
    const result = await getSupabase()?.auth.signOut({ scope: 'local' })
    if (result?.error) setError('Không đăng xuất được. Hãy thử lại.')
  }

  function move(direction: -1 | 1) {
    setAnchor((current) => view === 'month' ? addMonths(current, direction) : addWeeks(current, direction))
  }

  function revealTasks() {
    requestAnimationFrame(() => taskPanel.current?.scrollIntoView({ block: 'nearest' }))
  }

  function selectFilter(next: TaskFilter) {
    setFilter(next)
    setTag(null)
    if (next === 'today' || next === 'week') {
      setAnchor(new Date())
      if (next === 'week') setView('week')
    }
    if (next !== 'all') revealTasks()
  }

  function selectDay(day: Date) {
    setAnchor(day)
    setFilter('all')
    setTag(null)
    revealTasks()
  }

  function openMenu(task: Task, x: number, y: number) {
    setMenu({ task, x: Math.max(8, Math.min(x, window.innerWidth - 200)), y: Math.max(8, Math.min(y, window.innerHeight - 170)) })
  }

  function taskChip(task: Task) {
    return <button key={task.id} type="button" draggable onDragStart={(event) => event.dataTransfer.setData('text/plain', task.id)}
      onClick={(event) => { event.stopPropagation(); if (suppressClick.current) { suppressClick.current = false; return } setModal({ kind: 'edit', task }) }}
      onContextMenu={(event) => { event.preventDefault(); event.stopPropagation(); openMenu(task, event.clientX, event.clientY) }}
      onTouchStart={(event) => { const touch = event.touches[0]; pressTimer.current = setTimeout(() => { suppressClick.current = true; openMenu(task, touch.clientX, touch.clientY) }, 550) }}
      onTouchEnd={() => { if (pressTimer.current) clearTimeout(pressTimer.current) }}
      onTouchMove={() => { if (pressTimer.current) clearTimeout(pressTimer.current) }}
      className={`task-chip priority-${task.priority} ${task.status === 'done' ? 'is-done' : ''} ${isOverdue(task, today) ? 'is-overdue' : ''}`}
      title={`${task.title} · ${priorities[task.priority]}`}>
      <span className="chip-dot" /> <span className="chip-text">{task.due_time && <span className="chip-time">{task.due_time.slice(0, 5)} </span>}{task.title}</span>
    </button>
  }

  async function quickComplete(task: Task) {
    setMenu(null)
    await save({ title: task.title, description: task.description, due_date: task.due_date, due_time: task.due_time, priority: task.priority, tag: task.tag, status: task.status === 'done' ? 'todo' : 'done' }, task)
  }

  const dayPanel = <section ref={taskPanel} className="day-panel" aria-labelledby="task-panel-heading">
    <div className="day-panel-heading">
      <h2 id="task-panel-heading">{filter === 'all' ? format(anchor, "EEEE, dd 'tháng' MM", { locale: vi }) : filterTitle}</h2>
      <button type="button" onClick={() => setModal({ kind: 'create', date: selectedDate })}><Plus size={17} /> Thêm việc</button>
    </div>
    {loading ? <div className="panel-empty" role="status"><LoaderCircle className="spin" size={26} /> Đang tải công việc…</div>
      : selectedTasks.length ? <div className="panel-task-list">{selectedTasks.map((task) => {
        const done = task.status === 'done'
        const details = [
          filter !== 'all' && format(parseISO(task.due_date), 'dd/MM'),
          task.due_time?.slice(0, 5), priorities[task.priority], task.tag,
        ].filter(Boolean).join(' · ')
        return <div className="panel-task" key={task.id}>
          <button type="button" className={`task-check ${done ? 'checked' : ''}`}
            aria-label={done ? 'Đánh dấu chưa xong' : 'Đánh dấu hoàn thành'}
            onClick={() => void quickComplete(task)}>{done && <Check size={15} />}</button>
          <button type="button" className="panel-task-main" onClick={() => setModal({ kind: 'edit', task })}>
            <strong className={done ? 'strike' : ''}>{task.title}</strong><span>{details}</span>
          </button>
          <button type="button" className="more-button" aria-label={`Thao tác với ${task.title}`}
            aria-expanded={menu?.task.id === task.id} onClick={(event) => {
              event.stopPropagation()
              if (menu?.task.id === task.id) { setMenu(null); return }
              const bounds = event.currentTarget.getBoundingClientRect()
              openMenu(task, bounds.right - 190, bounds.bottom + 4)
            }}><MoreHorizontal size={20} /></button>
        </div>
      })}</div> : <div className="panel-empty">
        <strong>{filter === 'all' ? 'Ngày này còn trống' : 'Không có công việc phù hợp'}</strong>
      </div>}
  </section>

  return <div className="app-shell" onClick={() => menu && setMenu(null)}>
    <aside className="sidebar">
      <div className="sidebar-top"><div className="brand"><span className="brand-icon"><CalendarDays size={23} strokeWidth={2.2} /></span><span>daily<span className="brand-period">.</span></span></div><p className="sidebar-kicker">KHÔNG GIAN CỦA BẠN</p></div>
      <div className="sidebar-section"><span className="section-label">TỔNG QUAN</span><div className="sidebar-nav active"><CalendarDays size={18} /> Lịch của tôi <span className="nav-count">{openCount}</span></div><Link href="/notes" className="sidebar-nav"><FileText size={18} /> Ghi chú</Link></div>
      <div className="sidebar-section"><span className="section-label">LỌC CÔNG VIỆC</span><div className="filter-list">{filters.map((item) => <button key={item.key} type="button" aria-pressed={filter === item.key} onClick={() => selectFilter(item.key)} className={`filter-button ${filter === item.key ? 'selected' : ''}`}><span className={`filter-indicator ${item.key}`} />{item.label}{item.key === 'dueSoon' && dueSoonCount > 0 && <span className="filter-count">{dueSoonCount}</span>}</button>)}</div></div>
      {tags.length > 0 && <div className="sidebar-section"><span className="section-label">DANH MỤC</span><div className="filter-list"><button type="button" className={`filter-button ${tag === null ? 'selected' : ''}`} onClick={() => setTag(null)}>Tất cả danh mục</button>{tags.map((value) => <button key={value} type="button" className={`filter-button ${tag === value ? 'selected' : ''}`} onClick={() => setTag(value)}><span className="tag-dot" />{value}</button>)}</div></div>}
      <div className="sidebar-bottom"><div className="progress-card"><div className="progress-head"><span>TIẾN ĐỘ CỦA BẠN</span><span>{tasks.length ? Math.round(doneCount / tasks.length * 100) : 0}%</span></div><div className="progress-track"><span style={{ width: `${tasks.length ? doneCount / tasks.length * 100 : 0}%` }} /></div><p>{doneCount}/{tasks.length} công việc đã hoàn thành</p></div><div className="account-area">{account.kind === 'signedIn' ? <><div className="avatar">{account.user.email?.[0]?.toUpperCase() ?? 'U'}</div><div className="account-text"><strong>Tài khoản của bạn</strong><span>{account.user.email}</span></div><button type="button" aria-label="Đăng xuất" title="Đăng xuất" onClick={() => void signOut()}><LogOut size={18} /></button></> : <><div className="avatar guest">G</div><div className="account-text"><strong>Chế độ khách</strong><span>Lưu trên thiết bị này</span></div><Link href="/login" title="Đăng nhập" aria-label="Đăng nhập"><LogIn size={18} /></Link></>}</div></div>
    </aside>

    <main className="workspace">
      <header className="topbar"><div className="topbar-left"><span className="breadcrumb">Không gian của tôi</span><ChevronRight size={15} /><strong>Lịch</strong></div><div className="topbar-right"><Link className="settings-link icon-button" href="/account" aria-label="Cài đặt và dữ liệu" title="Cài đặt và dữ liệu"><Settings size={18} /></Link><Link className="mobile-notes-link" href="/notes"><FileText size={17} /> Ghi chú</Link>{user && <button className="mobile-logout icon-button" type="button" aria-label="Đăng xuất" onClick={() => void signOut()}><LogOut size={18} /></button>}<span className="current-date">{format(new Date(), "EEEE, dd 'tháng' MM", { locale: vi })}</span><span className="topbar-divider" /><span className="topbar-avatar">{account.kind === 'signedIn' ? account.user.email?.[0]?.toUpperCase() : 'G'}</span></div></header>
      <div className="content">
        <div className="page-heading"><div><p className="eyebrow">KẾ HOẠCH CỦA BẠN</p><h1>Thời gian của bạn<span className="heading-dot">.</span></h1><p className="page-subtitle">Một nơi để mọi việc trở nên rõ ràng hơn.</p></div><button type="button" className="primary-button create-main" onClick={() => setModal({ kind: 'create', date: selectedDate })}><Plus size={19} /> Tạo công việc</button></div>
        {account.kind === 'guest' && <div className="guest-banner"><CircleHelp size={18} /><span>Bạn đang dùng chế độ khách. Công việc được lưu trên trình duyệt này.</span><Link href="/login">Đăng nhập để đồng bộ <ChevronRight size={15} /></Link></div>}
        {guestCount > 0 && account.kind === 'signedIn' && <div className="guest-banner"><CircleHelp size={18} /><span>Bạn có {guestCount} công việc đã lưu trên thiết bị này.</span><button type="button" onClick={() => void importGuestTasks()}>Nhập vào tài khoản <ChevronRight size={15} /></button></div>}
        {error && <div className="error-banner" role="alert"><span>{error}</span><button type="button" onClick={() => { setError(null); void reload() }}><RotateCcw size={16} /> Thử lại</button></div>}
        <div className="stats-row"><div className="stat"><span className="stat-icon open"><Clock3 size={18} /></span><div><strong>{openCount}</strong><span>Việc đang chờ</span></div></div><div className="stat"><span className="stat-icon done"><Check size={18} /></span><div><strong>{doneCount}</strong><span>Đã hoàn thành</span></div></div><div className="stat"><span className="stat-icon late"><Clock3 size={18} /></span><div><strong>{dueSoonCount}</strong><span>Gần đến hạn</span></div></div></div>
        {filter !== 'all' && dayPanel}
        <section className="calendar-card" aria-label="Lịch công việc"><div className="calendar-toolbar"><div className="calendar-title"><h2>{view === 'month' ? format(anchor, "'Tháng' M, yyyy", { locale: vi }) : `${format(days[0], 'dd/MM')} – ${format(days[6], 'dd/MM/yyyy')}`}</h2><div className="nav-arrows"><button type="button" aria-label="Kỳ trước" onClick={() => move(-1)}><ChevronLeft size={19} /></button><button type="button" aria-label="Kỳ sau" onClick={() => move(1)}><ChevronRight size={19} /></button></div><button type="button" className="today-button" onClick={() => selectDay(new Date())}>Hôm nay</button></div><div className="toolbar-right"><label className="sort-control"><ArrowDownUp size={15} /><select aria-label="Sắp xếp công việc" value={sort} onChange={(event) => setSort(event.target.value === 'priority' ? 'priority' : 'date')}><option value="date">Theo hạn</option><option value="priority">Ưu tiên</option></select></label><div className="view-toggle"><button type="button" className={view === 'month' ? 'active' : ''} onClick={() => setView('month')}>Tháng</button><button type="button" className={view === 'week' ? 'active' : ''} onClick={() => setView('week')}>Tuần</button></div></div></div>
          <div className="mobile-filters"><ListFilter size={17} /><select aria-label="Lọc công việc" value={filter} onChange={(event) => selectFilter(filters.find(({ key }) => key === event.target.value)?.key ?? 'all')}>{filters.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}</select>{tags.length > 0 && <select aria-label="Lọc danh mục" value={tag ?? ''} onChange={(event) => setTag(event.target.value || null)}><option value="">Mọi danh mục</option>{tags.map((value) => <option key={value} value={value}>{value}</option>)}</select>}</div>
          <div className={`calendar-grid ${view}`}><div className="weekday-row">{weekdays.map((day) => <span key={day}>{day}</span>)}</div><div className="day-grid">{days.map((day) => { const key = dateKey(day); const dayTasks = byDate.get(key) ?? []; return <div key={key} className={`day-cell ${key === today ? 'today' : ''} ${key === selectedDate ? 'selected' : ''} ${!isSameMonth(day, anchor) && view === 'month' ? 'outside' : ''}`} onClick={() => selectDay(day)} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); const task = tasks.find((item) => item.id === event.dataTransfer.getData('text/plain')); if (task && task.due_date !== key) void save({ title: task.title, description: task.description, due_date: key, due_time: task.due_time, status: task.status, priority: task.priority, tag: task.tag }, task) }}><div className="day-head"><button type="button" className="day-number" aria-label={`Xem công việc ngày ${format(day, 'dd/MM/yyyy')}`} onClick={(event) => { event.stopPropagation(); selectDay(day) }}>{format(day, 'd')}{key === today && <span className="today-label">Hôm nay</span>}</button><button type="button" className="day-add" aria-label={`Tạo công việc ngày ${format(day, 'dd/MM/yyyy')}`} onClick={(event) => { event.stopPropagation(); setModal({ kind: 'create', date: key }) }}><Plus size={15} /></button></div><div className="day-tasks">{dayTasks.slice(0, view === 'week' ? 5 : 3).map(taskChip)}{dayTasks.length > (view === 'week' ? 5 : 3) && <button type="button" className="more-tasks" onClick={(event) => { event.stopPropagation(); selectDay(day) }}>+{dayTasks.length - (view === 'week' ? 5 : 3)} việc khác</button>}</div></div> })}</div></div>
        </section>
        {filter === 'all' && dayPanel}
      </div>
    </main>
    <button type="button" className="mobile-add" aria-label="Tạo công việc" onClick={() => setModal({ kind: 'create', date: selectedDate })}><Plus size={25} /></button>
    {menu && <div className="context-menu" style={{ left: menu.x, top: menu.y }} onClick={(event) => event.stopPropagation()}><button type="button" onClick={() => { setModal({ kind: 'edit', task: menu.task }); setMenu(null) }}>Sửa công việc</button><button type="button" onClick={() => void quickComplete(menu.task)}>{menu.task.status === 'done' ? 'Đánh dấu chưa xong' : 'Đánh dấu hoàn thành'}</button><button type="button" className="danger" onClick={() => { if (window.confirm('Xoá công việc này?')) void remove(menu.task); setMenu(null) }}>Xoá công việc</button></div>}
    {modal.kind !== 'closed' && <TaskModal key={modal.kind === 'edit' ? modal.task.id : modal.date} modal={modal} onClose={() => setModal({ kind: 'closed' })} onSave={save} onDelete={remove} />}
  </div>
}

function TaskModal({ modal, onClose, onSave, onDelete }: { modal: Exclude<Modal, { kind: 'closed' }>; onClose: () => void; onSave: (input: TaskInput, previous?: Task) => Promise<boolean>; onDelete: (task: Task) => Promise<boolean> }) {
  const previous = modal.kind === 'edit' ? modal.task : undefined
  const [title, setTitle] = useState(previous?.title ?? '')
  const [description, setDescription] = useState(previous?.description ?? '')
  const [date, setDate] = useState(previous?.due_date ?? (modal.kind === 'create' ? modal.date : todayKey()))
  const [warningDays, setWarningDays] = useState(String(previous?.warning_days ?? defaultWarningDays))
  const [time, setTime] = useState(previous?.due_time?.slice(0, 5) ?? '')
  const [priority, setPriority] = useState<Task['priority']>(previous?.priority ?? 'medium')
  const [status, setStatus] = useState<Task['status']>(previous?.status ?? 'todo')
  const [tag, setTag] = useState(previous?.tag ?? '')
  const [busy, setBusy] = useState(false)
  const [saveError, setSaveError] = useState('')
  const dialogRef = useRef<HTMLDialogElement>(null)
  const titleRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    const dialog = dialogRef.current
    dialog?.showModal()
    titleRef.current?.focus()
    return () => dialog?.close()
  }, [])

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!title.trim()) return
    const warning = warningDaysSchema.safeParse(warningDays.trim() ? Number(warningDays) : NaN)
    if (!warning.success) {
      setSaveError('Nhập số ngày báo trước từ 0 đến 365.')
      return
    }
    setBusy(true)
    setSaveError('')
    const ok = await onSave({ title: title.trim(), description: description.trim() || null, due_date: date, due_time: time || null, warning_days: warning.data, priority, status, tag: tag.trim() || null }, previous)
    setBusy(false)
    if (ok) onClose()
    else setSaveError('Không lưu được. Nội dung bạn nhập vẫn ở đây. Hãy thử lại.')
  }

  async function deleteTask() {
    if (!previous || !window.confirm('Xoá công việc này?')) return
    setBusy(true)
    const ok = await onDelete(previous)
    setBusy(false)
    if (ok) onClose()
    else setSaveError('Không xoá được. Hãy thử lại.')
  }

  return <dialog ref={dialogRef} className="task-modal task-dialog" aria-labelledby="modal-title"
    onCancel={(event) => { event.preventDefault(); if (!busy) onClose() }}
    onMouseDown={(event) => { if (!busy && event.target === event.currentTarget) onClose() }}><div className="modal-head"><div><p className="eyebrow">{previous ? 'CHỈNH SỬA CÔNG VIỆC' : 'CÔNG VIỆC MỚI'}</p><h2 id="modal-title">{previous ? 'Chi tiết công việc' : 'Thêm vào lịch'}</h2></div><button type="button" className="icon-button" aria-label="Đóng" onClick={onClose}><X size={21} /></button></div><form onSubmit={submit} className="task-form"><label className="field">Tên công việc<input ref={titleRef} value={title} onChange={(event) => setTitle(event.target.value)} maxLength={180} placeholder="Bạn muốn làm gì?" required /></label><label className="field">Mô tả <span>(không bắt buộc)</span><textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={2000} placeholder="Thêm ghi chú cho công việc..." rows={3} /></label><div className="form-grid"><label className="field">Ngày đến hạn<input type="date" value={date} onChange={(event) => setDate(event.target.value)} required /></label><label className="field">Giờ <span>(tuỳ chọn)</span><input type="time" value={time} onChange={(event) => setTime(event.target.value)} /></label></div><label className="field">Báo trước (ngày)<input type="number" min={0} max={365} step={1} required value={warningDays} onChange={(event) => setWarningDays(event.target.value)} /><span>0 ngày: chỉ hiện vào ngày đến hạn.</span></label><div className="form-grid"><label className="field">Ưu tiên<select value={priority} onChange={(event) => setPriority(event.target.value as Task['priority'])}><option value="low">Thấp</option><option value="medium">Vừa</option><option value="high">Cao</option></select></label><label className="field">Trạng thái<select value={status} onChange={(event) => setStatus(event.target.value as Task['status'])}><option value="todo">Chưa làm</option><option value="in_progress">Đang làm</option><option value="done">Hoàn thành</option></select></label></div><label className="field">Danh mục <span>(tuỳ chọn)</span><input value={tag} onChange={(event) => setTag(event.target.value)} maxLength={40} placeholder="Ví dụ: Công việc, Cá nhân" /></label>{saveError && <p className="notes-error" role="alert">{saveError}</p>}<div className="modal-actions">{previous && <button type="button" className="delete-button" onClick={() => void deleteTask()} disabled={busy}>Xoá việc</button>}<button type="button" className="cancel-button" onClick={onClose}>Huỷ</button><button type="submit" className="primary-button" disabled={busy}>{busy ? <LoaderCircle className="spin" size={17} /> : <Check size={17} />}{previous ? 'Lưu thay đổi' : 'Tạo công việc'}</button></div></form></dialog>
}
