/**
 * 重新排序算法工具函数
 * 用于处理拖放排序后的位置计算
 */

/**
 * 数组重新排序
 * 将元素从 oldIndex 移动到 newIndex
 */
export function reorderArray<T>(array: T[], oldIndex: number, newIndex: number): T[] {
  const result = [...array]
  const [removed] = result.splice(oldIndex, 1)
  result.splice(newIndex, 0, removed)
  return result
}

/**
 * 跨数组移动元素
 * 将元素从源数组的 oldIndex 移动到目标数组的 newIndex
 */
export function moveArrayElement<T>(
  sourceArray: T[],
  targetArray: T[],
  oldIndex: number,
  newIndex: number
): { source: T[]; target: T[] } {
  const source = [...sourceArray]
  const target = [...targetArray]
  const [removed] = source.splice(oldIndex, 1)
  target.splice(newIndex, 0, removed)
  return { source, target }
}

/**
 * 重新计算位置值（使用中间值插入法）
 * 避免全量更新，只更新被移动的元素
 */
export function calculateInsertPosition(beforeItem: { position: number } | null, afterItem: { position: number } | null): number | null {
  const DEFAULT_POSITION = 1000
  const MIN_GAP = 1

  if (!beforeItem && !afterItem) {
    return DEFAULT_POSITION
  }

  if (!beforeItem) {
    return afterItem!.position - DEFAULT_POSITION
  }

  if (!afterItem) {
    return beforeItem.position + DEFAULT_POSITION
  }

  const gap = afterItem.position - beforeItem.position

  // 如果间隙太小，需要重新计算所有位置
  if (gap < MIN_GAP) {
    return null // 需要全量更新
  }

  return Math.floor((beforeItem.position + afterItem.position) / 2)
}

/**
 * 标准化位置值（当中间值不足时使用）
 * 重新计算所有元素的位置，使用固定增量
 */
export function normalizePositions<T extends { position: number }>(items: T[], startPosition = 0, increment = 1000): T[] {
  return items.map((item, index) => ({
    ...item,
    position: startPosition + index * increment,
  }))
}

/**
 * 查找元素在数组中的位置
 */
export function findIndexById<T extends { id: string }>(array: T[], id: string): number {
  return array.findIndex((item) => item.id === id)
}

/**
 * 查找元素在数组中的位置（通过 laneId）
 */
export function findIndexByLaneId<T extends { laneId: string }>(array: T[], laneId: string): number {
  return array.findIndex((item) => item.laneId === laneId)
}
