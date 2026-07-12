# 人情世故顾问 (Social Coach)

微信AI小程序 · 社交场景辅助

## 产品定位

20-30岁年轻人的社交沟通助手。用户通过微信AI描述社交场景，AI结合用户人设和知识库，给出5条不同策略路径的回复方案。

## 核心机制

利用微信AI的SKILL调用机制实现**调用型获客**——用户对微信AI说话时，系统通过mcp.json的description匹配到本SKILL，用户无需搜索或打开小程序。

## MVP功能

1. **分流页**：急需答案 / 提前录入
2. **追问轮**：LLM分析信息缺口 → 2-3道选择题（ABC+D）+ 最后一题自由补充
3. **5条策略生成**：正向回应型、委婉防守型、反问转移型、幽默破局型、直球表态型
4. **前置录入**：4题建人设档案（1-2分钟）
5. **知识库浏览**：8个高频场景的结构化知识

## 项目结构

```
social-coach/
├── app.json / app.js / app.wxss    # 全局配置
├── mcp.json                         # ★获客核心：决定AI是否匹配
├── SKILL.md                         # 业务流程说明
├── pages/
│   ├── index/      # 分流页
│   ├── advice/     # 核心咨询流程
│   ├── profile/    # 前置录入
│   └── etiquette/  # 知识库浏览
├── utils/
│   ├── api.js      # API桥接（MVP用本地模拟）
│   └── knowledge.js # 知识库种子数据
├── cloudfunctions/  # 云函数目录（待开发）
└── images/          # 图标
```

## 下一步

- [ ] 接入微信AI SKILL运行时（等官方代码提审开放）
- [ ] 接入RAG向量检索替代静态知识库
- [ ] 案例自动沉淀 → 知识库飞轮
- [ ] 用户人设云数据库同步
- [ ] 知识加工Agent（面向运营者的内容处理工具）

## 关键文档

- 微信AI接入指南：https://developers.weixin.qq.com/miniprogram/dev/ai/guide.html
- 微信AI SKILL协议：参考官方Demo仓库
