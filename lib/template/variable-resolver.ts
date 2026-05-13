/**
 * 模板变量解析器
 * 支持 {{variableName}} 语法，含嵌套属性和默认值
 */

import type { TemplateVariableContext, VariableResolver } from '@/types/template.types'

const BUILTIN_VARIABLES: Record<string, VariableResolver> = {
  'board.title': {
    name: 'board.title',
    description: '当前看板标题',
    resolve: (ctx) => ctx.board?.title ?? '',
  },
  'board.id': {
    name: 'board.id',
    description: '当前看板 ID',
    resolve: (ctx) => ctx.board?.id ?? '',
  },
  'lane.title': {
    name: 'lane.title',
    description: '当前列表标题',
    resolve: (ctx) => ctx.lane?.title ?? '',
  },
  'lane.id': {
    name: 'lane.id',
    description: '当前列表 ID',
    resolve: (ctx) => ctx.lane?.id ?? '',
  },
  'card.title': {
    name: 'card.title',
    description: '当前卡片标题',
    resolve: (ctx) => ctx.card?.title ?? '',
  },
  'card.id': {
    name: 'card.id',
    description: '当前卡片 ID',
    resolve: (ctx) => ctx.card?.id ?? '',
  },
  'date.now': {
    name: 'date.now',
    description: '当前时间（ISO）',
    resolve: () => new Date().toISOString(),
  },
  'date.today': {
    name: 'date.today',
    description: '今日日期',
    resolve: () => new Date().toISOString().split('T')[0],
  },
  'date.tomorrow': {
    name: 'date.tomorrow',
    description: '明日日期',
    resolve: () => {
      const d = new Date()
      d.setDate(d.getDate() + 1)
      return d.toISOString().split('T')[0]
    },
  },
  'user.name': {
    name: 'user.name',
    description: '当前用户名称',
    resolve: (ctx) => ctx.user?.name ?? '',
  },
  'user.id': {
    name: 'user.id',
    description: '当前用户 ID',
    resolve: (ctx) => ctx.user?.id ?? '',
  },
}

/**
 * 解析文本中的变量
 * 语法：{{variableName}} 或 {{variableName|fallback}}
 */
export function resolveVariables(
  text: string,
  context: TemplateVariableContext
): string {
  return text.replace(/\{\{(\w+(?:\.\w+)?)(?:\|([^}]*))?\}\}/g, (match, varName, fallback) => {
    const resolver = BUILTIN_VARIABLES[varName]
    if (!resolver) return fallback ?? match
    const value = resolver.resolve(context)
    return value || fallback || match
  })
}

/**
 * 异步解析文本中的变量（为未来扩展预留）
 */
export async function resolveVariablesAsync(
  text: string,
  context: TemplateVariableContext
): Promise<string> {
  const matches = Array.from(text.matchAll(/\{\{(\w+(?:\.\w+)?)(?:\|([^}]*))?\}\}/g))
  let result = text

  for (const match of matches) {
    const [fullMatch, varName, fallback] = match
    const resolver = BUILTIN_VARIABLES[varName]
    if (!resolver) {
      if (fallback) {
        result = result.replace(fullMatch, fallback)
      }
      continue
    }
    const resolved = await Promise.resolve(resolver.resolve(context))
    result = result.replace(fullMatch, resolved || fallback || fullMatch)
  }

  return result
}

/**
 * 提取文本中使用的所有变量名
 */
export function extractVariables(text: string): string[] {
  const matches = text.matchAll(/\{\{(\w+(?:\.\w+)?)(?:\|[^}]*)?\}\}/g)
  return Array.from(new Set(Array.from(matches).map((m) => m[1])))
}

/**
 * 获取所有内置变量定义
 */
export function getBuiltinVariables(): VariableResolver[] {
  return Object.values(BUILTIN_VARIABLES)
}

/**
 * 检查变量名是否有效
 */
export function isValidVariable(name: string): boolean {
  return name in BUILTIN_VARIABLES
}
