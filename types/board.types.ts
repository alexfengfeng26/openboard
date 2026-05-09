// 看板相关类型定义

import type { Lane } from './lane.types'
import type { Tag } from './card.types'
import type { OperationLogEntry } from './ai-tools.types'

export interface Board {
  id: string
  title: string
  createdAt: string
  updatedAt: string
  lanes: Lane[]
  tags?: Tag[]
  archivedAt?: string
  favoritedAt?: string
  operationLogs?: OperationLogEntry[]
}

export interface BoardWithLanes extends Board {
  lanes: Lane[]
}

export interface CreateBoardInput {
  title: string
}

export interface UpdateBoardInput {
  title?: string
  archivedAt?: string
  favoritedAt?: string | null
}

/**
 * 原始数据库结构（用于兼容性）
 * @deprecated 新的 Markdown 存储不再使用此结构
 */
export interface Data {
  boards: Board[]
}
