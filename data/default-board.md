---
id: default-board
title: 我的看板
createdAt: '2026-02-11T07:06:35.423Z'
updatedAt: '2026-02-12T09:37:24.024Z'
tags:
  - id: tag-0
    name: 紧急
    color: '#ef4444'
  - id: tag-1
    name: 功能
    color: '#3b82f6'
  - id: tag-2
    name: Bug
    color: '#f59e0b'
  - id: tag-3
    name: 优化
    color: '#10b981'
  - id: tag-4
    name: 文档
    color: '#8b5cf6'
  - id: tag-5
    name: 设计
    color: '#ec4899'
lanes:
  - id: lane-todo
    title: 待办
    position: 0
    createdAt: '2026-02-11T07:06:35.423Z'
    updatedAt: '2026-02-12T09:37:24.024Z'
    cards:
      - id: card-3
        laneId: lane-todo
        title: 开发中
        position: 2
        createdAt: '2026-02-11T07:06:35.423Z'
        updatedAt: '2026-02-11T08:29:55.944Z'
        description: 正在积极开发的功能
      - id: card-1770806962038
        laneId: lane-todo
        title: 搭建管理后台，支持商品上架与订单处理
        position: 10
        createdAt: '2026-02-11T10:49:22.038Z'
        updatedAt: '2026-02-11T10:49:22.038Z'
        description: |-
          1. 创建管理员后台登录与主界面。
          2. 开发商品管理模块，支持增删改查商品信息。
          3. 开发订单管理模块，支持查看订单列表与状态更新。
      - id: card-b1c77947-bb01-44bf-b5e4-274d9431c99a
        laneId: lane-todo
        title: 起号
        position: 8
        createdAt: '2026-02-12T06:33:32.063Z'
        updatedAt: '2026-02-12T06:33:32.063Z'
  - id: lane-inprogress
    title: 进行中
    position: 1
    createdAt: '2026-02-11T07:06:35.423Z'
    updatedAt: '2026-02-11T10:02:24.429Z'
    cards:
      - id: card-1770799321983
        laneId: lane-inprogress
        title: gemini介绍
        position: 2
        createdAt: '2026-02-11T08:42:01.983Z'
        updatedAt: '2026-02-11T09:07:44.046Z'
        description: 你可以直接描述想做的事，或让我基于当前卡片生成新的卡片草稿。
      - id: card-1770802146058
        laneId: lane-inprogress
        title: '66'
        position: 3
        createdAt: '2026-02-11T09:29:06.058Z'
        updatedAt: '2026-02-11T09:29:06.058Z'
        description: '6666'
        tags:
          - id: tag-0
            name: 紧急
            color: '#ef4444'
          - id: tag-1
            name: 功能
            color: '#3b82f6'
          - id: tag-3
            name: 优化
            color: '#10b981'
          - id: tag-4
            name: 文档
            color: '#8b5cf6'
      - id: card-1770799150145
        laneId: lane-inprogress
        title: 撰写 DeepSeek 介绍文档
        position: 2
        createdAt: '2026-02-11T08:39:10.145Z'
        updatedAt: '2026-02-12T04:08:02.975Z'
        description: |-
          1. **核心定位**：说明 DeepSeek 是由深度求索公司开发的 AI 大语言模型助手。
          2. **关键特性**：
              *   免费使用，拥有 128K 上下文。
              *   支持文件上传（图像、txt、pdf、ppt、word、excel），可读取并处理其中的文字信息。
              *   支持联网搜索（需手动在 Web/App 中点开联网搜索按键）。
              *   纯文本模型，专注于文字处理与对话。
          3. **获取方式**：可通过官方应用商店下载 App 或直接在网页端使用。
          4. **服务声明**：提醒用户其知识截止于 2024年7月，并建议核对重要信息。
  - id: lane-done
    title: 已完成2
    position: 2
    createdAt: '2026-02-11T07:06:35.423Z'
    updatedAt: '2026-02-11T10:43:15.097Z'
    cards:
      - id: card-1770799202495
        laneId: lane-done
        title: 撰写 Google Gemini 介绍文档
        position: 0
        createdAt: '2026-02-11T08:40:02.495Z'
        updatedAt: '2026-02-11T15:33:16.026Z'
        description: >-
          1. **核心定位**：说明 Gemini 是 Google 开发的多模态 AI 模型系列。

          2. **模型系列**：介绍 Gemini Ultra、Pro、Nano 等不同版本及其定位。

          3. **关键特性**：
              *   原生多模态能力，能无缝理解和处理文本、代码、图像、音频、视频。
              *   深度集成于 Google 生态（如 Workspace、搜索）。
              *   支持代码生成、逻辑推理、创意协作等多种任务。
          4. **获取方式**：可通过 Gemini Advanced 订阅、Google AI Studio、Vertex AI 或部分功能集成在
          Bard/搜索中体验。

          5. **对比与定位**：简要说明其与 OpenAI GPT 系列等模型的区别和优势。
        tags:
          - id: tag-3
            name: 优化
            color: '#10b981'
          - id: tag-4
            name: 文档
            color: '#8b5cf6'
          - id: tag-5
            name: 设计
            color: '#ec4899'
      - id: card-1770799844291
        laneId: lane-done
        title: 重构 API 参数一致性
        position: 1
        createdAt: '2026-02-11T08:50:44.291Z'
        updatedAt: '2026-02-12T04:08:04.512Z'
        description: 检查并统一项目中各接口的请求/响应参数命名风格（如驼峰/下划线）、必填项规则和错误码格式，提升前后端协作效率。
  - id: lane-1770806867123
    title: 归档
    position: 3
    createdAt: '2026-02-11T10:47:47.123Z'
    updatedAt: '2026-02-11T10:47:47.123Z'
    cards:
      - id: card-2
        laneId: lane-1770806867123
        title: 拖放功能演示
        position: 0
        createdAt: '2026-02-11T07:06:35.423Z'
        updatedAt: '2026-02-11T15:33:03.586Z'
        description: 尝试拖动这个卡片
        tags:
          - id: tag-0
            name: 紧急
            color: '#ef4444'
      - id: card-1770801323725
        laneId: lane-1770806867123
        title: 开发点餐小程序
        position: 1
        createdAt: '2026-02-11T09:15:23.725Z'
        updatedAt: '2026-02-11T15:33:11.367Z'
        description: 启动点餐小程序的开发项目，需明确功能需求、技术选型和开发排期。
