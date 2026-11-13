import type { Custom } from '../types'
import { EMOJI, type Emoji } from './emoji'

export type { Custom }

export const EMPTY: Custom = { added: [], removed: [] }

// Must survive the typeahead and auto-replace patterns.
export const NAME = /^[a-z0-9_+-]+$/

// Built-ins minus removals and overrides, then additions.
export function effective(custom: Custom): Emoji[] {
  const hidden = new Set([...custom.removed, ...custom.added.map(e => e.name)])
  return [...EMOJI.filter(e => !hidden.has(e.name)), ...custom.added]
}

export function add(custom: Custom, more: readonly Emoji[]): Custom {
  const names = new Set(more.map(e => e.name))
  return {
    added: [...custom.added.filter(e => !names.has(e.name)), ...more],
    removed: custom.removed.filter(n => !names.has(n)),
  }
}

export function remove(custom: Custom, names: readonly string[]): Custom {
  const drop = new Set(names)
  const builtin = new Set(EMOJI.map(e => e.name))
  return {
    added: custom.added.filter(e => !drop.has(e.name)),
    removed: [...new Set([...custom.removed, ...names.filter(n => builtin.has(n))])],
  }
}

function entry(name: string, value: unknown): Emoji | string {
  const n = name.replace(/^:|:$/g, '').toLowerCase()
  if (!NAME.test(n)) return `bad name "${name}" (letters, digits, _ + - only)`
  if (typeof value === 'string' && value.trim()) return { name: n, char: value.trim() }
  if (value && typeof value === 'object') {
    const v = value as { char?: unknown; emoji?: unknown; aliases?: unknown }
    const char = typeof v.char === 'string' ? v.char : typeof v.emoji === 'string' ? v.emoji : ''
    if (!char.trim()) return `"${name}" has no emoji`
    const aliases = Array.isArray(v.aliases)
      ? v.aliases.filter((a): a is string => typeof a === 'string' && NAME.test(a))
      : []
    return aliases.length ? { name: n, char: char.trim(), aliases } : { name: n, char: char.trim() }
  }
  return `"${name}" has no emoji`
}

export type Parsed = { add: Emoji[]; remove: string[]; errors: string[] }

// Accepts the export format { add: {name: emoji}, remove: [names] }, a flat
// { name: emoji } map, an array of { name, char|emoji, aliases }, or text
// lines of "name emoji" (a leading "-name" removes; # starts a comment).
export function parse(source: string): Parsed {
  const out: Parsed = { add: [], remove: [], errors: [] }
  const push = (r: Emoji | string) => (typeof r === 'string' ? out.errors.push(r) : out.add.push(r))

  let json: unknown
  try {
    json = JSON.parse(source)
  } catch {
    json = undefined
  }

  if (json === undefined) {
    for (const [i, raw] of source.split('\n').entries()) {
      const line = raw.replace(/#.*$/, '').trim()
      if (!line) continue
      if (line.startsWith('-')) {
        out.remove.push(line.slice(1).trim().replace(/^:|:$/g, '').toLowerCase())
        continue
      }
      const m = /^(\S+)\s+(.+)$/.exec(line)
      if (m?.[1] && m[2]) push(entry(m[1], m[2]))
      else out.errors.push(`line ${i + 1}: expected "name emoji"`)
    }
    return out
  }

  if (Array.isArray(json)) {
    for (const item of json) {
      const name = (item as { name?: unknown })?.name
      if (typeof name === 'string') push(entry(name, item))
      else out.errors.push('an entry has no name')
    }
    return out
  }

  if (json && typeof json === 'object') {
    const o = json as Record<string, unknown>
    const isExport = 'add' in o || 'remove' in o
    const adds = isExport ? o.add : o
    if (adds && typeof adds === 'object' && !Array.isArray(adds)) {
      for (const [name, value] of Object.entries(adds)) push(entry(name, value))
    }
    if (isExport && Array.isArray(o.remove)) {
      out.remove.push(...o.remove.filter((n): n is string => typeof n === 'string'))
    }
    return out
  }

  out.errors.push('expected a JSON object or array, or "name emoji" lines')
  return out
}

export function exported(custom: Custom): string {
  const add: Record<string, string | { char: string; aliases: readonly string[] }> = {}
  for (const e of custom.added) add[e.name] = e.aliases?.length ? { char: e.char, aliases: e.aliases } : e.char
  return JSON.stringify({ add, remove: custom.removed }, null, 2) + '\n'
}

// Terminal cells a string takes: 2 per pictograph, 1 per flag letter (a flag
// is a pair), 0 for joiners and variation selectors. Close enough for a grid.
export function cells(s: string): number {
  let n = 0
  for (const ch of s) {
    if (/[‍︎️̀-ͯ]/u.test(ch)) continue
    n += /\p{Extended_Pictographic}/u.test(ch) ? 2 : 1
  }
  return Math.max(n, 1)
}
