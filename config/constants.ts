/**
 * 应用常量配置
 */

export const APP_CONFIG = {
  // 默认看板 ID
  DEFAULT_BOARD_ID: 'default-board',

  // 默认列表标题
  DEFAULT_LANE_TITLES: ['待办', '进行中', '已完成'],

  // 卡片位置增量（用于拖放排序）
  POSITION_INCREMENT: 1000,
} as const

export const DRAG_CONFIG = {
  // 拖放激活约束（防止误触）
  ACTIVATION_DISTANCE: 8,

  // 拖放动画时长
  ANIMATION_DURATION: 200,

  // 是否限制在水平方向（列表拖放）
  RESTRICT_TO_HORIZONTAL_AXIS: true,

  // 是否限制在垂直方向（卡片拖放）
  RESTRICT_TO_VERTICAL_AXIS: false,
} as const

export const API_CONFIG = {
  // 重新验证路径
  REVALIDATE_PATH: '/',

  // 默认分页大小
  DEFAULT_PAGE_SIZE: 20,
} as const
