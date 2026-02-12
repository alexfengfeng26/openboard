// 看板相关类型定义

import type { Lane, LaneWithCards } from './lane.types'
import type { Tag } from './card.types'

export interface Board {
  id: string
  title: string
  createdAt: string
  updatedAt: string
  lanes: Lane[]
  tags?: Tag[]
}

export interface BoardWithLanes extends Board {
  lanes: Lane[]
}

export interface BoardWithLanesAndCards extends Board {
  lanes: LaneWithCards[]
}

export interface CreateBoardInput {
  title: string
}

export interface UpdateBoardInput {
  title?: string
}

/**
 * 原始数据库结构（用于兼容性）
 * @deprecated 新的 Markdown 存储不再使用此结构
 */
export interface Data {
  boards: Board[]
}
