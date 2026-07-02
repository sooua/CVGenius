# CVGenius · 札记

> 面向应届生与职场新人的 AI 简历助手——把课程项目、毕业设计、校园经历，用职业语言说清楚。

## 技术栈

- **框架**：Next.js 16 · React 19 · TypeScript
- **样式**：Tailwind CSS v4（CSS-first 配置，Claude 风 design tokens 在 `app/globals.css`）
- **字体**：Noto Serif SC（衬线标题）+ Noto Sans SC（正文）
- **数据库**：Supabase Postgres · Drizzle ORM
- **AI**：Vercel AI SDK · DeepSeek 主模型 · Qwen 备用
- **支付**：Stripe 起步，PayJS/微信/支付宝 通过 `services/payment` 的 provider 抽象后接入
- **部署**：Vercel

## 本地启动

```bash
pnpm install
cp .env.example .env.local   # 填入真实 key
pnpm dev
```

打开 http://localhost:3000 。

## 目录结构

```
app/                     # Next.js App Router
  (marketing)/           # 落地页、法律页、博客
  (app)/                 # 登录后的产品界面
  api/                   # route handlers
components/
  ui/                    # 低层组件（按钮、输入框）
  landing/               # 落地页专用
  app/                   # 产品界面专用
content/                 # 文案 / prompt 模板 / 邮件 MDX
  prompts/rewrite/       # 按岗位拆分的改写 prompt
  prompts/checkup/       # 体检 prompt
db/
  schema/                # Drizzle 表定义
  migrations/            # drizzle-kit generate 输出
lib/
  supabase/              # 服务端 / 客户端 client
  env.ts                 # zod 校验的环境变量
  cn.ts                  # Tailwind 类名合并
services/
  ai/                    # provider-agnostic AI 层
  payment/               # Stripe / PayJS 抽象层
  pdf/                   # （待建）HTML → PDF 导出
styles/
public/
  fonts/                 # 自托管的中文字体（待加）
```

## 常用脚本

```bash
pnpm dev            # 本地开发
pnpm build          # 生产构建
pnpm typecheck      # tsc --noEmit
pnpm lint           # eslint
pnpm db:generate    # 生成 SQL migration
pnpm db:migrate     # 执行 migration
pnpm db:push        # 开发期直接 push schema（跳过 migration）
pnpm db:studio      # Drizzle Studio 可视化
```

## 设计系统

Claude 启发的温润编辑风，所有 color token 在 `app/globals.css` 的 `:root` 中定义：

- 主画布：`#f5f4ed`（parchment，温暖米白）
- 品牌强调：`#c96442`（terracotta，唯一彩色）
- 主文本：`#141413`（near-black 带橄榄色暖调）
- 所有中性灰都是**暖色调**——任何冷蓝灰都是违反规范

## 核心设计决策

1. **支付抽象层先行**：`services/payment/types.ts` 定义接口，Stripe 只是第一个实现。接入 PayJS / 微信 / 支付宝时业务代码不改一行。
2. **AI provider-agnostic**：`services/ai/provider.ts` 按任务 tier（`fast` / `quality`）选模型；换 LLM 只改一处。
3. **Schema-first AI 输出**：所有 AI 调用都用 `generateObject` + zod schema，业务代码永远拿到类型化数据。
4. **文案分离**：所有 prompt / 邮件 / 文案在 `content/`，不散在代码里——文字即产品，文案迭代不会卷到代码 diff 里。

## 贡献

这是 Ryuuzaki1412 和协作者共同维护的项目。合并前请：

- `pnpm typecheck` 通过
- `pnpm lint` 通过
- 新加的 AI prompt 放 `content/prompts/`，不硬编码到代码里
- 新加的支付方式实现 `services/payment/types.ts` 里的 `PaymentProvider` 接口

## 许可

私有项目 · 未定。
