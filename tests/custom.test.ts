import { expect, test } from 'claude-code/testing'

test('add, remove, import and export change what the prompt converts', async ($, on) => {
  const store = new Map<string, unknown>()
  const files = new Map<string, string>([
    ['/tmp/set.txt', '# team set\nshipit 🐿️\n:lgtm: 👌\n-skull\nbad!name 💥\n'],
  ])
  on('store.get', (_, e) => ({ value: store.get(e.key) }))
  on('store.set', (_, e) => (store.set(e.key, e.value), { value: undefined }))
  on('env.get', () => ({ value: '/Users/me' }))
  on('fs.read', (_, e) => {
    const text = files.get(e.path)
    if (text === undefined) throw new Error('ENOENT')
    return { value: text }
  })
  on('fs.write', (_, e) => (files.set(e.path, e.text), { value: undefined }))
  on('command.register', () => ({ value: { command: 'emoji' } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('prompt.edit', (_, e) => {
    const text = e.text.slice(0, e.start) + e.inputText + e.text.slice(e.end)
    return { text, cursor: e.start + e.inputText.length }
  })

  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  const run = (args: string) =>
    ($.command as any).run({ command: 'emoji', args, origin: { kind: 'composer' } }) as Promise<{ text?: string }>
  const close = async (name: string) =>
    (await ($.prompt as any).edit({ origin: { kind: 'composer' }, text: `:${name}`, cursor: name.length + 1, start: name.length + 1, end: name.length + 1, inputText: ':' })).text

  expect((await run('add shrug ¯\\_(ツ)_/¯')).text).toContain('Overrode :shrug:')
  expect(await close('shrug')).toBe('¯\\_(ツ)_/¯')

  expect((await run('remove poop nope')).text).toBe('Removed 💩 :hankey: (no such emoji: :nope:)')
  expect(await close('poop')).toBe(':poop:')

  const imported = (await run('import /tmp/set.txt')).text
  expect(imported).toContain('Imported 2 emoji, removed 1')
  expect(imported).toContain('Skipped 1')
  expect(await close('shipit')).toBe('🐿️')
  expect(await close('skull')).toBe(':skull:')

  await run('export ~/emoji.json')
  expect(JSON.parse(files.get('/Users/me/emoji.json') ?? '{}')).toEqual({
    add: { shrug: '¯\\_(ツ)_/¯', shipit: '🐿️', lgtm: '👌' },
    remove: ['hankey', 'skull'],
  })

  await run('reset')
  expect(await close('poop')).toBe('💩')
  expect(await close('shipit')).toBe(':shipit:')
})
