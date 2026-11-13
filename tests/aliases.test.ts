import { expect, test } from 'claude-code/testing'

import { EXTRA_ALIASES } from '../hooks/aliases'
import { NAME } from '../hooks/custom'
import { EMOJI } from '../hooks/emoji'
import { GEMOJI_ALIASES } from '../hooks/gemoji'

test('extra aliases point at Slack names and never shadow one', () => {
  const slack = new Set(EMOJI.flatMap(e => [e.name, ...(e.aliases ?? [])]))
  const extras = Object.values(EXTRA_ALIASES).flat()

  expect(Object.keys(EXTRA_ALIASES).filter(n => !EMOJI.some(e => e.name === n))).toEqual([])
  expect(extras.filter(a => slack.has(a))).toEqual([])
  expect(extras.filter((a, i) => extras.indexOf(a) !== i)).toEqual([])
  expect(extras.filter(a => !NAME.test(a))).toEqual([])
})

test('GitHub names point at Slack names and never shadow one or a hand-kept alias', () => {
  const taken = new Set([...EMOJI.flatMap(e => [e.name, ...(e.aliases ?? [])]), ...Object.values(EXTRA_ALIASES).flat()])
  const github = Object.values(GEMOJI_ALIASES).flat()

  expect(Object.keys(GEMOJI_ALIASES).filter(n => !EMOJI.some(e => e.name === n))).toEqual([])
  expect(github.filter(a => taken.has(a))).toEqual([])
  expect(github.filter((a, i) => github.indexOf(a) !== i)).toEqual([])
  expect(github.filter(a => !NAME.test(a))).toEqual([])
})

test('an extra alias works like a Slack one', async ($, on) => {
  on('store.set', () => ({ value: undefined }))
  on('prompt.autocomplete', () => ({ suggestions: [] }))
  on('prompt.edit', (_, e) => {
    const text = e.text.slice(0, e.start) + e.inputText + e.text.slice(e.end)
    return { text, cursor: e.start + e.inputText.length }
  })
  const close = async (draft: string) =>
    (await ($.prompt as any).edit({
      origin: { kind: 'composer' }, text: draft, cursor: draft.length, start: draft.length, end: draft.length, inputText: ':',
    })).text

  expect(await close('lol :lol')).toBe('lol 😂')
  expect(await close('ship :lgtm')).toBe('ship 👍')
  // Slack's own :cricket: is the insect, not the sport
  expect(await close(':cricket')).toBe('🦗')
  expect(await close('go :afghanistan')).toBe('go 🇦🇫')
  expect(await close(':1st_place_medal')).toBe('🥇')
  // Slack's :umbrella: is the plain one, GitHub's has rain
  expect(await close(':umbrella')).toBe('☂️')

  const r = await ($.prompt as any).autocomplete({ text: ':facepa', cursor: 7, token: ':facepa', start: 0 })
  expect(r.suggestions[0]).toMatchObject({ text: '🤦' })
})
