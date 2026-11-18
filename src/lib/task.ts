import { z } from 'zod'
import { addDays, differenceInCalendarDays, endOfWeek, format, isWithinInterval, parseISO, startOfWeek } from 'date-fns'

export const defaultWarningDays = 1
export const warningDaysSchema = z.number().int().min(0).max(365)

export const taskSchema = z.object({
  id: z.uuid(),
  user_id: z.uuid().nullable(),
  title: z.string().trim().min(1).max(180),
  description: z.string().max(2000).nullable(),
  due_date: z.iso.date(),
  due_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d+)?)?$/).nullable(),
  warning_days: warningDaysSchema.default(defaultWarningDays),
  status: z.enum(['todo', 'in_progress', 'done']),
  priority: z.enum(['low', 'medium', 'high']),
  tag: z.string().trim().max(40).nullable(),
  created_at: z.iso.datetime({ offset: true }),
  updated_at: z.iso.datetime({ offset: true }),
})

export type Task = z.infer<typeof taskSchema>
export type TaskInput = Pick<Task, 'title' | 'description' | 'due_date' | 'due_time' | 'status' | 'priority' | 'tag'> &
  Partial<Pick<Task, 'warning_days'>>
export type TaskFilter = 'all' | 'today' | 'week' | 'dueSoon' | 'done'
export type TaskSort = 'date' | 'priority'

export const dateKey = (date: Date) => format(date, 'yyyy-MM-dd')
export const todayKey = () => dateKey(new Date())
export const priorityRank: Record<Task['priority'], number> = { high: 0, medium: 1, low: 2 }

export function isOverdue(task: Task, today = todayKey()) {
  return task.status !== 'done' && task.due_date < today
}

export function isDueSoon(task: Task, now = new Date()) {
  if (task.status === 'done') return false
  const days = differenceInCalendarDays(parseISO(task.due_date), now)
  return days >= 0 && days <= task.warning_days
}

export function visibleTasks(tasks: Task[], filter: TaskFilter, sort: TaskSort, tag: string | null, now = new Date()) {
  const today = dateKey(now)
  const weekStart = startOfWeek(now, { weekStartsOn: 1 })
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 })
  return tasks.filter((task) => {
    if (tag && task.tag !== tag) return false
    switch (filter) {
      case 'today': return task.due_date === today
      case 'week': return isWithinInterval(parseISO(task.due_date), { start: weekStart, end: weekEnd })
      case 'dueSoon': return isDueSoon(task, now)
      case 'done': return task.status === 'done'
      case 'all': return true
      default: { const exhaustive: never = filter; return exhaustive }
    }
  }).sort((a, b) => sort === 'priority'
    ? priorityRank[a.priority] - priorityRank[b.priority] || a.due_date.localeCompare(b.due_date)
    : a.due_date.localeCompare(b.due_date) || (a.due_time ?? '').localeCompare(b.due_time ?? '') || priorityRank[a.priority] - priorityRank[b.priority])
}

export function calendarDays(anchor: Date, mode: 'month' | 'week') {
  const start = startOfWeek(mode === 'month' ? new Date(anchor.getFullYear(), anchor.getMonth(), 1) : anchor, { weekStartsOn: 1 })
  if (mode === 'week') return Array.from({ length: 7 }, (_, index) => addDays(start, index))
  const last = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0)
  const count = Math.ceil((differenceInCalendarDays(last, start) + 1) / 7) * 7
  return Array.from({ length: count }, (_, index) => addDays(start, index))
}
