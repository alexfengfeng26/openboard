/**
 * Markdown 存储类型定义
 */

import type { Tag } from './index'

/**
 * YAML Frontmatter 格式的看板数据
 */
export interface BoardFrontmatter {
  id: string
  title: string
  createdAt: string
  updatedAt: string
  tags?: Tag[]
  lanes?: LaneFrontmatter[]
}

/**
 * YAML Frontmatter 格式的列表数据
 */
export interface LaneFrontmatter {
  id: string
  title: string
  position: number
  createdAt: string
  updatedAt: string
  cards?: CardFrontmatter[]
}

/**
 * YAML Frontmatter 格式的卡片数据
 */
export interface CardFrontmatter {
  id: string
  laneId: string
  title: string
  description?: string
  position: number
  createdAt: string
  updatedAt: string
  tags?: Tag[]
}

/**
 * Markdown 文档结构
 */
export interface MarkdownDocument {
  frontmatter: BoardFrontmatter
  body?: string
}

/**
 * 存储错误基类
 */
export abstract class StorageError extends Error {
  public readonly filePath: string
  public readonly originalError?: Error

  constructor(message: string, filePath: string, originalError?: Error) {
    super(message)
    this.name = this.constructor.name
    this.filePath = filePath
    this.originalError = originalError
  }
}

/**
 * 读取错误
 */
export class StorageReadError extends StorageError {
  constructor(message: string, filePath: string, originalError?: Error) {
    super(message, filePath, originalError)
    this.name = 'StorageReadError'
  }
}

/**
 * 写入错误
 */
export class StorageWriteError extends StorageError {
  constructor(message: string, filePath: string, originalError?: Error) {
    super(message, filePath, originalError)
    this.name = 'StorageWriteError'
  }
}

/**
 * 删除错误
 */
export class StorageDeleteError extends StorageError {
  constructor(message: string, filePath: string, originalError?: Error) {
    super(message, filePath, originalError)
    this.name = 'StorageDeleteError'
  }
}

/**
 * 锁获取错误
 */
export class LockAcquisitionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'LockAcquisitionError'
  }
}

/**
 * YAML 解析错误
 */
export class MarkdownParseError extends Error {
  constructor(message: string, public readonly filePath: string, originalError?: Error) {
    super(message)
    this.name = 'MarkdownParseError'
  }
}
