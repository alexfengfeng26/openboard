-- Kanban Pixel Icons for Aseprite
-- 16x16 pixel icon set + label preview
-- Style: soft kanban UI / 2px outline / pastel colors

local spr = Sprite(512, 320)
spr.filename = "kanban_pixel_icons.aseprite"

app.command.BackgroundFromLayer()
local cel = app.activeCel
local img = cel.image

--------------------------------------------------
-- Palette
--------------------------------------------------

local C = {
  bg        = Color{ r=248, g=245, b=239, a=255 },
  ink       = Color{ r=45,  g=42,  b=38,  a=255 },
  gray      = Color{ r=130, g=124, b=116, a=255 },
  line      = Color{ r=204, g=194, b=180, a=255 },

  orange    = Color{ r=211, g=104, b=61,  a=255 },
  orange2   = Color{ r=245, g=178, b=132, a=255 },

  yellow    = Color{ r=246, g=184, b=48,  a=255 },
  yellow2   = Color{ r=255, g=230, b=150, a=255 },

  blue      = Color{ r=61,  g=121, b=205, a=255 },
  blue2     = Color{ r=214, g=229, b=252, a=255 },

  green     = Color{ r=82,  g=160, b=91,  a=255 },
  green2    = Color{ r=221, g=243, b=222, a=255 },

  red       = Color{ r=219, g=76,  b=76,  a=255 },
  red2      = Color{ r=255, g=221, b=221, a=255 },

  purple    = Color{ r=119, g=92,  b=178, a=255 },
  purple2   = Color{ r=235, g=226, b=255, a=255 },

  teal      = Color{ r=52,  g=139, b=136, a=255 },
  teal2     = Color{ r=220, g=246, b=244, a=255 },
}

--------------------------------------------------
-- Helpers
--------------------------------------------------

local function px(x, y, color)
  img:drawPixel(x, y, color)
end

local function rect(x, y, w, h, color)
  for yy = y, y + h - 1 do
    for xx = x, x + w - 1 do
      px(xx, yy, color)
    end
  end
end

local function outlineRect(x, y, w, h, color)
  rect(x, y, w, 1, color)
  rect(x, y + h - 1, w, 1, color)
  rect(x, y, 1, h, color)
  rect(x + w - 1, y, 1, h, color)
end

local function roundedTag(x, y, w, h, stroke, fill)
  rect(x + 2, y, w - 4, h, fill)
  rect(x, y + 2, w, h - 4, fill)

  px(x + 1, y + 1, stroke)
  px(x + w - 2, y + 1, stroke)
  px(x + 1, y + h - 2, stroke)
  px(x + w - 2, y + h - 2, stroke)

  rect(x + 2, y, w - 4, 1, stroke)
  rect(x + 2, y + h - 1, w - 4, 1, stroke)
  rect(x, y + 2, 1, h - 4, stroke)
  rect(x + w - 1, y + 2, 1, h - 4, stroke)
end

local function clearBg()
  rect(0, 0, spr.width, spr.height, C.bg)
end

local function labelText(text, x, y, color)
  app.useTool{
    tool="pencil",
    color=color,
    brush=Brush(1),
    points={ Point(x, y) }
  }
  local oldFg = app.fgColor
  app.fgColor = color
  app.activeImage:drawText(text, x, y, color)
  app.fgColor = oldFg
end

--------------------------------------------------
-- Icon drawing functions: all 16x16
--------------------------------------------------

local function iconStar(x, y, main, fill)
  px(x+7,y+1,main)
  px(x+6,y+2,main) px(x+7,y+2,fill) px(x+8,y+2,main)
  rect(x+6,y+3,3,1,fill)
  rect(x+2,y+5,4,1,main) rect(x+9,y+5,5,1,main)
  rect(x+4,y+6,8,1,fill)
  rect(x+5,y+7,6,1,fill)
  rect(x+4,y+8,8,1,main)
  px(x+5,y+9,main) px(x+10,y+9,main)
  px(x+4,y+10,main) px(x+11,y+10,main)
  px(x+3,y+11,main) px(x+12,y+11,main)
end

local function iconBoard(x, y, main)
  outlineRect(x+3,y+3,4,4,main)
  outlineRect(x+9,y+3,4,4,main)
  outlineRect(x+3,y+9,4,4,main)
  outlineRect(x+9,y+9,4,4,main)
end

local function iconRobot(x, y, main, fill)
  rect(x+6,y+1,1,2,main)
  px(x+5,y+3,main) px(x+7,y+3,main)
  roundedTag(x+3,y+4,10,8,main,fill)
  px(x+6,y+7,main) px(x+10,y+7,main)
  rect(x+6,y+10,5,1,main)
  px(x+2,y+7,main)
  px(x+13,y+7,main)
