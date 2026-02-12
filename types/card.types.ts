// 卡片相关类型定义

export interface Card {
  id: string
  laneId: string
  title: string
  description?: string
  position: number
  createdAt: string
  updatedAt: string
  tags?: Tag[]
}

export interface CreateCardInput {
  laneId: string
  title: string
  description?: string
  position?: number
  tags?: Tag[]
}

export interface UpdateCardInput {
  title?: string
  description?: string
  laneId?: string
  position?: number
  tags?: Tag[]
}

export interface Tag {
  id: string
  name: string
  color: string
}
