// 列表相关类型定义

import type { Card } from './card.types'

export interface Lane {
  id: string
  boardId: string
  title: string
  position: number
  createdAt: string
  updatedAt: string
  cards?: Card[]
}

export interface LaneWithCards extends Lane {
  cards: Card[]
}

export interface CreateLaneInput {
  boardId: string
  title: string
  position?: number
}

export interface UpdateLaneInput {
  title?: string
  position?: number
}
