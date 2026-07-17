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
var MODEL = 'deepseek-v4-pro';      // 推理模型：Generate 策略生成
var FAST_MODEL = 'deepseek-chat';   // 标准模型：Ask 追问（快，不需要深度推理）

/**
 * 调用 DeepSeek Chat Completions（标准模式，无工具）
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
      model: opts.model || MODEL,
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
      timeout: 120000
    }, function (res) {
      res.setEncoding('utf8'); // 防止多字节字符被 chunk 边界切断产生乱码
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

/**
 * 调用 DeepSeek Chat Completions（工具调用模式）
 *
 * @param {Array} messages      - 消息数组 [{role, content}, ...]
 * @param {Array} tools         - 工具定义数组
 * @param {object} opts         - { temperature, maxTokens }
 * @returns {Promise<object>}   - { finishReason, content, toolCalls }
 */
function chatWithTools(messages, tools, opts) {
  opts = opts || {};

  return new Promise(function (resolve, reject) {
    var reqBody = {
      model: opts.model || MODEL,
      messages: messages,
      temperature: opts.temperature || 0.7,
      max_tokens: opts.maxTokens || 2048,
      stream: false
    };

    if (tools && tools.length > 0) {
      reqBody.tools = tools;
      reqBody.tool_choice = 'auto';
    }

    var body = JSON.stringify(reqBody);

    var req = https.request({
      hostname: API_URL,
      path: '/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + DEEPSEEK_API_KEY,
        'Content-Length': Buffer.byteLength(body)
      },
      timeout: 120000
    }, function (res) {
      res.setEncoding('utf8'); // 防止多字节字符被 chunk 边界切断产生乱码
      var data = '';
      res.on('data', function (chunk) { data += chunk; });
      res.on('end', function () {
        try {
          var json = JSON.parse(data);
          if (json.error) {
            reject(new Error('DeepSeek API error: ' + JSON.stringify(json.error)));
            return;
          }

          var choice = json.choices && json.choices[0];
          var message = choice ? choice.message : {};
          var finishReason = choice ? choice.finish_reason : 'stop';

          resolve({
            finishReason: finishReason,
            content: message.content || '',
            toolCalls: message.tool_calls || []
          });
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

/**
 * 流式调用 DeepSeek Chat Completions
 *
 * @param {string} systemPrompt
 * @param {string} userMessage
 * @param {object} opts            - { temperature, maxTokens }
 * @param {function} onChunk       - 每收到一段内容就回调 onChunk(textChunk)
 * @returns {Promise<string>}     - 完整文本
 */
function chatStream(systemPrompt, userMessage, opts, onChunk) {
  opts = opts || {};
  onChunk = onChunk || function() {};

  return new Promise(function (resolve, reject) {
    var body = JSON.stringify({
      model: opts.model || MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage }
      ],
      temperature: opts.temperature || 0.7,
      max_tokens: opts.maxTokens || 2048,
      stream: true
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
      timeout: 120000
    }, function (res) {
      res.setEncoding('utf8'); // 防止多字节字符被 chunk 边界切断产生乱码
      var fullText = '';
      var buffer = '';

      res.on('data', function (chunk) {
        buffer += chunk.toString();

        // SSE 格式: "data: {...}\n\n"
        // 按完整消息分割（以 \n\n 为界）
        var messages = buffer.split('\n\n');
        // 最后一段可能不完整，留给下次
        buffer = messages.pop();

        for (var i = 0; i < messages.length; i++) {
          var msg = messages[i].trim();
          if (!msg) continue;

          var lines = msg.split('\n');
          for (var j = 0; j < lines.length; j++) {
            var line = lines[j].trim();
            if (!line.startsWith('data: ')) continue;

            var jsonStr = line.substring(6);
            if (jsonStr === '[DONE]') continue;

            try {
              var parsed = JSON.parse(jsonStr);
              var delta = parsed.choices && parsed.choices[0] && parsed.choices[0].delta;
              if (delta && delta.content) {
                fullText += delta.content;
                onChunk(delta.content);
              }
            } catch (e) { /* skip malformed */ }
          }
        }
      });

      res.on('end', function () {
        // 处理最后残留
        if (buffer.trim()) {
          var lines = buffer.trim().split('\n');
          for (var j = 0; j < lines.length; j++) {
            var line = lines[j].trim();
            if (!line.startsWith('data: ') || line.substring(6) === '[DONE]') continue;
            try {
              var parsed = JSON.parse(line.substring(6));
              var delta = parsed.choices && parsed.choices[0] && parsed.choices[0].delta;
              if (delta && delta.content) {
                fullText += delta.content;
                onChunk(delta.content);
              }
            } catch (e) { /* skip */ }
          }
        }
        resolve(fullText.trim());
      });
    });

    req.on('error', function (e) { reject(e); });
    req.on('timeout', function () { req.destroy(); reject(new Error('DeepSeek stream timeout')); });
    req.write(body);
    req.end();
  });
}

module.exports = { chat, chatWithTools, chatStream, MODEL, FAST_MODEL };