end

local function iconPlus(x, y, main)
  outlineRect(x+3,y+3,10,10,main)
  rect(x+7,y+5,2,6,main)
  rect(x+5,y+7,6,2,main)
end

local function iconGear(x, y, main)
  rect(x+7,y+2,2,2,main)
  rect(x+7,y+12,2,2,main)
  rect(x+2,y+7,2,2,main)
  rect(x+12,y+7,2,2,main)
  rect(x+5,y+4,6,1,main)
  rect(x+5,y+11,6,1,main)
  rect(x+4,y+5,1,6,main)
  rect(x+11,y+5,1,6,main)
  outlineRect(x+6,y+6,4,4,main)
end

local function iconSearch(x, y, main)
  outlineRect(x+3,y+3,7,7,main)
  px(x+10,y+10,main)
  px(x+11,y+11,main)
  px(x+12,y+12,main)
end

local function iconCheckBox(x, y, main, accent)
  outlineRect(x+3,y+3,10,10,main)
  px(x+5,y+8,accent)
  px(x+6,y+9,accent)
  px(x+7,y+8,accent)
  px(x+8,y+7,accent)
  px(x+9,y+6,accent)
  px(x+10,y+5,accent)
end

local function iconAutomation(x, y, main)
  outlineRect(x+2,y+2,4,4,main)
  outlineRect(x+10,y+10,4,4,main)
  rect(x+6,y+4,3,1,main)
  rect(x+8,y+4,1,5,main)
  rect(x+8,y+8,3,1,main)
end

local function iconAIBox(x, y, main)
  outlineRect(x+3,y+3,10,10,main)
  rect(x+5,y+5,1,6,main)
  rect(x+10,y+5,1,6,main)
  px(x+6,y+5,main) px(x+7,y+5,main) px(x+8,y+5,main)
  px(x+6,y+8,main) px(x+7,y+8,main) px(x+8,y+8,main)
end

local function iconKeyboard(x, y, main)
  outlineRect(x+2,y+4,12,8,main)
  for i=0,2 do
    px(x+4+i*3,y+6,main)
    px(x+4+i*3,y+9,main)
  end
  rect(x+7,y+9,4,1,main)
end

local function iconBulb(x, y, main, fill)
  rect(x+6,y+2,4,1,main)
  px(x+5,y+3,main) px(x+10,y+3,main)
  px(x+4,y+4,main) px(x+11,y+4,main)
  px(x+4,y+5,fill) px(x+11,y+5,fill)
  px(x+5,y+7,main) px(x+10,y+7,main)
  rect(x+6,y+8,4,1,main)
  rect(x+6,y+10,4,2,main)
  rect(x+7,y+12,2,1,main)
end

local function iconList(x, y, main)
  for i=0,2 do
    outlineRect(x+3,y+3+i*4,2,2,main)
    rect(x+7,y+4+i*4,6,1,main)
  end
end

local function iconArchive(x, y, main)
  outlineRect(x+3,y+4,10,9,main)
  rect(x+4,y+3,8,2,main)
  outlineRect(x+6,y+6,4,3,main)
end

local function iconPriorityUp(x,y,main)
  px(x+7,y+3,main)
  px(x+6,y+4,main) px(x+8,y+4,main)
  px(x+5,y+5,main) px(x+9,y+5,main)
  rect(x+4,y+8,8,2,main)
  px(x+7,y+6,main)
  px(x+7,y+7,main)
end

local function iconPriorityMid(x,y,main)
  rect(x+4,y+5,8,2,main)
  rect(x+4,y+9,8,2,main)
end

local function iconPriorityDown(x,y,main)
  rect(x+4,y+5,8,2,main)
  px(x+7,y+8,main)
  px(x+7,y+9,main)
  px(x+5,y+10,main) px(x+9,y+10,main)
  px(x+6,y+11,main) px(x+8,y+11,main)
  px(x+7,y+12,main)
end

local function iconAlert(x,y,main,fill)
  roundedTag(x+4,y+2,8,12,main,fill)
  rect(x+7,y+5,2,5,main)
  rect(x+7,y+11,2,2,main)
end

local function iconCalendar(x,y,main,fill)
  roundedTag(x+3,y+3,10,10,main,fill)
  rect(x+5,y+1,1,3,main)
  rect(x+10,y+1,1,3,main)
  rect(x+4,y+6,8,1,main)
  px(x+6,y+8,main)
  px(x+9,y+8,main)
  px(x+6,y+10,main)
