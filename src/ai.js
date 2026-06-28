import { GoogleGenAI } from '@google/genai';
import { toolDeclarations, executeToolCall } from './tools.js';

export class AIManager {
  constructor(apiKey, workspaceDir) {
    this.ai = new GoogleGenAI({ apiKey });
    this.workspaceDir = workspaceDir || process.cwd();
    this.modelName = 'gemini-2.5-pro';
    this.chat = null;
    this.initChat();
  }

  setModel(model) {
    this.modelName = model;
    this.initChat(); // Re-init chat session with new model
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

    let response = await this.chat.sendMessage(input);

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

      // Send tool outputs back to model to continue conversation
      response = await this.chat.sendMessage(toolResults);
    }

    return response.text || 'Ответ от AI получен (без текста).';
  }
}
