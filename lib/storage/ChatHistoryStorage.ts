/**
 * 聊天历史存储 - 服务端持久化
 * 使用 FileLock 保护并发写入，原子写入
 */

import { promises as fs } from 'fs'
import path from 'path'
import type { ChatMessage } from '@/types/ai-tools.types'
import { FileLock } from './FileLock'

const CHAT_HISTORY_DIR = path.join(process.cwd(), 'data', 'chat-history')
const MAX_MESSAGES = 50

export class ChatHistoryStorage {
  private static instance: ChatHistoryStorage

  private constructor() {}

  static getInstance(): ChatHistoryStorage {
    if (!ChatHistoryStorage.instance) {
      ChatHistoryStorage.instance = new ChatHistoryStorage()
    }
    return ChatHistoryStorage.instance
  }

  private getFilePath(boardId: string): string {
    const safeId = boardId.replace(/[^a-zA-Z0-9_-]/g, '')
    return path.join(CHAT_HISTORY_DIR, `${safeId}.json`)
  }

  private async ensureDir(): Promise<void> {
    await fs.mkdir(CHAT_HISTORY_DIR, { recursive: true })
  }

  /**
   * 获取聊天历史
   */
  async getHistory(boardId: string): Promise<ChatMessage[]> {
    const filePath = this.getFilePath(boardId)

    try {
      const release = await FileLock.acquire(filePath, { timeout: 5000 })
      try {
        const content = await fs.readFile(filePath, 'utf-8')
        const data = JSON.parse(content) as { messages: ChatMessage[] }
        return Array.isArray(data.messages) ? data.messages : []
      } finally {
        await release()
      }
    } catch (error) {
      const err = error as NodeJS.ErrnoException
      if (err.code === 'ENOENT') {
        return []
      }
      console.error('Error reading chat history:', error)
      throw error
    }
  }

  /**
   * 保存聊天历史（限制最多 50 条）
   */
  async saveHistory(boardId: string, messages: ChatMessage[]): Promise<void> {
    const filePath = this.getFilePath(boardId)
    const trimmed = messages.slice(-MAX_MESSAGES)

    await this.ensureDir()

    const release = await FileLock.acquire(filePath, { timeout: 5000 })
    try {
      const tempPath = `${filePath}.tmp`
      const data = {
        messages: trimmed,
        updatedAt: new Date().toISOString(),
      }
      await fs.writeFile(tempPath, JSON.stringify(data, null, 2), 'utf-8')
      await fs.rename(tempPath, filePath)
    } finally {
      await release()
    }
  }

  /**
   * 清空聊天历史
   */
  async clearHistory(boardId: string): Promise<void> {
    const filePath = this.getFilePath(boardId)

    try {
      const release = await FileLock.acquire(filePath, { timeout: 5000 })
      try {
        await fs.unlink(filePath)
      } finally {
        await release()
      }
    } catch (error) {
      const err = error as NodeJS.ErrnoException
      if (err.code !== 'ENOENT') {
        console.error('Error deleting chat history:', error)
        throw error
      }
    }
  }
}
