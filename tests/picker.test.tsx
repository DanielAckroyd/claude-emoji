import { expect, test } from 'claude-code/testing'

const PANE = {
  plugin: 'emoji',
  component: 'Pane',
  requestId: 'emoji-picker',
  props: {
    title: 'Emoji',
    isFocused: true,
    bodyColumns: 40,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 30 },
    view: {},
  },
} as const

test('the picker searches, inserts the pick and remembers it', async ($, on) => {
  const filled: string[] = []
  const store = new Map<string, unknown>()
  on('store.get', (_, e) => ({ value: store.get(e.key) }))
  on('store.set', (_, e) => {
    store.set(e.key, e.value)
    return { value: undefined }
  })
  on('command.register', () => ({ value: { command: 'emoji' } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('ui.close', () => ({ value: undefined }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('prompt.fill', (_, e) => {
    filled.push(e.text)
    return { isFilled: true, text: e.text, cursor: e.text.length }
  })

  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    // the bar switches category (and the choice outlives the pane)
    await ui.press({ key: 'tab:Smileys & Emotion' })
    expect(await ui.find({ type: 'Button', key: 'cell:grinning' })).toBeTruthy()
    expect(await ui.find({ type: 'Button', key: 'cell:fire' })).toBeUndefined()
    await ui.press({ key: 'tab:Travel & Places' })
    expect(await ui.find({ type: 'Button', key: 'cell:fire' })).toBeTruthy()

    await ui.input({ key: 'search', text: 'fir', kind: 'change' })
    expect((await ui.find({ type: 'Text', text: /Enter inserts 🔥/ }))?.text).toContain(':fire:')

    await ui.input({ key: 'search', text: 'fir' })
    await ui.unmount()
  }

  expect(filled).toEqual(['🔥', '🔥'])
  expect(store.get('frequent')).toEqual({ fire: 2 })
})
