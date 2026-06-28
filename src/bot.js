import { Bot, InputFile } from 'grammy';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs/promises';
import http from 'http';
import si from 'systeminformation';
import { AIManager } from './ai.js';
import { executeCommand, splitMessage } from './executor.js';

dotenv.config();

const token = process.env.BOT_TOKEN;
const allowedUserId = process.env.ALLOWED_USER_ID ? Number(process.env.ALLOWED_USER_ID) : null;
const workspaceDir = process.env.WORKSPACE_DIR || process.cwd();

if (!token) {
  console.error('❌ Ошибка: Не задан BOT_TOKEN в .env файле!');
  process.exit(1);
}

const bot = new Bot(token);
const aiManager = new AIManager(process.env.GEMINI_API_KEY, workspaceDir);

// 🌐 HTTP Health Check Server (для облачных хостингов Render/Koyeb/Railway)
const port = process.env.PORT || 3000;
http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('🤖 Antigravity Telegram Bot is active and running!\n');
}).listen(port, () => {
  console.log(`🌐 HTTP Health Check сервер запущен на порту ${port}`);
});

// 🔒 Security Middleware: whitelist check
bot.use(async (ctx, next) => {
  if (allowedUserId && ctx.from?.id !== allowedUserId) {
    console.log(`⛔ Отклонен запрос от неавторизованного пользователя ID: ${ctx.from?.id} (${ctx.from?.username})`);
    await ctx.reply(`⛔ *Доступ запрещен.*\nВаш Telegram ID (\`${ctx.from?.id}\`) не находится в списке разрешенных.`, { parse_mode: 'Markdown' });
    return;
  }
  await next();
});

// 🚀 Start command
bot.command('start', async (ctx) => {
  const welcome = `🤖 *Добро пожаловать в Мобильный Антигравити!*

Я ваш личный AI-ассистент и терминал управления в облаке/ПК.

*Быстрые команды:*
🔹 Общение в чате — Запросы к AI, написание и анализ кода.
🔹 \`/cmd <команда>\` — Выполнение команд в консоли.
🔹 \`/ls [папка]\` — Посмотреть файлы в рабочей директории.
🔹 \`/cat <файл>\` — Прочитать содержимое файла.
🔹 \`/status\` — Мониторинг ресурсов (CPU, RAM, Диск).
🔹 \`/model\` — Переключение Gemini Pro / Flash.
🔹 \`/clear\` — Сбросить контекст диалога с AI.
🔹 Отправка фото или голосовых сообщений — Мультимодальный анализ.`;

  await ctx.reply(welcome, { parse_mode: 'Markdown' });
});

// ❓ Help command
bot.command('help', async (ctx) => {
  await ctx.reply(`📖 *Справка по командам:*

• \`/cmd <command>\` — Запустить команду в консоли.
• \`/ls <path>\` — Показать файлы в папке.
• \`/cat <filepath>\` — Прочитать файл.
• \`/get <filepath>\` — Скачать файл из среды на телефон.
• \`/status\` — Узнать загрузку процессора и память.
• \`/model [flash|pro]\` — Сменить AI модель.
• \`/clear\` — Очистить память ассистента.

Также вы можете отправлять мне любые файлы, документы, картинки или голосовые сообщения!`, { parse_mode: 'Markdown' });
});

// ⚙️ Status command (system monitoring)
bot.command('status', async (ctx) => {
  try {
    const msg = await ctx.reply('🔄 Сбор метрик системы...');
    const mem = await si.mem();
    const cpu = await si.currentLoad();
    const fsSize = await si.fsSize();
    const osInfo = await si.osInfo();

    const freeRamGb = (mem.free / (1024 ** 3)).toFixed(2);
    const totalRamGb = (mem.total / (1024 ** 3)).toFixed(2);
    const cpuLoad = cpu.currentLoad.toFixed(1);

    let diskStr = '';
    if (fsSize && fsSize.length > 0) {
      const mainDisk = fsSize[0];
      const usedGb = (mainDisk.used / (1024 ** 3)).toFixed(1);
      const sizeGb = (mainDisk.size / (1024 ** 3)).toFixed(1);
      diskStr = `💾 *Диск (${mainDisk.mount}):* ${usedGb} GB / ${sizeGb} GB (${mainDisk.use.toFixed(1)}%)`;
    }

    const report = `📊 *Мониторинг сервера (${osInfo.hostname})*

💻 *ОС:* ${osInfo.distro} ${osInfo.arch}
⚡ *Загрузка CPU:* ${cpuLoad}%
🧠 *ОЗУ:* Свободно ${freeRamGb} GB из ${totalRamGb} GB
${diskStr}
📂 *Рабочая папка:* \`${workspaceDir}\`
🤖 *Текущая модель AI:* \`${aiManager.modelName}\``;

    await ctx.api.editMessageText(ctx.chat.id, msg.message_id, report, { parse_mode: 'Markdown' });
  } catch (err) {
    await ctx.reply(`❌ Ошибка сбора метрик: ${err.message}`);
  }
});

