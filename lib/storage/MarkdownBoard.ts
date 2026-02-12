/**
 * Markdown 看板文件操作
 */

import { promises as fs } from 'fs'
import path from 'path'
import matter from 'gray-matter'
import type { Board, Lane, Card, Tag } from '@/types'
import type {
  BoardFrontmatter,
  LaneFrontmatter,
  CardFrontmatter,
  MarkdownDocument,
} from '@/types/storage.types'
import {
  StorageReadError,
  StorageWriteError,
  MarkdownParseError,
} from '@/types/storage.types'
import { FileLock } from './FileLock'

/**
 * 数据目录路径
 */
const DATA_DIR = path.join(process.cwd(), 'data')

/**
 * Markdown 看板存储类
 * 负责看板 Markdown 文件的读写和解析
 */
export class MarkdownBoard {
  private static readonly GRAY_MATTER_DELIMITER = '---'
  private static readonly GRAY_MATTER_DELIMITER_LEN = 3

  /**
   * 读取看板文件
   * @param boardId 看板 ID
   * @returns 看板数据，如果文件不存在或解析失败则返回 null
   * @throws StorageReadError 如果读取失败
   */
  static async read(boardId: string): Promise<Board | null> {
    const filePath = this.getBoardPath(boardId)

    try {
      // 获取锁
      const release = await FileLock.acquire(filePath, { timeout: 5000 })
      try {
        // 检查文件是否存在
        try {
          await fs.access(filePath)
        } catch {
          return null
        }

        // 读取文件内容
        const content = await fs.readFile(filePath, 'utf-8')
        return this.parseBoard(content)
      } finally {
        await release()
      }
    } catch (error) {
      throw new StorageReadError(
        `读取看板文件失败: ${boardId}`,
        filePath,
        error as Error
      )
    }
  }

  /**
   * 写入看板文件
   * @param board 看板数据
   * @throws StorageWriteError 如果写入失败
   */
  static async write(board: Board): Promise<void> {
    const filePath = this.getBoardPath(board.id)

    try {
      const release = await FileLock.acquire(filePath, { timeout: 5000 })
      try {
        // 序列化为 Markdown
        const content = this.serializeBoard(board)

        // 写入临时文件
        const tempPath = `${filePath}.tmp`
        await fs.writeFile(tempPath, content, 'utf-8')

        // 原子性重命名
        await fs.rename(tempPath, filePath)
      } finally {
        await release()
      }
    } catch (error) {
      throw new StorageWriteError(
        `写入看板文件失败: ${board.id}`,
        filePath,
        error as Error
      )
    }
  }

  /**
   * 删除看板文件
   * @param boardId 看板 ID
   * @throws StorageDeleteError 如果删除失败
   */
  static async delete(boardId: string): Promise<void> {
    const filePath = this.getBoardPath(boardId)

    try {
      const release = await FileLock.acquire(filePath, { timeout: 5000 })
      try {
        await fs.unlink(filePath)
      } finally {
        await release()
      }
    } catch (error) {
      throw new StorageWriteError(
        `删除看板文件失败: ${boardId}`,
        filePath,
        error as Error
      )
    }
  }

  /**
   * 检查看板文件是否存在
   */
  static async exists(boardId: string): Promise<boolean> {
    const filePath = this.getBoardPath(boardId)
    try {
      await fs.access(filePath)
      return true
    } catch {
      return false
    }
  }

  /**
   * 列出所有看板 ID
   * @returns 所有看板 ID 数组
   */
  static async listAll(): Promise<string[]> {
    try {
      await fs.mkdir(DATA_DIR, { recursive: true })

      const files = await fs.readdir(DATA_DIR)
      return files
        .filter((f) => f.endsWith('.md'))
        .map((f) => f.replace(/\.md$/, ''))
    } catch {
      return []
    }
  }