end

local function iconFolder(x,y,main,fill)
  rect(x+3,y+5,10,7,fill)
  rect(x+3,y+5,4,1,main)
  rect(x+7,y+6,6,1,main)
  rect(x+3,y+6,1,6,main)
  rect(x+12,y+7,1,5,main)
  rect(x+4,y+12,8,1,main)
end

local function iconTeam(x,y,main)
  outlineRect(x+6,y+3,4,4,main)
  outlineRect(x+2,y+6,3,3,main)
  outlineRect(x+11,y+6,3,3,main)
  rect(x+5,y+9,6,3,main)
  rect(x+1,y+11,4,2,main)
  rect(x+11,y+11,4,2,main)
end

local function iconDoc(x,y,main)
  outlineRect(x+4,y+2,8,12,main)
  px(x+10,y+3,main)
  px(x+11,y+4,main)
  rect(x+6,y+7,4,1,main)
  rect(x+6,y+10,4,1,main)
end

local function iconLink(x,y,main)
  outlineRect(x+2,y+7,6,4,main)
  outlineRect(x+8,y+5,6,4,main)
  rect(x+6,y+8,4,1,main)
end

local function iconEdit(x,y,main)
  px(x+11,y+2,main)
  px(x+10,y+3,main) px(x+12,y+3,main)
  px(x+9,y+4,main) px(x+11,y+4,main)
  px(x+8,y+5,main) px(x+10,y+5,main)
  px(x+7,y+6,main) px(x+9,y+6,main)
  px(x+6,y+7,main) px(x+8,y+7,main)
  rect(x+4,y+10,5,2,main)
  px(x+3,y+12,main)
end

local function iconTrash(x,y,main,fill)
  rect(x+5,y+3,6,1,main)
  rect(x+4,y+5,8,1,main)
  outlineRect(x+5,y+6,6,7,main)
  px(x+7,y+8,fill)
  px(x+9,y+8,fill)
end

local function iconPin(x,y,main)
  rect(x+6,y+2,5,2,main)
  px(x+8,y+4,main)
  px(x+8,y+5,main)
  rect(x+5,y+6,7,2,main)
  px(x+8,y+8,main)
  px(x+7,y+9,main)
  px(x+6,y+10,main)
  px(x+5,y+11,main)
end

local function iconBookmark(x,y,main,fill)
  rect(x+5,y+2,7,11,fill)
  outlineRect(x+5,y+2,7,11,main)
  px(x+7,y+11,main)
  px(x+8,y+10,main)
  px(x+9,y+11,main)
end

local function iconEye(x,y,main)
  rect(x+4,y+5,8,1,main)
  px(x+3,y+6,main) px(x+12,y+6,main)
  px(x+4,y+8,main) px(x+11,y+8,main)
  rect(x+5,y+9,6,1,main)
  outlineRect(x+7,y+6,3,3,main)
end

local function iconMore(x,y,main)
  rect(x+3,y+7,2,2,main)
  rect(x+7,y+7,2,2,main)
  rect(x+11,y+7,2,2,main)
end

local function iconLightning(x,y,main,fill)
  px(x+8,y+2,main)
  px(x+7,y+3,main)
  px(x+6,y+4,main)
  rect(x+5,y+5,5,1,main)
  px(x+8,y+6,fill)
  px(x+7,y+7,fill)
  rect(x+6,y+8,5,1,main)
  px(x+7,y+9,main)
  px(x+6,y+10,main)
  px(x+5,y+11,main)
end

local function iconTag(x,y,main,fill)
  rect(x+3,y+5,7,7,fill)
  rect(x+10,y+6,2,1,main)
  rect(x+11,y+7,1,2,main)
  rect(x+10,y+9,1,2,main)
  rect(x+4,y+4,6,1,main)
  rect(x+3,y+5,1,7,main)
  rect(x+4,y+12,6,1,main)
  px(x+7,y+7,main)
end

local function iconComment(x,y,main,fill)
  roundedTag(x+3,y+4,10,7,main,fill)
  px(x+6,y+11,main)
  px(x+7,y+12,main)
end

local function iconBell(x,y,main,fill)
  rect(x+7,y+2,2,1,main)
  px(x+5,y+5,main) px(x+10,y+5,main)
  rect(x+4,y+6,1,5,main)
  rect(x+11,y+6,1,5,main)
  rect(x+5,y+11,6,1,main)
  rect(x+7,y+12,2,1,main)
end

