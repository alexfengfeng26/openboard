export type AiCommandKind = 'tool_prefix' | 'snippet'

export type AiCommandScope = 'all' | 'card' | 'lane' | 'board'

export type AiCommandPlacement = 'slash' | 'quickbar' | 'both'

export type AiCommand = {
  id: string
  trigger: string
  kind: AiCommandKind
  scope?: AiCommandScope
  label: string
  description?: string
  insertText: string
  enabled: boolean
  placement: AiCommandPlacement
}

