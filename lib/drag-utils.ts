/**
 * 拖放工具函数
 * 提供拖放相关的辅助方法
 */

import type { DragEndEvent, Active, Over } from '@dnd-kit/core'
import type { Card, Lane } from '@/types'

/**
 * 判断是否为有效的拖放操作
 */
export function isValidDragEnd(event: DragEndEvent): boolean {
  const { active, over } = event
  return !!over && active.id !== over.id
}

/**
 * 获取拖放类型
 */
export function getDragType(item: Active | Over): 'CARD' | 'LANE' | null {
  return item.data.current?.type || null
}

/**
 * 获取卡片所属的列表 ID
 */
export function getCardLaneId(active: Active): string | undefined {
  return active.data.current?.laneId
}

/**
 * 查找卡片在列表中的位置
 */
export function findCardPosition(cards: Card[], cardId: string): number {
  return cards.findIndex((card) => card.id === cardId)
}

/**
 * 查找列表在数组中的位置
 */
export function findLanePosition(lanes: Lane[], laneId: string): number {
  return lanes.findIndex((lane) => lane.id === laneId)
}

/**
 * 从所有卡片中查找指定卡片
 */
export function findCardById(lanes: Lane[], cardId: string): Card | null {
  for (const lane of lanes) {
    const card = lane.cards?.find((c) => c.id === cardId)
    if (card) {
      return card
    }
  }
  return null
}

/**
 * 获取目标列表的卡片数组
 */
export function getTargetLaneCards(lanes: Lane[], laneId: string): Card[] {
  const lane = lanes.find((l) => l.id === laneId)
  return lane?.cards || []
}

/**
 * 处理跨列表卡片拖放
 */
export function handleCardMoveAcrossLanes(
  lanes: Lane[],
  cardId: string,
  fromLaneId: string,
  toLaneId: string,
  newIndex: number
): Lane[] {
  const result = lanes.map((lane) => ({
    ...lane,
    cards: [...(lane.cards || [])],
  }))

  // 从源列表移除卡片
  const fromLane = result.find((l) => l.id === fromLaneId)
  if (!fromLane) return result

  const cardIndex = fromLane.cards.findIndex((c) => c.id === cardId)
  if (cardIndex === -1) return result

  const [card] = fromLane.cards.splice(cardIndex, 1)

  // 添加到目标列表
  const toLane = result.find((l) => l.id === toLaneId)
  if (!toLane) return result

  toLane.cards.splice(newIndex, 0, card)

  return result
}

/**
 * 处理列表内卡片排序
 */
export function handleCardReorder(lane: Lane, oldIndex: number, newIndex: number): Card[] {
  const cards = [...(lane.cards || [])]
  const [removed] = cards.splice(oldIndex, 1)
  cards.splice(newIndex, 0, removed)
  return cards
}

/**
 * 处理列表排序
 */
export function handleLaneReorder(lanes: Lane[], oldIndex: number, newIndex: number): Lane[] {
  const result = [...lanes]
  const [removed] = result.splice(oldIndex, 1)
  result.splice(newIndex, 0, removed)
  return result
}
