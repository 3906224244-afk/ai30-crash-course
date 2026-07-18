/**
 * getSocialAdvice 原子接口 — 微信 AI 包装层
 *
 * 调用云函数 getSocialAdvice，将返回数据翻译为微信 AI 规范格式。
 * card.type 决定渲染哪个原子组件：
 *   question        → question-card
 *   strategy_list   → strategy-list-card
 *   split           → 文本卡片（无组件）
 */

async function getSocialAdvice({ situation, answers, phase, profile }) {
  try {
    // 子包独立上下文，需初始化云环境（init 可重复调用）
    wx.cloud.init({ env: 'cloud1-d0g6rvd87c8980c04' });
    var res = await wx.cloud.callFunction({
      name: 'getSocialAdvice',
      data: {
        situation: situation || '',
        answers: answers || [],
        phase: phase || 'auto',
        profile: profile || {}
      }
    });

    var result = res.result;
    if (!result || result.error) {
      return {
        isError: true,
        content: [{ type: 'text', text: '服务暂时不可用，请稍后重试。' }]
      };
    }

    var card = result.card || {};
    var cardType = card.type || 'text';

    // 根据 card 类型选择原子组件
    var componentPath;
    if (cardType === 'question') {
      componentPath = '/components/question-card/index';
    } else if (cardType === 'strategy_list') {
      componentPath = '/components/strategy-list-card/index';
    }

    // 构建 content：给 LLM 看的上下文（关键：引导模型多轮累积调用）
    var contentText = '';
    if (cardType === 'question') {
      contentText = '【下一步操作】用户回答此题后，你必须再次调用 getSocialAdvice。';
      contentText += '调用时 answers 参数要在上一轮的基础上追加本轮的新 Q&A 对。当前第' + (card.questionIndex || 1) + '题/共' + (card.totalQuestions || 5) + '题。';
      if (card.isLast) contentText += ' 这是最后一题，答完将进入策略生成。';
    } else if (cardType === 'strategy_list') {
      contentText = '【已完成】信息齐全，为用户展示以下策略结果。无需再调用工具。';
    }
    contentText += '\n\n' + (result.action || '');

    return {
      isError: false,
      content: [{ type: 'text', text: contentText }],
      structuredContent: card,
      _meta: componentPath ? {
        ui: { componentPath: componentPath }
      } : {}
    };

  } catch (e) {
    console.error('getSocialAdvice 调用失败:', e);
    return {
      isError: true,
      content: [{ type: 'text', text: '调用失败: ' + ((e && e.errMsg) || (e && e.message) || '未知错误') }]
    };
  }
}

module.exports = getSocialAdvice;
