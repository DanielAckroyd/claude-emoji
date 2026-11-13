// pick counts by shortcode, mirrored from $.store
export type Frequent = Record<string, number>

export type CustomEmoji = { name: string; char: string; aliases?: readonly string[] }

// the person's changes to the built-in set, mirrored from $.store
export type Custom = { added: CustomEmoji[]; removed: string[] }

declare module 'claude-code' {
  interface PluginState {
    emoji: {
      // the picker's search box
      query: string
      frequent: Frequent
      custom: Custom
      // the picker's chosen category
      tab: string
    }
  }
}
