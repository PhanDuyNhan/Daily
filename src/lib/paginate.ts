type Page = { data: unknown[] | null; error: unknown }

export async function readAllPages(load: (from: number, to: number) => PromiseLike<Page>) {
  const rows: unknown[] = []
  const size = 500
  for (let from = 0; ; from += size) {
    const { data, error } = await load(from, from + size - 1)
    if (error || !data) throw error ?? new Error('Missing data')
    rows.push(...data)
    if (data.length < size) return rows
  }
}
