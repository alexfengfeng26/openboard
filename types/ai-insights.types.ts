/**
 * AI 洞察类型
 */
export type InsightType =
  | 'stale_cards'        // 停滞卡片
  | 'duplicate_cards'    // 可能重复的卡片
  | 'lane_overload'      // 列表过载
  | 'unbalanced_work'    // 工作分配不均
  | 'missing_tags'       // 缺少标签的卡片
  | 'action_suggested'   // 建议操作

/**
 * AI 洞察严重程度
 */
export type InsightSeverity = 'info' | 'warning' | 'critical'

/**
 * AI 洞察数据结构
 */
export interface AiInsight {
  id: string
  type: InsightType
  severity: InsightSeverity
  title: string
  message: string
  /** 相关卡片 ID 列表 */
  relatedCardIds?: string[]
  /** 相关列表 ID */
  relatedLaneId?: string
  /** 建议的操作 */
  suggestedAction?: {
    label: string
    toolName: string
    params: Record<string, unknown>
  }
  /** 生成时间 */
  generatedAt: string
}

/**
 * AI 洞察 API 请求体
 */
export interface InsightsRequestBody {
  boardId: string
  boardTitle: string
  lanes: Array<{
    id: string
    title: string
    cards: Array<{
      id: string
      title: string
      description?: string
      position: number
      createdAt: string
      updatedAt: string
      tags?: Array<{ id: string; name: string; color: string }>
    }>
  }>
  tags?: Array<{ id: string; name: string; color: string }>
}

/**
 * AI 洞察 API 响应
 */
export interface InsightsResponse {
  success: boolean
  insights?: AiInsight[]
  error?: string
}
