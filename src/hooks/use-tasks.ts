'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { z } from 'zod'
import { getSupabase } from '@/lib/supabase'
import { defaultWarningDays, taskSchema, type Task, type TaskInput } from '@/lib/task'
import { readAllPages } from '@/lib/paginate'

const STORAGE_KEY = 'daily-planner-tasks-v1'
function readGuestTasks(): Task[] {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
    return z.array(taskSchema).parse(raw)
  } catch {
    return []
  }
}

export function useTasks(user: User | null) {
  const userId = user?.id
  const account = user ? { kind: 'signedIn', user } as const : { kind: 'guest' } as const
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [guestCount, setGuestCount] = useState(0)
  const active = useRef(false)
  const operation = useRef<'load' | 'write' | null>(null)

  const load = useCallback(async () => {
    if (!active.current || operation.current) return
    operation.current = 'load'
    setLoading(true)
    setError(null)
    if (!userId) {
      setTasks(readGuestTasks())
      operation.current = null
      setLoading(false)
      return
    }
    const supabase = getSupabase()
    setGuestCount(readGuestTasks().length)
    try {
      if (!supabase) throw new Error()
      const data = await readAllPages((from, to) => supabase.from('tasks').select('*')
        .eq('user_id', userId).order('id').range(from, to))
      const rows = z.array(taskSchema).parse(data)
      if (active.current) setTasks(rows)
    } catch {
      if (active.current) setError('Không tải được công việc. Kiểm tra kết nối rồi thử lại.')
    } finally {
      operation.current = null
      if (active.current) setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    active.current = true
    let cancelled = false
    queueMicrotask(() => { if (!cancelled) void load() })
    return () => {
      cancelled = true
      active.current = false
    }
  }, [load])

  async function write(action: () => Promise<void>, message: string, rollback?: () => void) {
    if (loading || operation.current) {
      setError('Đang xử lý công việc. Vui lòng thử lại sau.')
      return false
    }
    operation.current = 'write'
    setError(null)
    try {
      await action()
      return active.current
    } catch {
      if (active.current) {
        rollback?.()
        setError(message)
      }
      return false
    } finally {
      operation.current = null
    }
  }

  async function save(input: TaskInput, previous?: Task) {
    const now = new Date().toISOString()
    const { warning_days = previous?.warning_days ?? defaultWarningDays, ...fields } = input
    const task: Task = previous
      ? { ...previous, ...fields, warning_days, updated_at: now }
      : { ...fields, warning_days, id: crypto.randomUUID(), user_id: userId ?? null, created_at: now, updated_at: now }
    const apply = (current: Task[]) => previous
      ? current.map((item) => item.id === previous.id ? task : item)
      : [...current, task]
    return write(async () => {
      if (!userId) {
        const next = apply(readGuestTasks())
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
        setTasks(next)
        return
      }
      const supabase = getSupabase()
      if (!supabase) throw new Error()
      setTasks(apply)
      const payload = warning_days === (previous?.warning_days ?? defaultWarningDays)
        ? fields
        : { ...fields, warning_days }
      const result = previous
        ? await supabase.from('tasks').update(payload).eq('id', previous.id).eq('user_id', userId).select().single()
        : await supabase.from('tasks').insert({ ...payload, id: task.id, user_id: userId }).select().single()
      if (result.error) throw result.error
      const saved = taskSchema.parse(result.data)
      if (active.current) setTasks((current) => current.map((item) => item.id === task.id ? saved : item))
    }, 'Không lưu được công việc. Kiểm tra kết nối rồi thử lại.', () => {
      setTasks((current) => previous ? current.map((item) => item.id === previous.id ? previous : item) : current.filter((item) => item.id !== task.id))
    })
  }

  async function remove(task: Task) {
    const withoutTask = (current: Task[]) => current.filter((item) => item.id !== task.id)
    return write(async () => {
      if (!userId) {
        const next = withoutTask(readGuestTasks())
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
        setTasks(next)
        return
      }
      const result = await getSupabase()?.from('tasks').delete().eq('id', task.id).eq('user_id', userId).select('id').single()
      if (!result || result.error) throw new Error()
      if (active.current) setTasks(withoutTask)
    }, 'Không xoá được công việc. Hãy thử lại.')
  }

  async function importGuestTasks() {
    if (!userId) return false
    return write(async () => {
      const guestTasks = readGuestTasks()
      if (!guestTasks.length) return
      const customWarnings = guestTasks.some((task) => task.warning_days !== defaultWarningDays)
      const records = guestTasks.map(({ warning_days, ...task }) => ({
        ...task, user_id: userId, ...(customWarnings ? { warning_days } : {}),
      }))
      const supabase = getSupabase()
      if (!supabase) throw new Error()
      const { error } = await supabase.from('tasks').upsert(records, { onConflict: 'id', ignoreDuplicates: true })
      if (error) throw error
      const rows = await readAllPages((from, to) => supabase.from('tasks').select('*')
        .eq('user_id', userId).order('id').range(from, to))
      const imported = z.array(taskSchema).parse(rows)
      const ids = new Set(imported.map((task) => task.id))
      if (!guestTasks.every((task) => ids.has(task.id))) throw new Error()
      if (!active.current) return
      const versions = new Map(guestTasks.map((task) => [task.id, task.updated_at]))
      const remaining = readGuestTasks().filter((task) => versions.get(task.id) !== task.updated_at)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(remaining))
      setTasks(imported)
      setGuestCount(remaining.length)
    }, 'Không nhập được công việc khách. Dữ liệu khách được giữ lại để thử lại.')
  }

  return { tasks, account, loading, error, setError, save, remove, guestCount, importGuestTasks, reload: load }
}
