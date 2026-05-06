import { z } from 'zod'

/**
 * 十六进制颜色正则
 */
const HEX_COLOR_REGEX = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/

/**
 * 标签 Schema
 */
export const TagSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(20),
  color: z.string().regex(HEX_COLOR_REGEX, 'Invalid hex color format'),
})

export type TagInput = z.infer<typeof TagSchema>

/**
 * 创建卡片 Schema
 */
export const CreateCardSchema = z.object({
  boardId: z.string().min(1),
  laneId: z.string().min(1),
  title: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
  position: z.number().int().min(0).optional(),
  tags: z.array(TagSchema).max(10).optional(),
})

export type CreateCardInput = z.infer<typeof CreateCardSchema>

/**
 * 更新卡片 Schema
 */
export const UpdateCardSchema = z.object({
  cardId: z.string().min(1),
  boardId: z.string().min(1),
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(5000).optional(),
  tags: z.array(TagSchema).max(10).optional(),
})

export type UpdateCardInput = z.infer<typeof UpdateCardSchema>

/**
 * 创建列表 Schema
 */
export const CreateLaneSchema = z.object({
  boardId: z.string().min(1),
  title: z.string().min(1).max(100),
})

export type CreateLaneInput = z.infer<typeof CreateLaneSchema>

/**
 * 更新列表 Schema
 */
export const UpdateLaneSchema = z.object({
  boardId: z.string().min(1),
  laneId: z.string().min(1),
  title: z.string().min(1).max(100),
})

export type UpdateLaneInput = z.infer<typeof UpdateLaneSchema>

/**
 * 移动卡片 Schema
 */
export const MoveCardSchema = z.object({
  boardId: z.string().min(1),
  cardId: z.string().min(1),
  toLaneId: z.string().min(1),
  newPosition: z.number().int().min(0),
})

export type MoveCardInput = z.infer<typeof MoveCardSchema>

/**
 * 重排序卡片 Schema
 */
export const ReorderCardsSchema = z.object({
  boardId: z.string().min(1),
  laneId: z.string().min(1),
  cardIds: z.array(z.string().min(1)),
})

export type ReorderCardsInput = z.infer<typeof ReorderCardsSchema>

/**
 * 重排序列表 Schema
 */
export const ReorderLanesSchema = z.object({
  boardId: z.string().min(1),
  laneIds: z.array(z.string().min(1)),
})

export type ReorderLanesInput = z.infer<typeof ReorderLanesSchema>
