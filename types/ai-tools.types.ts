// AI 工具类型定义

/**
 * 工具调用请求
 */
export interface ToolCallRequest {
  toolName: string
  params: Record<string, unknown>
  description?: string
}

/**
 * 工具执行结果
 */
export interface ToolExecutionResult {
  success: boolean
  toolName: string
  params: Record<string, unknown>
  result?: unknown
  error?: string
  timestamp: string
}

/**
 * 工具定义接口
 */
export interface ToolDefinition {
  name: string
  description: string
  category: 'board' | 'lane' | 'card'
  paramSchema: ToolParameterSchema[]
}

/**
 * 参数模式定义
 */
export interface ToolParameterSchema {
  name: string
  type: 'string' | 'number' | 'boolean' | 'array' | 'object'
  required: boolean
  description: string
  defaultValue?: unknown
  enum?: string[]
}

/**
 * 操作日志条目
 */
export interface OperationLogEntry {
  id: string
  timestamp: string
  status: 'pending' | 'confirmed' | 'executed' | 'failed' | 'cancelled'
  toolName: string
  params: Record<string, unknown>
  result?: unknown
  error?: string
  confirmedBy?: 'user' | 'auto'
}

/**
 * AI 响应中的工具调用格式
 */
export interface AIToolCallResponse {
  tool_calls: ToolCallRequest[]
}

/**
 * Prompt 上下文
 */
export interface PromptContext {
  currentBoard?: {
    id: string
    title: string
  }
  currentLanes?: Array<{
    id: string
    title: string
    cardCount: number
  }>
}

/**
 * 聊天消息
 */
export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
}
