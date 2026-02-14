# LoveLog

一个基于 Next.js App Router 的恋爱记录 MVP 应用，帮助你把日常情绪、快乐瞬间与聊天线索沉淀为可回顾、可导出的纪念内容。

## 功能简介

### 1) 心情记录与趋势图（Dashboard）
- 记录对象：我 / TA
- 支持日期、分数（1-5）、一句话备注
- 本地持久化（`localStorage`）
- 最近 10 条记录列表
- 最近 7 天双线趋势图（我 / TA）

### 2) 快乐一刻（Happy）
- 新增快乐记录：日期、标题、内容、照片（可选）
- 照片以 Data URL 形式本地存储
- 最近一个月日历视图打点
- 点击有记录日期可查看详情弹层
- 支持删除记录，包含 AI 明信片占位区域

### 3) 聊天恋爱数据库（Chat）
- 每日上传聊天文本（`.txt` 或粘贴）
- 规则提取并分类：
  - 算账本（冲突关键词+标点评分）
  - 礼物单（种草/购买相关关键词）
  - 高甜瞬间（甜蜜关键词）
- 总览统计 + 分类卡片浏览
- 支持删除提取项、复制原句
- AI 总结/分析按钮为占位

### 4) 纪念册导出（Export）
- 从本地 `moods/happy/chat` 生成纪念册初稿
- 支持范围、页数、尺寸、模板配置
- 页面级 DIY：编辑标题/正文、调序、删除、替换 moments 图片
- 保存草稿到本地
- 导出 JSON 草稿
- 使用打印模式导出 PDF（`window.print()`）
- AI 排版/插图接口为 Mock 占位

## 本地运行指南

### 1) 克隆仓库
```bash
git clone <your-repo-url>
cd lovelog
```

### 2) 安装依赖
```bash
npm install
```

### 3) 运行开发服务器
```bash
npm run dev
```

默认访问地址：
- `http://localhost:3000`
- 若 3000 端口被占用，Next.js 会自动切换到其他端口（如 3001）。

### 4) 页面访问说明
- Dashboard：`/dashboard`
- Happy：`/happy`
- Chat：`/chat`
- Export：`/export`
- Settings：`/settings`

## 项目结构（简要）

```text
src/
  app/
    dashboard/page.tsx      # 心情记录与趋势图
    happy/page.tsx          # 快乐一刻 + 日历 + 详情弹层
    chat/page.tsx           # 聊天导入与规则分类
    export/page.tsx         # 纪念册生成/DIY/导出
    settings/page.tsx       # 本地个人设置与 API Key
    api/ai/
      layout/route.ts       # AI 排版占位接口（Mock）
      postcard/route.ts     # AI 插图占位接口（Mock）
  components/
    top-nav.tsx             # 顶部导航
```

## MVP 说明

本项目目前是 MVP（最小可用版本）：
- 核心数据均保存在浏览器 `localStorage`
- AI 相关功能（排版、总结、插图）仅提供占位按钮和可扩展接口
- 未接入真实外部模型服务，便于后续逐步扩展

## 如何贡献

欢迎提交改进建议与代码贡献：

1. 提交 Issue：描述问题、场景与期望行为
2. Fork 并创建分支：`feature/xxx` 或 `fix/xxx`
3. 提交 PR：说明改动内容、测试方式与影响范围
4. 合并前请确保基础检查通过（如 `npm run lint`、`npx tsc --noEmit`）

## 许可证（可选）

当前仓库未单独声明许可证。若你计划开源发布，建议补充 `LICENSE` 文件（例如 MIT）。
