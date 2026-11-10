const REF = /\b[A-Z]{2,6}-\d+\b/g

export type RefPart = { type: 'text'; value: string } | { type: 'ref'; value: string }

export function parseTaskRefs(text: string): string[] {
  return text.match(REF) ?? []
}

export function splitTaskRefs(text: string): RefPart[] {
  const parts: RefPart[] = []
  let last = 0
  for (const m of text.matchAll(REF)) {
    const i = m.index ?? 0
    if (i > last) parts.push({ type: 'text', value: text.slice(last, i) })
    parts.push({ type: 'ref', value: m[0] })
    last = i + m[0].length
  }
  if (last < text.length) parts.push({ type: 'text', value: text.slice(last) })
  return parts
}
