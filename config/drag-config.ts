/**
 * 拖放配置
 * 为 @dnd-kit/core 提供统一的配置
 */

import { DRAG_CONFIG } from './constants'

import type { DragOverlay, DragStartEvent } from '@dnd-kit/core'

export interface DragConfig {
  activationConstraint?: {
    distance: number
  }
  modifiers?: any[]
}

/**
 * 卡片拖放配置
 */
export const CARD_DRAG_CONFIG: DragConfig = {
  activationConstraint: {
    distance: DRAG_CONFIG.ACTIVATION_DISTANCE,
  },
}

/**
 * 列表拖放配置
 */
export const LANE_DRAG_CONFIG: DragConfig = {
  activationConstraint: {
    distance: DRAG_CONFIG.ACTIVATION_DISTANCE,
  },
}

/**
 * 拖放状态类型
 */
export interface DragState {
  activeId: string | null
  type: 'CARD' | 'LANE' | null
  initialLaneId?: string
}

/**
 * 创建拖放状态管理器
 */
export function createDragStateManager() {
  let state: DragState = {
    activeId: null,
    type: null,
  }

  return {
    getState: () => state,
    setActive: (event: DragStartEvent) => {
      const { active } = event
      state = {
        activeId: active.id as string,
        type: active.data.current?.type || null,
        initialLaneId: active.data.current?.laneId,
      }
    },
    clear: () => {
      state = {
        activeId: null,
        type: null,
      }
    },
  }
}
