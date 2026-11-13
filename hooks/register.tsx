import { atom, read, update } from 'claude-code'
import type { EngineInterface, PromptAutocompleteSuggestion, Register } from 'claude-code'

import type { Frequent } from '../types'
import { add, cells, EMPTY, effective, exported, NAME, parse, remove, type Custom } from './custom'
import { BUILTIN } from './aliases'
import type { Emoji } from './emoji'

const PANE = 'emoji-picker'
const MAX_ROWS = 8
const FREQUENT_SHOWN = 32
// a one-letter search matches most of the set
const MAX_MATCHES = 200
// Slack waits for two characters after the colon before suggesting.
const QUERY = /^:([a-z0-9_+-]{2,})$/i
const CLOSED = /(^|\s):([a-z0-9_+-]+):$/i

const query = atom({ plugin: 'emoji', key: 'query' } as const, '')
const frequent = atom({ plugin: 'emoji', key: 'frequent' } as const, {})
const custom = atom({ plugin: 'emoji', key: 'custom' } as const, EMPTY)
const tab = atom({ plugin: 'emoji', key: 'tab' } as const, '')

// Slack's category bar, in its order; Frequent and Custom only when non-empty.
const FREQUENT_TAB = 'Frequently used'
const CUSTOM_TAB = 'Custom'
const TABS: readonly (readonly [string, string])[] = [
  [FREQUENT_TAB, '🕘'],
  [CUSTOM_TAB, '⭐'],
  ['Smileys & Emotion', '😀'],
  ['People & Body', '👋'],
  ['Animals & Nature', '🐻'],
  ['Food & Drink', '🍔'],
  ['Activities', '⚽'],
  ['Travel & Places', '✈️'],
  ['Objects', '💡'],
  ['Symbols', '🔣'],
  ['Flags', '🏁'],
]

// Per-keystroke hooks read these instead of $.state; kept in step with it.
let active: Emoji[] = [...BUILTIN]
let byName = new Map<string, Emoji>()
let counts: Frequent = {}

function index(c: Custom) {
  active = effective(c)
  byName = new Map(active.flatMap(e => [e.name, ...(e.aliases ?? [])].map(n => [n, e] as const)))
}
index(EMPTY)

function rank(e: Emoji, q: string): number {
  const names = [e.name, ...(e.aliases ?? [])]
  if (names.some(n => n === q)) return 0
  if (e.name.startsWith(q)) return 1
  if (names.some(n => n.startsWith(q))) return 2
  // word-start match, so :check finds white_check_mark
  if (names.some(n => n.split(/[_-]/).some(w => w.startsWith(q)))) return 3
  if (names.some(n => n.includes(q))) return 4
  return -1
}

// Within a match tier, what you use most comes first, then shorter names.
export function search(list: readonly Emoji[], q: string, limit = Infinity, used: Frequent = counts): Emoji[] {
  const uses = (e: Emoji) => used[e.name] ?? 0
  return list
    .map(e => ({ e, r: rank(e, q) }))
    .filter(x => x.r >= 0)
    .sort((a, b) => a.r - b.r || uses(b.e) - uses(a.e) || a.e.name.length - b.e.name.length)
    .slice(0, limit)
    .map(({ e }) => e)
}

function suggest(q: string): PromptAutocompleteSuggestion[] {
  return search(active, q, MAX_ROWS).map(e => ({ text: e.char, label: `${e.char}  :${e.name}:` }))
}

// Rows that fit `width` terminal cells, one cell of gap between.
function layout(list: readonly Emoji[], width: number): Emoji[][] {
  const rows: Emoji[][] = []
  let row: Emoji[] = []
  let used = 0
  for (const e of list) {
    const w = cells(e.char) + (row.length ? 1 : 0)
    if (row.length && used + w > width) {
      rows.push(row)
      row = []
      used = 0
    }
    row.push(e)
    used += row.length === 1 ? cells(e.char) : w
  }
  if (row.length) rows.push(row)
  return rows
}

async function home($: EngineInterface): Promise<string> {
  return String((await $.env.get('HOME')) ?? '')
}

async function save($: EngineInterface, next: Custom) {
  index(next)
  await update($, custom, () => next)
  await $.store.set('custom', next)
}

// Picker picks and auto-replacements both count; typeahead takes can't be seen.
async function bump($: EngineInterface, name: string) {
  counts = { ...counts, [name]: (counts[name] ?? 0) + 1 }
  const next = counts
  await update($, frequent, () => next)
  await $.store.set('frequent', next)
}

