# 文献综述：知识增强对话系统 & AI社交建议质量评估

**目的**：为"人情世故顾问"知识加工Agent的搭建提供方法论基础  
**日期**：2026/07/13  
**范围**：三个方向——（1）知识增强对话系统架构（2）辅导型对话的Prompt设计模式（3）AI社交建议的人类评估框架

---

## 一、知识增强对话系统（Knowledge-Grounded Dialogue）

### 1.1 核心架构：知识增强型对话系统（KEDS）

**来源**：Priya et al., "Knowledge-Enhanced Response Generation in Dialogue Systems," LREC-COLING 2024  
**来源**：Caffaro & Rizzo, "Knowledge-Enhanced Conversational Agents," Journal of Computer Science and Technology, 2024

**关键区分**：

| 知识类型 | 说明 | 本项目对应 |
|---------|------|-----------|
| **内部知识** | 模型训练时内化的知识（隐含在参数中）| DeepSeek自带的社交推理能力 |
| **外部知识** | 运行时检索注入的知识 | 知识库的 condition→implication→tactical_note 规则 |

**架构组件**（可直接映射到本项目）：

```
用户输入
    ↓
意图识别（微信AI负责）
    ↓
知识检索接口（本项目待接入的 searchKnowledge）
    ├── 知识库（结构化规则）
    ├── 向量检索（MiniMax embo-01）
    └── 知识选择（top-N相关规则）
    ↓
知识注入Prompt（buildAskPromptWithRules / buildGeneratePromptWithRules）
    ↓
LLM生成（DeepSeek v4-pro）
    ↓
输出卡片
```

**对本项目的启示**：
- 学术界共识：外部知识检索 + 内部模型推理 = 最优方案。你们选的路是对的。
- 知识选择（retrieve top-N then select）比直接全量注入更重要——检索出3条高相关规则 >> 注入10条弱相关规则

### 1.2 对话中的"共同基础"（Common Ground）

**来源**：Anikina et al., "Building Common Ground in Dialogue: A Survey," LUHME Workshop 2025（覆盖448篇论文的系统性综述）

**核心概念**：多轮对话中，系统需要持续追踪"双方已经建立了什么共识"。这对Ask阶段的多轮追问有直接意义——每一轮追问时，Agent应该知道之前已经问过什么、用户回答了什么，不要重复追问。

**本项目的自然映射**：
- Ask阶段已实现：answers数组累计所有历史问答，每轮全量注入
- 待强化：知识库检索结果也应随轮次更新（第2轮追问可基于第1轮用户回答重新检索知识库）

### 1.3 RAG vs 知识图谱：趋势判断

**来源**：Elsevier Knowledge-Based Systems, 2025（LLM+知识集成的综合综述）

**关键发现**：
- RAG是2024-2025年知识增强对话的主导范式
- GraphRAG、KAG、ToG是前沿但偏重，不适合MVP
- **结构化文本检索（你们的方案）是投入产出比最高的路径**——知识以JSON规则存储、向量化、语义检索、注入prompt。不需要知识图谱的复杂度。

---

## 二、辅导型对话的Prompt设计模式

### 2.1 社交支持Prompt框架（SSP）

**来源**：arXiv 2509.06393（Social Support Prompting for mental health coaching chatbots）

**三种社交支持类型**（可直接用于你们的知识库分类和策略生成）：

| 支持类型 | 定义 | 本项目映射 |
|---------|------|-----------|
| **信息型支持（Informational）** | 提供建议、情境分析、教学 | Generate阶段的策略话术 + 风险预判 |
| **自尊型支持（Esteem）** | 肯定、验证、减轻自责 | 策略中的"让对方感觉被尊重"角度 |
| **情感型支持（Emotional）** | 共情、理解、鼓励 | 策略中温和语气、降低焦虑的话术 |

**Prompt结构设计启示**：
- 使用明确的分隔标记（如XML标签或Markdown标题）划分：`<对话历史>`、`<社交规则>`、`<输出格式>`
- 你们的prompt已经在这样做了（## 身份、## 任务、## 输出格式），方向正确

**关键实验结论**：
- 适度支持的prompt → 共情和建设性提升 ✅
- 过度验证/肯定 → 安全性和建议质量显著下降 ❌
- **启示**：Generate阶段不要给模型"过度共情"的倾向——策略要务实，不是让用户感觉良好但不解决问题

