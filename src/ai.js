import { GoogleGenAI } from '@google/genai';
import { toolDeclarations, executeToolCall } from './tools.js';

export class AIManager {
  constructor(apiKey, workspaceDir) {
    this.ai = new GoogleGenAI({ apiKey });
    this.workspaceDir = workspaceDir || process.cwd();
    this.modelName = 'gemini-2.5-flash'; // По умолчанию используем Flash для лимитов и быстрой работы
    this.chat = null;
    this.initChat();
  }

  setModel(model) {
    this.modelName = model;
    this.initChat();
  }

  initChat() {
    const systemInstruction = `Вы — мобильный AI-ассистент Антигравити, помогающий разработчику управлять его ПК и проектами с телефона.
У вас есть доступ к автономным инструментам:
- read_file: прочитать файл
- write_file: изменить или создать файл
- list_dir: посмотреть содержимое папки
- run_command: выполнить консольную команду PowerShell/Git/npm

Когда пользователь просит что-то сделать с кодом или проектом, используйте эти инструменты самостоятельно. Всегда отвечайте четко, структурированно и вежливо на русском языке.`;

    this.chat = this.ai.chats.create({
      model: this.modelName,
      config: {
        systemInstruction,
        tools: toolDeclarations
      }
    });
  }

  clearHistory() {
    this.initChat();
  }

  async processUserMessage(input, progressCallback) {
    if (!this.chat) this.initChat();

    try {
      let response = await this.chat.sendMessage({ message: input });

      // Loop for handling autonomous function calls (up to 5 iterations)
      let loops = 0;
      while (loops < 5) {
        const functionCalls = response.functionCalls;
        if (!functionCalls || functionCalls.length === 0) {
          break;
        }

        loops++;
        const toolResults = [];

        for (const call of functionCalls) {
          if (progressCallback) {
            await progressCallback(`🔧 *AI использует инструмент:* \`${call.name}\`...`);
          }

          const result = await executeToolCall(call.name, call.args, this.workspaceDir);
          toolResults.push({
            functionResponse: {
              name: call.name,
              response: result
            }
          });
        }

        response = await this.chat.sendMessage({ message: toolResults });
      }

      return response.text || 'Ответ от AI получен (без текста).';
    } catch (error) {
      if (error.message && (error.message.includes('429') || error.message.includes('RESOURCE_EXHAUSTED'))) {
        // Автоматический фоллбэк на gemini-2.5-flash если pro превысил лимит
        if (this.modelName !== 'gemini-2.5-flash') {
          if (progressCallback) await progressCallback('⚠️ *Превышен лимит Pro модели. Переключаюсь на Flash...*');
          this.setModel('gemini-2.5-flash');
          return await this.processUserMessage(input, progressCallback);
        }
        return '⏳ *Превышен лимит запросов Google Gemini.* Пожалуйста, подождите 30-60 секунд и повторите запрос.';
      }
      throw error;
    }
  }
}
