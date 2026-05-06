// 卡片相关类型定义

export type CardPriority = 'low' | 'medium' | 'high' | 'urgent'

export interface Card {
  id: string
  laneId: string
  title: string
  description?: string
  position: number
  createdAt: string
  updatedAt: string
  tags?: Tag[]
  attachments?: Attachment[]
  dueDate?: string
  priority?: CardPriority
}

export interface CreateCardInput {
  laneId: string
  title: string
  description?: string
  position?: number
  tags?: Tag[]
  attachments?: Attachment[]
  dueDate?: string
  priority?: CardPriority
}

export interface UpdateCardInput {
  title?: string
  description?: string
  tags?: Tag[]
  attachments?: Attachment[]
  dueDate?: string
  priority?: CardPriority
}

export interface Tag {
  id: string
  name: string
  color: string
}

export interface Attachment {
  id: string
  name: string
  originalName: string
  size: number
  mimeType: string
  url: string
  createdAt: string
}
