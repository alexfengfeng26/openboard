import { Low } from 'lowdb'
import { JSONFile } from 'lowdb/node'
import { fileURLToPath } from 'url'
import path from 'path'

function createEntityId(prefix: string): string {
  const uuid = typeof globalThis.crypto?.randomUUID === 'function' ? globalThis.crypto.randomUUID() : null
  if (uuid) return `${prefix}-${uuid}`
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function ensureUniqueCardIds(data: Data): boolean {
  const seen = new Set<string>()
  let changed = false
  for (const board of data.boards) {
    for (const lane of board.lanes) {
      for (const card of lane.cards) {
        if (typeof card.id !== 'string' || card.id.trim().length === 0 || seen.has(card.id)) {
          card.id = createEntityId('card')
          card.updatedAt = new Date().toISOString()
          changed = true
        }
        seen.add(card.id)
      }
    }
  }
  return changed
}

// 数据模型类型定义
export interface Tag {
  id: string
  name: string
  color: string
}

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

export interface Lane {
  id: string
  boardId: string
  title: string
  position: number
  cards: Card[]
  createdAt: string
  updatedAt: string
}

export interface Board {
  id: string
  title: string
  lanes: Lane[]
  tags?: Tag[]
  createdAt: string
  updatedAt: string
}

export interface Data {
  boards: Board[]
}

// 预设标签颜色
export const TAG_COLORS = [
  { name: '紧急', color: '#ef4444' },
  { name: '功能', color: '#3b82f6' },
  { name: 'Bug', color: '#f59e0b' },
  { name: '优化', color: '#10b981' },
  { name: '文档', color: '#8b5cf6' },
  { name: '设计', color: '#ec4899' },
]

// 获取数据文件路径
const currentDir = path.dirname(fileURLToPath(import.meta.url))
const dbFilePath = path.join(currentDir, '..', 'data', 'db.json')

// 数据库初始化
const defaultData: Data = {
  boards: [
    {
      id: 'default-board',
      title: '我的看板',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      tags: TAG_COLORS.map((t, i) => ({ id: `tag-${i}`, name: t.name, color: t.color })),
      lanes: [
        {
          id: 'lane-todo',
          boardId: 'default-board',
          title: '待办',
          position: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          cards: [
            {
              id: 'card-2',
              laneId: 'lane-todo',
              title: '拖放功能演示',
              description: '尝试拖动这个卡片',
              position: 0,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              tags: [{ id: 'tag-0', name: '紧急', color: '#ef4444' }],
            },
          ],
        },
        {
          id: 'lane-inprogress',
          boardId: 'default-board',
          title: '进行中',
          position: 1,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          cards: [
            {
              id: 'card-3',
              laneId: 'lane-inprogress',
              title: '开发中',
              description: '正在积极开发的功能',
              position: 0,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          ],
        },
        {
          id: 'lane-done',
          boardId: 'default-board',
          title: '已完成',
          position: 2,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          cards: [
            {
              id: 'card-4',
              laneId: 'lane-done',
              title: '项目初始化',
              description: '已完成项目搭建',
              position: 0,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          ],
        },
      ],
    },
    // 预设示例看板 - 敏捷开发
    {
      id: 'board-scrum',
      title: 'Scrum 敏捷开发',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      tags: TAG_COLORS.map((t, i) => ({ id: `scrum-tag-${i}`, name: t.name, color: t.color })),
      lanes: [
        {
          id: 'scrum-backlog',
          boardId: 'board-scrum',
          title: 'Backlog',
          position: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          cards: [
            {
              id: 'scrum-card-1',
              laneId: 'scrum-backlog',
              title: '用户登录功能',
              description: '支持邮箱和手机号登录',
              position: 0,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              tags: [{ id: 'scrum-tag-1', name: '功能', color: '#3b82f6' }],
            },
          ],
        },
        {
          id: 'scrum-sprint',
          boardId: 'board-scrum',
          title: 'Sprint',
          position: 1,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          cards: [],
        },
        {
          id: 'scrum-review',
          boardId: 'board-scrum',
          title: 'Review',
          position: 2,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          cards: [],
        },
        {
          id: 'scrum-done',
          boardId: 'board-scrum',
          title: 'Done',
          position: 3,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          cards: [],
        },
      ],
    },
    // 预设示例看板 - Bug 跟踪
    {
      id: 'board-bug',
      title: 'Bug 跟踪',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      tags: [
        { id: 'bug-tag-0', name: 'P0-紧急', color: '#ef4444' },
        { id: 'bug-tag-1', name: 'P1-高', color: '#f97316' },
        { id: 'bug-tag-2', name: 'P2-中', color: '#eab308' },
        { id: 'bug-tag-3', name: 'P3-低', color: '#22c55e' },
      ],
      lanes: [
        {
          id: 'bug-reported',
          boardId: 'board-bug',
          title: '已报告',
          position: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          cards: [],
        },
        {
          id: 'bug-fixing',
          boardId: 'board-bug',
          title: '修复中',
          position: 1,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          cards: [],
        },
        {
          id: 'bug-testing',
          boardId: 'board-bug',
          title: '待验证',
          position: 2,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          cards: [],
        },
        {
          id: 'bug-closed',
          boardId: 'board-bug',
          title: '已关闭',
          position: 3,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          cards: [],
        },
      ],
    },
  ],
}

// 创建数据库实例
async function createDb() {
  const db = new Low<Data>(new JSONFile<Data>(dbFilePath), defaultData)
  await db.read()

  // 如果数据为空或文件不存在，使用默认数据
  if (!db.data || !db.data.boards || db.data.boards.length === 0) {
    db.data = defaultData
    await db.write()
  }
 
  if (db.data && ensureUniqueCardIds(db.data)) {
    await db.write()
  }

  return db
}

// 单例模式
let dbInstance: Low<Data> | null = null

export async function getDb() {
  if (!dbInstance) {
    dbInstance = await createDb()
  }
  return dbInstance
}

// 重置数据库实例（开发环境使用）
export async function resetDb() {
  dbInstance = null
}

// 数据库操作辅助函数
export const dbHelpers = {
  // ========== 看板管理 ==========

  /** 获取所有看板列表（轻量级） */
  async getBoards(): Promise<Array<{ id: string; title: string; createdAt: string; updatedAt: string }>> {
    const db = await getDb()
    return db.data.boards.map((b) => ({
      id: b.id,
      title: b.title,
      createdAt: b.createdAt,
      updatedAt: b.updatedAt,
    }))
  },

  /** 根据 ID 获取看板 */
  async getBoard(boardId: string): Promise<Board | null> {
    const db = await getDb()
    return db.data.boards.find((b) => b.id === boardId) || null
  },

  /** 创建新看板 */
  async createBoard(title: string): Promise<Board> {
    const db = await getDb()
    const now = new Date().toISOString()
    const boardId = createEntityId('board')

    const newBoard: Board = {
      id: boardId,
      title,
      createdAt: now,
      updatedAt: now,
      tags: TAG_COLORS.map((t) => ({ id: createEntityId('tag'), name: t.name, color: t.color })),
      lanes: [
        {
          id: createEntityId('lane'),
          boardId,
          title: '待办',
          position: 0,
          cards: [],
          createdAt: now,
          updatedAt: now,
        },
        {
          id: createEntityId('lane'),
          boardId,
          title: '进行中',
          position: 1,
          cards: [],
          createdAt: now,
          updatedAt: now,
        },
        {
          id: createEntityId('lane'),
          boardId,
          title: '已完成',
          position: 2,
          cards: [],
          createdAt: now,
          updatedAt: now,
        },
      ],
    }

    db.data.boards.push(newBoard)
    await db.write()
    return newBoard
  },

  /** 更新看板 */
  async updateBoard(boardId: string, data: { title?: string }): Promise<Board | null> {
    const db = await getDb()
    const board = db.data.boards.find((b) => b.id === boardId)
    if (board) {
      Object.assign(board, data, { updatedAt: new Date().toISOString() })
      await db.write()
      return board
    }
    return null
  },

  /** 删除看板（至少保留一个） */
  async deleteBoard(boardId: string): Promise<boolean> {
    const db = await getDb()
    const index = db.data.boards.findIndex((b) => b.id === boardId)
    if (index === -1) return false
    if (db.data.boards.length <= 1) {
      throw new Error('Cannot delete the last board')
    }
    db.data.boards.splice(index, 1)
    await db.write()
    return true
  },

  // 获取默认看板（保持兼容性）
  async getDefaultBoard(): Promise<Board | null> {
    return this.getBoard('default-board')
  },

  // 获取所有标签
  async getTags(boardId?: string): Promise<Tag[]> {
    const db = await getDb()
    const targetId = boardId || 'default-board'
    const board = db.data.boards.find((b) => b.id === targetId)
    return board?.tags || TAG_COLORS.map((t, i) => ({ id: `tag-${i}`, name: t.name, color: t.color }))
  },

  // 移动卡片
  async moveCard(boardId: string, cardId: string, toLaneId: string, newPosition: number): Promise<void> {
    const db = await getDb()
    const board = db.data.boards.find((b) => b.id === boardId)
    if (!board) return

    // 查找卡片
    let card: Card | null = null
    let fromLaneId: string | null = null

    for (const lane of board.lanes) {
      const cardIndex = lane.cards.findIndex((c) => c.id === cardId)
      if (cardIndex !== -1) {
        card = lane.cards[cardIndex]
        fromLaneId = lane.id
        lane.cards.splice(cardIndex, 1)
        break
      }
    }

    if (!card || !fromLaneId) return

    // 添加到目标列表
    const toLane = board.lanes.find((l) => l.id === toLaneId)
    if (!toLane) return

    card.laneId = toLaneId
    card.position = newPosition
    card.updatedAt = new Date().toISOString()

    toLane.cards.push(card)

    await db.write()
  },

  // 创建卡片
  async createCard(boardId: string, laneId: string, title: string, description?: string, tags?: Tag[]): Promise<Card> {
    const db = await getDb()
    const board = db.data.boards.find((b) => b.id === boardId)
    if (!board) throw new Error('Board not found')

    const lane = board.lanes.find((l) => l.id === laneId)
    if (!lane) throw new Error('Lane not found')

    const newCard: Card = {
      id: createEntityId('card'),
      laneId,
      title,
      description,
      position: lane.cards.length,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      tags: tags || [],
    }

    lane.cards.push(newCard)
    lane.updatedAt = new Date().toISOString()
    board.updatedAt = new Date().toISOString()

    await db.write()
    return newCard
  },

  // 创建列表
  async createLane(boardId: string, title: string): Promise<Lane> {
    const db = await getDb()
    const board = db.data.boards.find((b) => b.id === boardId)
    if (!board) throw new Error('Board not found')

    const newLane: Lane = {
      id: createEntityId('lane'),
      boardId: board.id,
      title,
      position: board.lanes.length,
      cards: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    board.lanes.push(newLane)
    board.updatedAt = new Date().toISOString()

    await db.write()
    return newLane
  },

  // 更新卡片
  async updateCard(boardId: string, cardId: string, data: Partial<Card>): Promise<void> {
    const db = await getDb()
    const board = db.data.boards.find((b) => b.id === boardId)
    if (!board) return

    for (const lane of board.lanes) {
      const card = lane.cards.find((c) => c.id === cardId)
      if (card) {
        Object.assign(card, data, { updatedAt: new Date().toISOString() })
        lane.updatedAt = new Date().toISOString()
        board.updatedAt = new Date().toISOString()
        await db.write()
        return
      }
    }
  },

  // 更新列表
  async updateLane(boardId: string, laneId: string, data: Partial<Lane>): Promise<void> {
    const db = await getDb()
    const board = db.data.boards.find((b) => b.id === boardId)
    if (!board) return

    const lane = board.lanes.find((l) => l.id === laneId)
    if (lane) {
      Object.assign(lane, data, { updatedAt: new Date().toISOString() })
      board.updatedAt = new Date().toISOString()
      await db.write()
    }
  },

  // 删除卡片
  async deleteCard(boardId: string, cardId: string): Promise<void> {
    const db = await getDb()
    const board = db.data.boards.find((b) => b.id === boardId)
    if (!board) return

    for (const lane of board.lanes) {
      const index = lane.cards.findIndex((c) => c.id === cardId)
      if (index !== -1) {
        lane.cards.splice(index, 1)
        lane.updatedAt = new Date().toISOString()
        board.updatedAt = new Date().toISOString()
        await db.write()
        return
      }
    }
  },

  // 删除列表
  async deleteLane(boardId: string, laneId: string): Promise<void> {
    const db = await getDb()
    const board = db.data.boards.find((b) => b.id === boardId)
    if (!board) return

    const index = board.lanes.findIndex((l) => l.id === laneId)
    if (index !== -1) {
      board.lanes.splice(index, 1)
      board.updatedAt = new Date().toISOString()
      await db.write()
    }
  },
}
