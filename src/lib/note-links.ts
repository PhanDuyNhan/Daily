export function noteLinks(body: string): string[] {
  const links = new Set<string>()
  for (const match of body.matchAll(/\b(?:https?:\/\/|www\.)[^\s<>"'\x60]+/gi)) {
    let text = match[0].replace(/[.,!?;:]+$/, '')
    for (const [open, close] of [['(', ')'], ['[', ']'], ['{', '}']]) {
      let excess = text.split(close).length - text.split(open).length
      while (excess > 0 && text.endsWith(close)) {
        text = text.slice(0, -1)
        excess -= 1
      }
    }
    try {
      const url = new URL(/^www\./i.test(text) ? `https://${text}` : text)
      if (url.protocol === 'https:' || url.protocol === 'http:') links.add(url.href)
    } catch {
      continue
    }
  }
  return [...links]
}
