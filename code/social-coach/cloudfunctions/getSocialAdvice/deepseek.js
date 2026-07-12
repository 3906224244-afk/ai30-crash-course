/**
 * DeepSeek API 调用封装
 *
 * OpenAI 兼容格式:
 *   POST https://api.deepseek.com/chat/completions
 *   Authorization: Bearer <key>
 *
 * 三个 phase 用同一个接口，配不同的 system prompt
 */

const https = require('https');
const { DEEPSEEK_API_KEY } = require('./secret.js');

const API_URL = 'api.deepseek.com';
const MODEL = 'deepseek-chat'; // 2026-07-24 前使用，之后迁移到 deepseek-v4-pro

/**
 * 调用 DeepSeek Chat Completions
 *
 * @param {string} systemPrompt - 当前 phase 的 system prompt（角色说明书）
 * @param {string} userMessage  - 用户原话（或 +历史回答）
 * @param {object} opts         - { temperature, maxTokens, responseFormat }
 * @returns {Promise<string>}   - 模型返回的文本
 */
function chat(systemPrompt, userMessage, opts) {
  opts = opts || {};

  return new Promise(function (resolve, reject) {
    var body = JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage }
      ],
      temperature: opts.temperature || 0.7,
      max_tokens: opts.maxTokens || 2048,
      stream: false
    });

    var req = https.request({
      hostname: API_URL,
      path: '/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + DEEPSEEK_API_KEY,
        'Content-Length': Buffer.byteLength(body)
      },
      timeout: 15000
    }, function (res) {
      var data = '';
      res.on('data', function (chunk) { data += chunk; });
      res.on('end', function () {
        try {
          var json = JSON.parse(data);
          if (json.error) {
            reject(new Error('DeepSeek API error: ' + JSON.stringify(json.error)));
            return;
          }
          var content = json.choices && json.choices[0] && json.choices[0].message
            ? json.choices[0].message.content
            : '';
          resolve(content.trim());
        } catch (e) {
          reject(new Error('Failed to parse DeepSeek response: ' + data.substring(0, 200)));
        }
      });
    });

    req.on('error', function (e) { reject(e); });
    req.on('timeout', function () { req.destroy(); reject(new Error('DeepSeek API timeout')); });
    req.write(body);
    req.end();
  });
}

module.exports = { chat, MODEL };
