import type { ResumeContent } from "@/lib/resume/schema";

/**
 * Editorial example used for the dashboard "从示例开始" flow.
 * Content is deliberately generic + realistic so users feel comfortable
 * editing it rather than deleting. Keep under ~1 A4 so the PDF preview
 * is a single page.
 */
export function exampleResumeContent(): ResumeContent {
  return {
    basicInfo: {
      name: "夏禾壮",
      headline: "前端工程师 · 应届",
      email: "hehuizhuang@example.com",
      phone: "+86 138 0000 0000",
      location: "上海",
      portfolioUrl: "https://huizhuang.dev",
      github: "https://github.com/huizhuang",
      linkedin: "",
    },
    targetRole: "前端工程师",
    summary:
      "计算机科学在读，关注前端性能与工程化。课程项目以 React 和 TypeScript 为主，喜欢把复杂状态拆成小组件。",
    experiences: [
      {
        id: "exp-edu-1",
        kind: "education",
        title: "上海交通大学 · 电子信息与电气工程学院",
        org: "",
        role: "",
        location: "上海",
        startDate: "2022.09",
        endDate: "2026.07",
        highlights: [
          "计算机科学与技术 · GPA 3.85 / 4.0 · 专业排名前 5%",
          "相关课程：数据结构、操作系统、计算机网络、分布式系统、软件工程",
        ],
      },
      {
        id: "exp-proj-1",
        kind: "project",
        title: "校园二手交易平台",
        org: "个人项目",
        role: "独立开发",
        location: "",
        startDate: "2024.03",
        endDate: "2024.09",
        highlights: [
          "独立设计并实现商品发布、搜索、聊天三大模块，支撑校内日活 800+ 用户",
          "用 Redis 缓存热门商品列表，P95 接口响应从 420ms 降到 85ms",
          "抽象出可复用的表单组件库，覆盖 12 个表单场景，团队后续复用 3 次",
        ],
      },
      {
        id: "exp-intern-1",
        kind: "internship",
        title: "某互联网公司 · 前端实习",
        org: "某互联网公司",
        role: "前端实习生",
        location: "上海",
        startDate: "2025.06",
        endDate: "2025.09",
        highlights: [
          "主导内部工单系统前端重构，把 5000 行旧代码迁到 React Query + Zustand",
          "推动首屏性能优化，LCP 从 3.2s 降到 1.4s，lighthouse 得分从 58 → 92",
          "梳理团队组件规范文档，被新同学 on-boarding 当做主要上手材料",
        ],
      },
    ],
    skills: [
      {
        id: "skill-lang",
        category: "编程语言",
        items: ["TypeScript", "JavaScript", "Python", "Go（在学）"],
      },
      {
        id: "skill-frontend",
        category: "前端",
        items: [
          "React",
          "Next.js",
          "Tailwind",
          "React Query",
          "Vite",
        ],
      },
      {
        id: "skill-tools",
        category: "工程",
        items: ["Git", "Docker", "CI/CD", "Vitest", "Playwright"],
      },
    ],
    awards: [
      {
        id: "award-1",
        title: "字节跳动青训营 · 全国前端赛道 前 50",
        date: "2024.11",
        issuer: "字节跳动",
      },
      {
        id: "award-2",
        title: "校级一等奖学金",
        date: "2024.09",
        issuer: "上海交通大学",
      },
    ],
    certifications: [
      {
        id: "cert-1",
        title: "CET-6 · 612",
        date: "2024.06",
        issuer: "",
      },
    ],
    languages: [
      { id: "lang-1", name: "中文", level: "母语" },
      { id: "lang-2", name: "英语", level: "CET-6 · 流利读写" },
    ],
  };
}
