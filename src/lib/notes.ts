import { z } from 'zod'
import { getSupabase } from '@/lib/supabase'
import { readAllPages } from '@/lib/paginate'

const folderSchema = z.object({ id: z.uuid(), name: z.string().trim().min(1).max(100) })
const noteSchema = z.object({
  id: z.uuid(),
  folder_id: z.uuid(),
  title: z.string().trim().min(1).max(180),
  body: z.string().max(50000),
  updated_at: z.iso.datetime({ offset: true }),
})
const notebookSchema = z.object({ folders: z.array(folderSchema), notes: z.array(noteSchema) })
export type Notebook = z.infer<typeof notebookSchema>
export type Folder = z.infer<typeof folderSchema>
export type Note = z.infer<typeof noteSchema>
export const emptyNotebook: Notebook = { folders: [], notes: [] }
const storageKey = 'daily-planner-notes-v1'

export function readLocalNotebook(): Notebook {
  const raw = localStorage.getItem(storageKey)
  return raw ? notebookSchema.parse(JSON.parse(raw)) : emptyNotebook
}

function client() {
  const supabase = getSupabase()
  if (!supabase) throw new Error('Supabase is unavailable')
  return supabase
}

export async function loadNotebook(userId?: string): Promise<Notebook> {
  if (!userId) return readLocalNotebook()
  const supabase = client()
  const [folders, notes] = await Promise.all([
    readAllPages((from, to) => supabase.from('note_folders').select('id,name').eq('user_id', userId).order('id').range(from, to)),
    readAllPages((from, to) => supabase.from('notes').select('id,folder_id,title,body,updated_at').eq('user_id', userId).order('id').range(from, to)),
  ])
  return notebookSchema.parse({ folders, notes })
}

function replaceById<T extends { id: string }>(items: T[], entry: T) {
  return [...items.filter(({ id }) => id !== entry.id), entry]
}

type NotebookChange =
  | { kind: 'folder'; folder: Folder }
  | { kind: 'save'; note: Note; previousVersion?: string }
  | { kind: 'deleteFolder'; id: string }
  | { kind: 'delete'; id: string }

export class NoteConflict extends Error {}

export async function importGuestNotebook(userId: string) {
  const guest = readLocalNotebook()
  const supabase = client()
  if (guest.folders.length) {
    const { error } = await supabase.from('note_folders')
      .upsert(guest.folders.map((folder) => ({ ...folder, user_id: userId })), { ignoreDuplicates: true })
    if (error) throw error
  }
  if (guest.notes.length) {
    const { error } = await supabase.from('notes')
      .upsert(guest.notes.map((note) => ({ ...note, user_id: userId })), { ignoreDuplicates: true })
    if (error) throw error
  }
  const cloud = await loadNotebook(userId)
  const cloudFolders = new Set(cloud.folders.map(({ id }) => id))
  const cloudNotes = new Set(cloud.notes.map(({ id }) => id))
  if (!guest.folders.every(({ id }) => cloudFolders.has(id)) || !guest.notes.every(({ id }) => cloudNotes.has(id))) {
    throw new Error('Import incomplete')
  }
  // Keep the guest copy available. Retrying the import skips existing rows.
  return cloud
}

export async function updateNotebook(snapshot: Notebook, change: NotebookChange, userId?: string) {
  const current = userId ? snapshot : readLocalNotebook()
  const next = { ...current }
  if (change.kind === 'folder') {
    const folder = folderSchema.parse(change.folder)
    if (userId) {
      const { error } = await client().from('note_folders').upsert({ ...folder, user_id: userId })
        .select('id').single()
      if (error) throw error
    }
    next.folders = replaceById(current.folders, folder)
  } else if (change.kind === 'save') {
    const note = noteSchema.parse(change.note)
    if (userId) {
      const notes = client().from('notes')
      if (change.previousVersion) {
        const { data, error } = await notes.update(note).eq('id', note.id).eq('user_id', userId)
          .eq('updated_at', change.previousVersion).select('id').maybeSingle()
        if (error) throw error
        if (!data) throw new NoteConflict()
      } else {
        const { error } = await notes.insert({ ...note, user_id: userId })
        if (error) {
          if (error.code === '23505') throw new NoteConflict()
          throw error
        }
      }
    } else if (current.notes.find(({ id }) => id === note.id)?.updated_at !== change.previousVersion) {
      throw new NoteConflict()
    }
    next.notes = replaceById(current.notes, note)
  } else if (change.kind === 'deleteFolder') {
    if (userId) {
      const { error } = await client().from('note_folders').delete().eq('user_id', userId)
        .eq('id', change.id).select('id').single()
      if (error) throw error
    }
    next.folders = current.folders.filter(({ id }) => id !== change.id)
    next.notes = current.notes.filter(({ folder_id }) => folder_id !== change.id)
  } else {
    if (userId) {
      const { error } = await client().from('notes').delete().eq('user_id', userId)
        .eq('id', change.id).select('id').single()
      if (error) throw error
    }
    next.notes = current.notes.filter(({ id }) => id !== change.id)
  }
  if (!userId) localStorage.setItem(storageKey, JSON.stringify(next))
  return next
}
