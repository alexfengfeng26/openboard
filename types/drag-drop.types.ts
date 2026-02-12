// 拖放相关类型定义

export interface DragEndEvent {
  active: {
    id: string
    data: {
      current: {
        type: 'CARD' | 'LANE'
        laneId?: string
      }
    }
  }
  over: {
    id: string
    data: {
      current: {
        type: 'CARD' | 'LANE'
        laneId?: string
      }
    }
  } | null
}

export interface MoveCardInput {
  cardId: string
  fromLaneId: string
  toLaneId: string
  newPosition: number
}

export interface MoveLaneInput {
  laneId: string
  newPosition: number
}

export interface ReorderResult {
  success: boolean
  affectedCards?: number
  affectedLanes?: number
}
