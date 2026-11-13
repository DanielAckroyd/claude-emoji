import { expect, test } from 'claude-code/testing'

// Type `typed` at the end of `draft`, as one keystroke, and return the box.
async function type($: any, draft: string, typed: string) {
  return $.prompt.edit({
    origin: { kind: 'composer' },
    text: draft,
    cursor: draft.length,
    start: draft.length,
    end: draft.length,
    inputText: typed,
  })
}

test('a closed :shortcode: becomes its emoji, and only then', async ($, on) => {
  on('store.set', () => ({ value: undefined }))
  // the engine's own edit: apply the splice
  on('prompt.edit', (_, e) => {
    const text = e.text.slice(0, e.start) + e.inputText + e.text.slice(e.end)
    return { text, cursor: e.start + e.inputText.length }
  })

  expect(await type($, 'ship it :fire', ':')).toMatchObject({ text: 'ship it 🔥', cursor: 10 })
  expect(await type($, ':+1', ':')).toMatchObject({ text: '👍' })
  expect(await type($, 'yo :ROCKET', ':')).toMatchObject({ text: 'yo 🚀' })
  expect(await type($, 'nice :thumbsup', ':')).toMatchObject({ text: 'nice 👍' })
  expect(await type($, 'go :flag-au', ':')).toMatchObject({ text: 'go 🇦🇺' })

  // left alone
  expect((await type($, 'at 10:30', ':')).text).toBe('at 10:30:')
  expect((await type($, 'a.b:fire', ':')).text).toBe('a.b:fire:')
  expect((await type($, '`:fire', ':')).text).toBe('`:fire:')
  expect((await type($, ':notanemoji', ':')).text).toBe(':notanemoji:')
  expect((await type($, ':fire', 's')).text).toBe(':fires')
})

test('the typeahead suggests on two characters after a colon', async ($, on) => {
  on('prompt.autocomplete', () => ({ suggestions: [] }))
  // the kit raises it at runtime but its typings leave it off the prompt noun
  const ask = (token: string): Promise<{ suggestions: { text: string }[] }> =>
    ($.prompt as any).autocomplete({ text: token, cursor: token.length, token, start: 0 })

  expect((await ask(':fir')).suggestions[0]).toMatchObject({ text: '🔥' })
  expect((await ask(':f')).suggestions).toEqual([])
  expect((await ask(':fire:')).suggestions).toEqual([])
})

test('what you use most comes first in the typeahead', async ($, on) => {
  on('store.get', (_, e) => ({ value: e.key === 'frequent' ? { fire: 3 } : undefined }))
  on('store.set', () => ({ value: undefined }))
  on('command.register', () => ({ value: { command: 'emoji' } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('prompt.autocomplete', () => ({ suggestions: [] }))
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })

  const r = await ($.prompt as any).autocomplete({ text: ':fi', cursor: 3, token: ':fi', start: 0 })
  expect(r.suggestions[0]).toMatchObject({ text: '🔥' })
})