---

## 待办

### 开发中

正在积极开发的功能

### 搭建管理后台，支持商品上架与订单处理

1. 创建管理员后台登录与主界面。
2. 开发商品管理模块，支持增删改查商品信息。
3. 开发订单管理模块，支持查看订单列表与状态更新。

### 起号


## 进行中

### gemini介绍

你可以直接描述想做的事，或让我基于当前卡片生成新的卡片草稿。

### 66

6666

**标签**: 紧急、功能、优化、文档

### 撰写 DeepSeek 介绍文档

1. **核心定位**：说明 DeepSeek 是由深度求索公司开发的 AI 大语言模型助手。
2. **关键特性**：
    *   免费使用，拥有 128K 上下文。
    *   支持文件上传（图像、txt、pdf、ppt、word、excel），可读取并处理其中的文字信息。
    *   支持联网搜索（需手动在 Web/App 中点开联网搜索按键）。
    *   纯文本模型，专注于文字处理与对话。
3. **获取方式**：可通过官方应用商店下载 App 或直接在网页端使用。
4. **服务声明**：提醒用户其知识截止于 2024年7月，并建议核对重要信息。


## 已完成2

### 撰写 Google Gemini 介绍文档

1. **核心定位**：说明 Gemini 是 Google 开发的多模态 AI 模型系列。
2. **模型系列**：介绍 Gemini Ultra、Pro、Nano 等不同版本及其定位。
3. **关键特性**：
    *   原生多模态能力，能无缝理解和处理文本、代码、图像、音频、视频。
    *   深度集成于 Google 生态（如 Workspace、搜索）。
    *   支持代码生成、逻辑推理、创意协作等多种任务。
4. **获取方式**：可通过 Gemini Advanced 订阅、Google AI Studio、Vertex AI 或部分功能集成在 Bard/搜索中体验。
5. **对比与定位**：简要说明其与 OpenAI GPT 系列等模型的区别和优势。

**标签**: 优化、文档、设计

### 重构 API 参数一致性

检查并统一项目中各接口的请求/响应参数命名风格（如驼峰/下划线）、必填项规则和错误码格式，提升前后端协作效率。


## 归档

### 拖放功能演示

尝试拖动这个卡片

**标签**: 紧急

### 开发点餐小程序

启动点餐小程序的开发项目，需明确功能需求、技术选型和开发排期。