local function iconFilter(x,y,main)
  rect(x+3,y+3,10,1,main)
  px(x+4,y+4,main) px(x+11,y+4,main)
  px(x+5,y+5,main) px(x+10,y+5,main)
  px(x+6,y+6,main) px(x+9,y+6,main)
  rect(x+7,y+7,2,5,main)
end

local function iconRefresh(x,y,main)
  rect(x+5,y+3,5,1,main)
  px(x+10,y+4,main) px(x+11,y+5,main)
  px(x+12,y+6,main)
  px(x+11,y+7,main) px(x+10,y+7,main)
  rect(x+4,y+12,5,1,main)
  px(x+3,y+11,main) px(x+2,y+10,main)
  px(x+3,y+8,main) px(x+4,y+8,main)
end

--------------------------------------------------
-- Layout
--------------------------------------------------

clearBg()

local icons = {
  {"我的看板", iconStar, C.orange, C.yellow},
  {"收藏", iconStar, C.ink, C.yellow},
  {"看板列表", iconBoard, C.ink},
  {"AI助手", iconRobot, C.purple, C.purple2},
  {"创建看板", iconPlus, C.ink},
  {"设置", iconGear, C.ink},

  {"搜索", iconSearch, C.ink},
  {"选择", iconCheckBox, C.ink, C.green},
  {"自动化", iconAutomation, C.ink},
  {"AI", iconAIBox, C.ink},
  {"快捷键", iconKeyboard, C.ink},

  {"AI洞察", iconBulb, C.yellow, C.yellow2},
  {"待办", iconList, C.ink},
  {"进行中", iconList, C.blue},
  {"已完成", iconCheckBox, C.green, C.green},
  {"归档", iconArchive, C.gray},

  {"高优先级", iconPriorityUp, C.green},
  {"中优先级", iconPriorityMid, C.orange},
  {"低优先级", iconPriorityDown, C.green},
  {"阻塞", iconAlert, C.red, C.red2},
  {"优化", iconTag, C.purple, C.purple2},
  {"文档", iconDoc, C.blue},
  {"设计", iconTag, C.red, C.red2},
  {"紧急", iconAlert, C.red, C.red2},
  {"功能", iconAIBox, C.blue},

  {"日历", iconCalendar, C.red, C.bg},
  {"项目", iconFolder, C.teal, C.teal2},
  {"团队", iconTeam, C.blue},
  {"任务", iconList, C.ink},
  {"文档", iconDoc, C.ink},
  {"链接", iconLink, C.ink},

  {"编辑", iconEdit, C.ink},
  {"删除", iconTrash, C.red, C.red2},
  {"置顶", iconPin, C.red},
  {"标记", iconBookmark, C.purple, C.purple2},
  {"查看", iconEye, C.ink},
  {"更多", iconMore, C.ink},

  {"重构", iconRefresh, C.orange},
  {"API", iconLightning, C.yellow, C.yellow2},
  {"参数", iconGear, C.ink},
  {"标签", iconTag, C.ink, C.bg},
  {"评论", iconComment, C.green, C.green2},
  {"通知", iconBell, C.yellow, C.yellow2},
  {"筛选", iconFilter, C.ink},
  {"附件", iconLink, C.ink},
}

local startX = 24
local startY = 24
local gapX = 48
local gapY = 52
local col = 0
local row = 0

for i, item in ipairs(icons) do
  local x = startX + col * gapX
  local y = startY + row * gapY

  item[2](x, y, item[3], item[4])

  col = col + 1
  if col >= 9 then
    col = 0
    row = row + 1
  end
end

--------------------------------------------------
-- Tag Preview
--------------------------------------------------

local function tagPreview(x, y, text, stroke, fill, iconFunc, badge)
  roundedTag(x, y, 72, 22, stroke, fill)
  if iconFunc then
    iconFunc(x + 4, y + 3, stroke, fill)
  end

  if badge then
    roundedTag(x + 52, y + 4, 16, 14, stroke, stroke)
  end
end

tagPreview(24, 276, "待办", C.gray, C.bg, iconList)
tagPreview(112, 276, "进行中", C.blue, C.blue2, iconRefresh, true)
tagPreview(200, 276, "已完成", C.green, C.green2, iconCheckBox, true)
tagPreview(288, 276, "阻塞", C.red, C.red2, iconAlert, true)
tagPreview(376, 276, "AI助手", C.purple, C.purple2, iconRobot)

--------------------------------------------------
-- Save
--------------------------------------------------

app.refresh()
app.command.SaveFileAs{
  filename="kanban_pixel_icons.aseprite"
}