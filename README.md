# claude-emoji

Slack-style emoji for the Claude Code prompt, as a Claude Code mod. Every one of Slack's standard shortcodes (1,906 emoji, from [iamcal/emoji-data](https://github.com/iamcal/emoji-data)) in three ways you already know from Slack, plus your own additions. On top of Slack's names, about 225 everyday aliases Slack lacks also work: `:lol:`, `:rofl:`, `:facepalm:`, `:thinking:`, `:lgtm:`, `:thanks:`, `:yikes:`, `:check:`, `:stonks:` and so on (see `hooks/aliases.ts`).

## Install

At the prompt of a Claude Code terminal session:

```
/plugin install emoji --marketplace DanielAckroyd/claude-emoji
```

Answer `y` to add the marketplace, then pick a scope.

From a shell:

```
claude plugin install emoji --marketplace DanielAckroyd/claude-emoji
```

## Use

**Typeahead.** Type `:fi` and the matching emoji join the prompt's suggestions; take one and it replaces what you typed. Like Slack, it waits for two characters after the colon. The emoji you use most rank first.

**Auto-replace.** Type a whole shortcode, `ship it :fire:`, and it becomes `ship it 🔥` the moment you type the closing colon. Only after a space or at the start of a line, so `10:30:` and `` `:fire:` `` are left alone.

**Picker.** `/emoji` opens a pane with a search box and Slack's category bar (🕘 ⭐ 😀 👋 🐻 🍔 ⚽ ✈️ 💡 🔣 🏁). Type to search and Enter inserts the top match, or Tab to an emoji and press it. `/emoji fire` opens it already searching. Esc closes it.

## Customize

```
/emoji add shipit 🐿️            add one
/emoji add shrug ¯\_(ツ)_/¯      override a built-in; any text works
/emoji remove hankey skull       hide built-ins (aliases work: poop hides hankey)
/emoji import ~/team-emoji.txt   add and remove in bulk
/emoji export ~/my-emoji.json    write your changes out, ready to import
/emoji list                      show your changes
/emoji reset                     back to the built-ins
```

Changes are kept across sessions. `import` reads JSON (`{"shipit": "🐿️"}`, or what `export` writes) or plain lines:

```
# team set
shipit 🐿️
:lgtm: 👌
-skull
```

A line starting with `-` removes that emoji. Lines it can't read are skipped and listed.

## Limits

- Slack's custom workspace emoji are images, and the prompt is text, so they can't be imported. Aliases of standard emoji can, as `name emoji` lines.
- No skin-tone variants.
- Picks you take from the typeahead don't count toward "most used"; Claude Code doesn't tell the mod which suggestion you took.
- Pasted text ending in a closed shortcode converts too.

## Develop

```
claude plugin validate .
claude plugin test .
```

`hooks/emoji.ts` is generated; to update it to a newer emoji-data release, see the header of `scripts/build-emoji.ts`.

## License

MIT. Emoji data from iamcal/emoji-data, MIT.