// 🔄 Switch Model command
bot.command('model', async (ctx) => {
  const arg = ctx.match.trim().toLowerCase();
  if (arg === 'flash') {
    aiManager.setModel('gemini-2.5-flash');
    await ctx.reply('⚡ Модель переключена на *Gemini 2.5 Flash* (быстрые ответы).', { parse_mode: 'Markdown' });
  } else if (arg === 'pro') {
    aiManager.setModel('gemini-2.5-pro');
    await ctx.reply('🧠 Модель переключена на *Gemini 2.5 Pro* (максимальная точность).', { parse_mode: 'Markdown' });
  } else {
    await ctx.reply(`Текущая модель: \`${aiManager.modelName}\`\n\nЧтобы сменить, используйте:\n\`/model flash\` или \`/model pro\``, { parse_mode: 'Markdown' });
  }
});

// 🧹 Clear history
bot.command('clear', async (ctx) => {
  aiManager.clearHistory();
  await ctx.reply('🧹 Контекст диалога с AI успешно очищен.');
});

// 💻 Shell command execution
bot.command('cmd', async (ctx) => {
  const command = ctx.match.trim();
  if (!command) {
    await ctx.reply('⚠️ Укажите команду после `/cmd`, например: `/cmd ls -la`', { parse_mode: 'Markdown' });
    return;
  }

  const statusMsg = await ctx.reply(`⚙️ *Выполняю:* \`${command}\`...`, { parse_mode: 'Markdown' });
  const output = await executeCommand(command, workspaceDir);

  const chunks = splitMessage(output);
  await ctx.api.deleteMessage(ctx.chat.id, statusMsg.message_id);

  for (const chunk of chunks) {
    await ctx.reply(`\`\`\`\n${chunk}\n\`\`\``, { parse_mode: 'Markdown' });
  }
});

// 📂 List directory
bot.command('ls', async (ctx) => {
  const relPath = ctx.match.trim() || '.';
  const targetPath = path.isAbsolute(relPath) ? relPath : path.join(workspaceDir, relPath);

  try {
    const files = await fs.readdir(targetPath, { withFileTypes: true });
    if (files.length === 0) {
      await ctx.reply(`📂 Директория \`${relPath}\` пуста.`, { parse_mode: 'Markdown' });
      return;
    }

    const items = files.map(f => `${f.isDirectory() ? '📁' : '📄'} \`${f.name}\``).join('\n');
    await ctx.reply(`📂 *Содержимое (${relPath}):*\n\n${items}`, { parse_mode: 'Markdown' });
  } catch (err) {
    await ctx.reply(`❌ Ошибка чтения папки: ${err.message}`);
  }
});

// 📄 Read file
bot.command('cat', async (ctx) => {
  const filePath = ctx.match.trim();
  if (!filePath) {
    await ctx.reply('⚠️ Укажите путь к файлу: `/cat package.json`', { parse_mode: 'Markdown' });
    return;
  }

  const targetPath = path.isAbsolute(filePath) ? filePath : path.join(workspaceDir, filePath);
  try {
    const content = await fs.readFile(targetPath, 'utf-8');
    const chunks = splitMessage(content);
    for (const chunk of chunks) {
      await ctx.reply(`\`\`\`\n${chunk}\n\`\`\``, { parse_mode: 'Markdown' });
    }
  } catch (err) {
    await ctx.reply(`❌ Ошибка чтения файла: ${err.message}`);
  }
});

// 📥 Send file to Telegram
bot.command('get', async (ctx) => {
  const filePath = ctx.match.trim();
  if (!filePath) {
    await ctx.reply('⚠️ Укажите путь к файлу: `/get package.json`', { parse_mode: 'Markdown' });
    return;
  }

  const targetPath = path.isAbsolute(filePath) ? filePath : path.join(workspaceDir, filePath);
  try {
    await ctx.replyWithDocument(new InputFile(targetPath));
  } catch (err) {
    await ctx.reply(`❌ Не удалось отправить файл: ${err.message}`);
  }
});