  /**
   * 解析 Markdown 内容为看板对象
   * @param content Markdown 文件内容
   * @returns 看板对象
   * @throws MarkdownParseError 如果解析失败
   */
  private static parseBoard(content: string): Board {
    try {
      const { data, content: body } = matter(content)

      if (!data) {
        throw new MarkdownParseError('无效的 Markdown frontmatter', '')
      }

      const frontmatter = data as BoardFrontmatter

      // 验证必需字段
      if (!frontmatter.id || !frontmatter.title) {
        throw new MarkdownParseError('缺少必需字段: id 或 title', '')
      }

      // 解析列表和卡片
      const lanes: Lane[] = (frontmatter.lanes || []).map((laneFm: LaneFrontmatter) => {
        const cards: Card[] = (laneFm.cards || []).map((cardFm: CardFrontmatter) => {
          return {
            id: cardFm.id,
            laneId: laneFm.id,
            title: cardFm.title,
            description: cardFm.description,
            position: cardFm.position ?? 0,
            createdAt: cardFm.createdAt || new Date().toISOString(),
            updatedAt: cardFm.updatedAt || new Date().toISOString(),
            tags: cardFm.tags || [],
          }
        })

        return {
          id: laneFm.id,
          boardId: frontmatter.id,
          title: laneFm.title,
          position: laneFm.position ?? 0,
          createdAt: laneFm.createdAt || new Date().toISOString(),
          updatedAt: laneFm.updatedAt || new Date().toISOString(),
          cards,
        }
      })

      return {
        id: frontmatter.id,
        title: frontmatter.title,
        createdAt: frontmatter.createdAt || new Date().toISOString(),
        updatedAt: frontmatter.updatedAt || new Date().toISOString(),
        tags: frontmatter.tags || [],
        lanes,
      }
    } catch (error) {
      throw new MarkdownParseError(
        `解析看板 Markdown 失败: ${(error as Error).message}`,
        '',
        error as Error
      )
    }
  }

  /**
   * 序列化看板对象为 Markdown 内容
   * @param board 看板对象
   * @returns Markdown 文件内容
   */
  private static serializeBoard(board: Board): string {
    const frontmatter: Record<string, unknown> = {
      id: board.id,
      title: board.title,
      createdAt: board.createdAt,
      updatedAt: board.updatedAt,
      tags: board.tags || [],
      lanes: board.lanes.map((lane) => {
        const laneFm: Record<string, unknown> = {
          id: lane.id,
          title: lane.title,
          position: lane.position,
          createdAt: lane.createdAt,
          updatedAt: lane.updatedAt,
        }

        // 包含卡片数据
        if (lane.cards && lane.cards.length > 0) {
          laneFm.cards = lane.cards.map((card) => {
            const cardFm: Record<string, unknown> = {
              id: card.id,
              laneId: lane.id,
              title: card.title,
              position: card.position,
              createdAt: card.createdAt,
              updatedAt: card.updatedAt,
            }

            // 只添加有值的属性
            if (card.description !== undefined) {
              cardFm.description = card.description
            }
            if (card.tags && card.tags.length > 0) {
              cardFm.tags = card.tags
            }

            return cardFm
          })
        }

        return laneFm
      }),
    }

    // 添加可选的 Markdown 正文
    const body = this.generateMarkdownBody(board)

    // 使用 gray-matter 序列化（frontmatter + body）
    return matter.stringify(body, frontmatter)
  }

  /**
   * 生成 Markdown 正文内容（可选）
   */
  private static generateMarkdownBody(board: Board): string {
    const parts: string[] = []

    for (const lane of board.lanes) {
      parts.push(`\n## ${lane.title}\n`)

      for (const card of lane.cards) {
        parts.push(`### ${card.title}\n`)
        if (card.description) {
          parts.push(`${card.description}\n`)
        }
        if (card.tags && card.tags.length > 0) {
          const tagNames = card.tags.map((t) => t.name).join('、')
          parts.push(`**标签**: ${tagNames}\n`)
        }
      }
    }

    return parts.join('\n')
  }

  /**
   * 获取看板文件路径
   */
  private static getBoardPath(boardId: string): string {
    // 确保看板 ID 不包含路径分隔符
    const sanitizedId = boardId.replace(/[\/\\\.]/g, '-')
    return path.join(DATA_DIR, `${sanitizedId}.md`)
  }
}