### 2.2 策略依从性评估：ESC-Judge框架

**来源**：基于 Clara Hill 的"探索-洞察-行动"（Exploration–Insight–Action, E-I-A）心理咨询三阶段模型

| 阶段 | 定义 | 本项目映射 |
|------|------|-----------|
| **Exploration（探索）** | 理解用户处境、收集信息 | Ask阶段：分析信息缺口，追问 |
| **Insight（洞察）** | 帮用户看清权力结构、博弈位置 | analysis字段：综合分析 |
| **Action（行动）** | 给出可执行的策略和话术 | Generate阶段：5条策略 |

**启示**：你们的 split→ask→generate 三阶段，与心理咨询的 E-I-A 模型高度吻合。这不是巧合——好的社交建议天然就是这三步。可以在prompt里显式引用这个框架，让模型更好理解自己在每个阶段的位置。

### 2.3 策略依从性度量（SRA Metric）

**来源**：ESConv数据集上的Strategy-Relevant Attention指标

**核心思路**：不评估策略好不好，而评估"生成的策略是否忠于检索到的规则"。即：

```
SRA = 生成的策略中有多少要素可直接追溯到知识库规则
```

**对本项目的直接应用**：这是知识加工Agent质量把关的核心指标。生成一条新规则后，检查它是否可追溯到原始素材。无法追溯的规则 = 模型自己编的，需要人工复核。

---

## 三、AI社交建议的人类评估框架

### 3.1 多维度评估体系

**来源**：Kumar et al., "When AI Gives Advice," arXiv 2512.08937（GPT-4o/GPT-5 vs Reddit人类建议的盲评对比）  
**来源**：Scientific Reports, 2025（5个实验、N=1,722，人vs AI建议评估）

**7个核心评估维度**（可直接用于知识加工Agent的质量判断）：

| 维度 | 定义 | 用于知识加工 |
|------|------|-------------|
| **Competence（专业度）** | 建议是否体现知识和合理推理？ | 规则是否基于有效的社交逻辑？ |
| **Warmth（温度）** | 语气是否支持性、有共情？ | 规则是否保持了"过来人"而非"专家"的语气？ |
| **Personalization（个性化）** | 是否针对具体情况？ | condition是否足够具体？还是泛泛而谈？ |
| **Sycophancy（谄媚度）** | 是否过度迎合用户？ | 规则是否回避了用户需要听到的"难听话"？ |
| **Clarity（清晰度）** | 是否易于理解？ | tactical_note是否可直接执行？ |
| **Long-term benefit（长期收益）** | 按建议做是否带来持久改善？ | 规则是解决表面问题还是根本问题？ |
| **Willingness to return（复用意愿意）** | 用户是否愿意再次使用？ | 整体体验的间接度量 |

### 3.2 算法厌恶效应（Algorithm Aversion）

**来源**：Scientific Reports, 2025

**关键发现**：
- **盲评时**：ChatGPT建议在质量、有效性、真实感上均**优于**人类建议
- **告知AI来源时**：同一批建议评分显著下降——人们知道是AI写的就扣分
- Claude和Gemini也复现了同样效果

**对本项目的启示**：
- 用户可能不会明确告诉朋友"这是AI帮我回的"——你们的产品设计（话术可直接复制）天然适配这个使用场景
- 不要在产品里过度强调"AI生成"——强调"策略参考"而非"AI替你回"

### 3.3 人-AI协作管道

**来源**：Kumar et al., 2025

四种协作模式：

| 模式 | 描述 | 本项目对应 |
|------|------|-----------|
| **AI Boost** | LLM独立优化建议 | Generate阶段直接输出（当前方案） |
| **AI Coached** | LLM + 专家审核修改 | 知识加工Agent的输出人工审核后入库 ✅ |
| **Human Boost** | 人类写 → LLM润色 | 种子数据你写 → Agent格式化 |
| **Human Coached** | 人类在LLM辅导下写 | 你写规则草稿 → Agent提示遗漏 |

**启示**：知识加工Agent的最佳模式是 **AI Coached**——Agent做提取和格式化，你做最终审核。全自动有滚雪球式错误风险，这一点之前的讨论是对的。

### 3.4 信任维度研究

**来源**：PMC Table 4, 2025（AI建议信任研究议程）

6个与你们产品直接相关的信任维度：