// 📤 Receive document/file from phone to workspace
bot.on('message:document', async (ctx) => {
  try {
    const doc = ctx.message.document;
    const file = await ctx.getFile();
    const savePath = path.join(workspaceDir, doc.file_name || 'uploaded_file');

    const statusMsg = await ctx.reply(`📥 Сохраняю файл \`${doc.file_name}\`...`, { parse_mode: 'Markdown' });

    const res = await fetch(`https://api.telegram.org/file/bot${token}/${file.file_path}`);
    const buffer = Buffer.from(await res.arrayBuffer());
    await fs.writeFile(savePath, buffer);

    await ctx.api.editMessageText(ctx.chat.id, statusMsg.message_id, `✅ Файл сохранен в рабочую папку:\n\`${savePath}\``, { parse_mode: 'Markdown' });
  } catch (err) {
    await ctx.reply(`❌ Ошибка сохранения файла: ${err.message}`);
  }
});

// 📷 Photos / Screenshots analysis
bot.on('message:photo', async (ctx) => {
  try {
    const photo = ctx.message.photo[ctx.message.photo.length - 1];
    const file = await ctx.getFile();
    const caption = ctx.message.caption || 'Проанализируй это изображение или скриншот.';

    const statusMsg = await ctx.reply('🔍 *Анализирую изображение...*', { parse_mode: 'Markdown' });

    const res = await fetch(`https://api.telegram.org/file/bot${token}/${file.file_path}`);
    const buffer = Buffer.from(await res.arrayBuffer());
    const base64Data = buffer.toString('base64');

    const parts = [
      { inlineData: { mimeType: 'image/jpeg', data: base64Data } },
      caption
    ];

    const answer = await aiManager.processUserMessage(parts, async (progress) => {
      try {
        await ctx.api.editMessageText(ctx.chat.id, statusMsg.message_id, progress, { parse_mode: 'Markdown' });
      } catch (e) {}
    });

    try {
      await ctx.api.deleteMessage(ctx.chat.id, statusMsg.message_id);
    } catch (e) {}

    const chunks = splitMessage(answer);
    for (const chunk of chunks) {
      await ctx.reply(chunk);
    }
  } catch (err) {
    await ctx.reply(`❌ Ошибка обработки фото: ${err.message}`);
  }
});

// 🎤 Voice messages handling
bot.on('message:voice', async (ctx) => {
  try {
    const voice = ctx.message.voice;
    const file = await ctx.getFile();

    const statusMsg = await ctx.reply('🎙️ *Слушаю голосовое сообщение...*', { parse_mode: 'Markdown' });

    const res = await fetch(`https://api.telegram.org/file/bot${token}/${file.file_path}`);
    const buffer = Buffer.from(await res.arrayBuffer());
    const base64Data = buffer.toString('base64');

    const parts = [
      { inlineData: { mimeType: voice.mime_type || 'audio/ogg', data: base64Data } },
      'Распознай аудио и выполни команду пользователя или ответь на его вопрос.'
    ];

    const answer = await aiManager.processUserMessage(parts, async (progress) => {
      try {
        await ctx.api.editMessageText(ctx.chat.id, statusMsg.message_id, progress, { parse_mode: 'Markdown' });
      } catch (e) {}
    });

    try {
      await ctx.api.deleteMessage(ctx.chat.id, statusMsg.message_id);
    } catch (e) {}

    const chunks = splitMessage(answer);
    for (const chunk of chunks) {
      await ctx.reply(chunk);
    }
  } catch (err) {
    await ctx.reply(`❌ Ошибка обработки голоса: ${err.message}`);
  }
});

// 💬 Main Text handler (AI coding assistant chat)
bot.on('message:text', async (ctx) => {
  const text = ctx.message.text;
  if (text.startsWith('/')) return;

  try {
    const statusMsg = await ctx.reply('🤔 *Думаю...*', { parse_mode: 'Markdown' });

    const answer = await aiManager.processUserMessage(text, async (progress) => {
      try {
        await ctx.api.editMessageText(ctx.chat.id, statusMsg.message_id, progress, { parse_mode: 'Markdown' });
      } catch (e) {}
    });

    try {
      await ctx.api.deleteMessage(ctx.chat.id, statusMsg.message_id);
    } catch (e) {}

    const chunks = splitMessage(answer);
    for (const chunk of chunks) {
      await ctx.reply(chunk);
    }
  } catch (err) {
    await ctx.reply(`❌ Ошибка AI: ${err.message}`);
  }
});

// 🟢 Launch bot
bot.start({
  onStart: (botInfo) => {
    console.log(`==================================================`);
    console.log(`🤖 Telegram Bot "${botInfo.username}" успешно запущен!`);
    console.log(`🌐 HTTP сервер работает на порту ${port}`);
    console.log(`🔒 Разрешенный Telegram ID: ${allowedUserId || 'Все'}`);
    console.log(`==================================================`);
  }
});