const HELP = [
  '/emoji [search]            open the picker',
  '/emoji add <name> <emoji>  add one, or override a built-in (any text works)',
  '/emoji remove <name...>    hide a built-in or delete one you added',
  '/emoji import <file>       JSON or "name emoji" lines; "-name" removes',
  '/emoji export <file>       write your changes as JSON (importable)',
  '/emoji list                show your changes',
  '/emoji reset               drop all your changes',
].join('\n')

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'emoji',
      description: 'Emoji picker; add, remove, import, export, list, reset',
      argumentHint: '[search | add | remove | import | export | list | reset | help]',
    })
    const storedFreq = await $.store.get('frequent')
    if (storedFreq && typeof storedFreq === 'object') {
      counts = storedFreq as Frequent
      await update($, frequent, () => counts)
    }
    const storedCustom = (await $.store.get('custom')) as Custom | undefined
    if (storedCustom?.added && storedCustom.removed) {
      index(storedCustom)
      await update($, custom, () => storedCustom)
    }
    return next(e)
  })

  on('command.run', { command: 'emoji' }, async ($, e) => {
    const [sub = '', ...rest] = e.args.trim().split(/\s+/)
    const tail = e.args.trim().slice(sub.length).trim()
    const current = await read($, custom)
    const expand = async (p: string) => (p.startsWith('~/') ? `${await home($)}${p.slice(1)}` : p)

    switch (sub.toLowerCase()) {
      case 'help':
        return { text: HELP }

      case 'add': {
        const [rawName = '', ...value] = rest
        const name = rawName.replace(/^:|:$/g, '').toLowerCase()
        const char = value.join(' ').trim()
        if (!NAME.test(name) || !char) return { text: 'Usage: /emoji add <name> <emoji>' }
        const isOverride = BUILTIN.some(x => x.name === name)
        await save($, add(current, [{ name, char }]))
        return { text: `${isOverride ? 'Overrode' : 'Added'} :${name}: → ${char}` }
      }

      case 'remove':
      case 'rm': {
        const names = rest.map(n => n.replace(/^:|:$/g, '').toLowerCase()).filter(Boolean)
        // aliases resolve, so :poop: removes :hankey:
        const known = [...new Set(names.flatMap(n => byName.get(n)?.name ?? []))]
        const unknown = names.filter(n => !byName.has(n))
        if (known.length === 0) return { text: names.length ? `No emoji named ${unknown.map(n => `:${n}:`).join(' ')}` : 'Usage: /emoji remove <name...>' }
        const shown = known.map(n => `${byName.get(n)?.char ?? ''} :${n}:`).join(' ')
        await save($, remove(current, known))
        const skipped = unknown.length ? ` (no such emoji: ${unknown.map(n => `:${n}:`).join(' ')})` : ''
        return { text: `Removed ${shown}${skipped}` }
      }

      case 'import': {
        if (!tail) return { text: 'Usage: /emoji import <file>' }
        const path = await expand(tail)
        const source = await $.fs.read(path).catch((err: unknown) => err)
        if (typeof source !== 'string') return { text: `Couldn't read ${path}: ${String(source)}` }
        const parsed = parse(source)
        await save($, remove(add(current, parsed.add), parsed.remove.map(n => byName.get(n)?.name ?? n)))
        const lines = [`Imported ${parsed.add.length} emoji, removed ${parsed.remove.length} from ${path}`]
        if (parsed.errors.length) lines.push(`Skipped ${parsed.errors.length}:`, ...parsed.errors.slice(0, 10).map(x => `  ${x}`))
        return { text: lines.join('\n') }
      }

      case 'export': {
        if (!tail) return { text: 'Usage: /emoji export <file>' }
        const path = await expand(tail)
        await $.fs.write(path, exported(current))
        return { text: `Wrote ${current.added.length} added and ${current.removed.length} removed to ${path}` }
      }

      case 'list': {
        if (!current.added.length && !current.removed.length) return { text: 'No changes: the built-in set as shipped.' }
        const lines = []
        if (current.added.length) lines.push('Added:', ...current.added.map(x => `  ${x.char}  :${x.name}:`))
        if (current.removed.length) lines.push('Removed:', `  ${current.removed.map(n => `:${n}:`).join(' ')}`)
        return { text: lines.join('\n') }
      }

      case 'reset':
        await save($, EMPTY)
        return { text: 'Emoji set back to the built-ins.' }
    }

    await update($, query, () => e.args.trim().replace(/^:|:$/g, ''))
    await $.ui.open({ id: PANE, title: 'Emoji', focus: true, closeOnEscape: true })
    return {}
  })

  // 1. :shortcode typeahead
  on('prompt.autocomplete', { token: /^:/ }, async ($, e, next) => {
    const q = QUERY.exec(e.token)?.[1]
    if (!q) return next(e)

    const rows = suggest(q.toLowerCase())
    if (rows.length === 0) return next(e)

    const { suggestions } = await next(e)
    return { suggestions: [...rows, ...suggestions] }
  })

  // 3. auto-replace a closed :shortcode: as you type it. Needs whitespace or the
  // start of the line before it, so `code:like:this` and 10:30: are left alone.
  on('prompt.edit', async ($, e, next) => {
    const box = await next(e)
    if (!e.inputText.endsWith(':') || e.inputText.includes('\n')) return box

    const before = box.text.slice(0, box.cursor)
    const name = CLOSED.exec(before)?.[2]
    const emoji = name && byName.get(name.toLowerCase())
    if (!name || !emoji) return box

    // the replacement mustn't wait on, or fail with, the count
    bump($, emoji.name).catch(() => undefined)
    const at = box.cursor - name.length - 2
    return {
      ...box,
      text: box.text.slice(0, at) + emoji.char + box.text.slice(box.cursor),
      cursor: at + emoji.char.length,
    }
  })

  // 2. picker pane: search box, Slack's category bar, one category's grid
  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Button, Input } = $.ui.resolve(e)
    const raw = await read($, query)
    const q = raw.trim().toLowerCase()
    const used = await read($, frequent)
    const mine = await read($, custom)
    const chosen = await read($, tab)
    const all = effective(mine)
    const addedNames = new Set(mine.added.map(x => x.name))

    const pick = async (emoji: Emoji) => {
      const filled = await $.prompt.fill({ text: emoji.char, mode: 'insert' })
      if (!filled.isFilled) $.ui.toast(`Couldn't insert ${emoji.char} here`)
      await bump($, emoji.name)
      await update($, query, () => '')
      await $.ui.close({ id: PANE })
    }

    const grid = (prefix: string, list: readonly Emoji[]) => (
      <Box flexDirection="column">
        {layout(list, e.props.bodyColumns).map((row, i) => (
          <Box key={`${prefix}-row-${i}`} flexDirection="row" gap={1}>
            {row.map(em => (
              <Button key={`${prefix}:${em.name}`} plain label={em.char} onPress={() => pick(em)} />
            ))}
          </Box>
        ))}
      </Box>
    )

    const frequentList = Object.entries(used)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, FREQUENT_SHOWN)
      .map(([name]) => all.find(em => em.name === name))
      .filter((em): em is Emoji => em !== undefined)
    const inTab = (name: string): Emoji[] =>
      name === FREQUENT_TAB
        ? frequentList
        : name === CUSTOM_TAB
          ? mine.added
          : all.filter(x => x.category === name && !addedNames.has(x.name))
    const tabs = TABS.filter(([name]) => inTab(name).length > 0)
    const current = tabs.find(([name]) => name === chosen)?.[0] ?? tabs[0]?.[0] ?? ''

    const matches = q ? search(all, q, MAX_MATCHES) : []
    const top = matches[0]

    return (
      <Box flexDirection="column" gap={1}>
        <Input
          key="search"
          autoFocus
          placeholder="Search emoji"
          value={raw}
          submitLabel="insert first"
          onInput={value => update($, query, () => value)}
          onSubmit={() => {
            if (top) return pick(top)
          }}
        />
        {q ? (
          matches.length === 0 ? <Text dimColor>No emoji match "{q}"</Text> : grid('match', matches)
        ) : (
          <Box flexDirection="column">
            <Box flexDirection="row" gap={1}>
              {tabs.map(([name, icon]) => (
                <Button
                  key={`tab:${name}`}
                  plain
                  label={icon}
                  dimColor={name !== current}
                  onPress={() => update($, tab, () => name)}
                />
              ))}
            </Box>
            <Text bold>{current}</Text>
            {grid('cell', inTab(current))}
          </Box>
        )}
        <Text dimColor>
          {top ? `Enter inserts ${top.char} :${top.name}:` : 'Type to search · Tab to move · Esc to close'}
        </Text>
      </Box>
    )
  })
}
