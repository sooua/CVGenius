@AGENTS.md

# CVGenius · Claude Code 项目指南

## 项目一句话
面向应届生的 AI 简历助手：把课程项目、毕业设计、校园经历，用职业语言说清楚。

## 技术栈快照
- Next.js 16 App Router · React 19 · TypeScript · Tailwind v4
- Supabase（auth + Postgres + storage）· Drizzle ORM
- Vercel AI SDK · DeepSeek 主模型 · Qwen 备用
- Stripe 起步（国际用户）· PayJS/微信/支付宝 通过抽象层后接
- Vercel 部署

## 当前阶段
Day-1 脚手架已完成：目录结构、design tokens、db schema、payment 抽象、AI 服务骨架。
尚未完成：数据库 migration 实际跑通、UI 完整的 6 个页面、路由守卫、PDF 导出。

## 架构约束（必须遵守）
1. **支付**：任何涉及钱的代码都走 `services/payment/` 的 `PaymentProvider` 接口。绝不在业务代码里直接 import Stripe。
2. **AI**：所有 AI 调用走 `services/ai/` 且必须用 `generateObject` + zod schema，不要自由文本。`pickModel("fast" | "quality")` 根据任务价值选模型。
3. **文案**：prompt、邮件模板、落地页正文全部放 `content/` 目录。代码里只引用 key，不硬编码中文长句。
4. **颜色**：所有 color 从 `app/globals.css` 的 CSS 变量取。任何 `text-gray-500` / `bg-slate-*` 都违反规范——必须用 Claude 风的温色 token（`olive-gray`、`warm-sand`、`parchment` 等）。
5. **字体**：衬线用 Noto Serif SC（标题），无衬线用 Noto Sans SC（正文）。Anthropic Serif 是设计语言，但实际用 Noto 作为代替。

## 设计系统 token 快查
- 主画布：`bg-parchment` (#f5f4ed)
- 卡片：`bg-ivory` (#faf9f5) 或 `bg-white`
- 主文本：`text-near-black` (#141413)
- 次文本：`text-olive-gray` (#5e5d59)
- 辅助文本：`text-stone-gray` (#87867f)
- 品牌 CTA：`bg-terracotta text-ivory` (#c96442 + #faf9f5)
- 次级按钮：`bg-warm-sand text-charcoal-warm` (#e8e6dc + #4d4c48)
- 暗色块：`bg-deep-dark` / `bg-dark-surface` (#141413 / #30302e)
- 边框：`ring-border-warm` / `border-border-cream`
- 圆角：按钮 8-12px、卡片 16-24px、大容器 30-40px

## 开发命令
```
pnpm dev            # localhost:3000
pnpm typecheck      # 每次 commit 前必跑
pnpm db:push        # 开发期快速同步 schema
pnpm db:studio      # 可视化看数据
```

## 环境变量
所有校验在 `lib/env.ts`。新加的变量：
1. 先在 `.env.example` 加一行
2. 在 `lib/env.ts` 的 zod schema 加字段
3. 部署前在 Vercel dashboard 补齐

## 协作者
Ryuuzaki1412 和朋友共同开发。远程仓库：https://github.com/sooua/CVGenius
