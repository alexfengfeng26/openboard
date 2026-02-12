import { dbHelpers } from '@/lib/db'
import { BoardClientNoSSR } from '@/components/board/BoardClientNoSSR'

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ boardId?: string }>
}) {
  const { boardId } = await searchParams

  // 获取所有看板列表
  const boards = await dbHelpers.getBoards()

  // 确定要显示的看板
  let targetBoardId = boardId
  if (!targetBoardId) {
    // 如果没有指定 boardId，使用第一个看板
    targetBoardId = boards.length > 0 ? boards[0].id : 'default-board'
  }

  // 获取目标看板的完整数据
  const board = await dbHelpers.getBoard(targetBoardId)

  if (!board) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-semibold">看板不存在</h1>
          <p className="text-muted-foreground">请选择其他看板或创建新看板</p>
        </div>
      </div>
    )
  }

  return <BoardClientNoSSR initialBoard={board} initialBoards={boards} />
}