| 维度 | 产品考量 |
|------|---------|
| **独特性** | 用户是否觉得"只有AI能给我这种建议"？——这是护城河 |
| **社交成本** | 用AI建议丢不丢人？——你们的匿名+复制话术模式解决了这个问题 |
| **相似性** | 用户是否觉得AI"懂我的处境"？——人设档案和追问的深度决定这点 |
| **时间累积** | 多用几次后信任上升还是下降？——关系到留存 |
| **信心表达** | AI是否过度自信？——策略中的risk字段（风险提示）是关键平衡器 |

---

## 四、对知识加工Agent的直接指导

### 4.1 Agent质量判断的7维checklist

知识加工Agent读取一篇新文章后，对提取出的每条规则，用以下7个维度打分（1-5）：

```
□ Competence:   这条规则背后的逻辑是合理的吗？
□ Warmth:       语气是"过来人"还是"说教"？
□ Personalized: condition够具体吗？还是泛泛的"保持礼貌"？
□ Sycophancy:   规则有没有回避用户真正需要的难听话？
□ Clarity:      用户看完知道怎么做吗？
□ Long-term:    解决的是根本问题还是表面问题？
□ Traceable:    规则能否追溯到原文的具体段落？（SRA指标）
```

总分 ≥ 28（满分35）→ 自动入库。低于阈值 → 标记人工审核。

### 4.2 知识库的E-I-A分类

将知识库规则标注为三类：

| 类型 | 服务于 | 示例 |
|------|--------|------|
| **E-Rule**（探索型）| Ask阶段 | "导师有行政职务 → 需要追问权力结构" |
| **I-Rule**（洞察型）| analysis字段 | "副院长催论文 ≠ 普通催论文，本质是资源分配权博弈" |
| **A-Rule**（行动型）| Generate阶段 | "主动汇报进度 + 给具体时间节点" |

E-Rule 放入 Ask库，I-Rule 和 A-Rule 放入 Generate库——这是对现有双库架构的细化。

### 4.3 知识加工Agent的架构建议

```
输入: 一篇社交场景文章/案例
    ↓
Phase 1 - 质量筛选（Competence + Traceable）
    → 有实质性洞察？→ 继续
    → 水文？→ 跳过
    ↓
Phase 2 - 类型判定（E/I/A分类）
    → 教"问什么"的 → E-Rule → Ask库
    → 教"怎么想"的 → I-Rule → Generate库
    → 教"怎么做"的 → A-Rule → Generate库
    ↓
Phase 3 - 结构化提取
    → category / subcategory / condition / implication / tactical_note / avoid
    ↓
Phase 4 - 去重与冲突
    → 与已有规则对比
    → 重复 → 跳过
    → 冲突 → 标记人工（两个版本并排展示）
    → 补充 → 合并
    ↓
Phase 5 - 7维打分
    → ≥28分 → 候选入库
    → <28分 → 标记人工
    ↓
人工确认 → 写入知识库文件
```

---

## 五、参考文献（建议进一步精读）

1. Priya et al. (2024). "Knowledge-Enhanced Response Generation in Dialogue Systems: Current Advancements and Emerging Horizons." LREC-COLING 2024 Tutorial. — KEDS架构入门
2. Caffaro & Rizzo (2024). "Knowledge-Enhanced Conversational Agents." Journal of Computer Science and Technology, 39(3): 585–609. — 知识增强对话Agent的概念架构
3. Anikina et al. (2025). "Building Common Ground in Dialogue: A Survey." LUHME Workshop 2025. — 多轮对话中共同基础的建立
4. Kumar et al. (2025). "When AI Gives Advice." arXiv 2512.08937. — 7维评估 + 人-AI协作管道
5. Scientific Reports (2025). "Me vs. the Machine? Subjective Evaluations of Human- and AI-Generated Advice." — 算法厌恶效应
6. arXiv 2509.06393 — Social Support Prompting (SSP)框架
7. ESC-Judge (arXiv 2305.10195) — 基于E-I-A模型的策略依从性评估

---

## 六、一句话总结

学术界告诉我们三件事：
1. **结构化知识 + RAG + LLM** 是当前最优方案（你们的方向被验证了）
2. **7维评估框架**可以量化规则质量，不让烂规则混进知识库
3. **E-I-A三阶段**与你们的 split→ask→generate 高度吻合，可以作为prompt设计的理论基础
