import fs from 'fs/promises';
import path from 'path';
import { executeCommand } from './executor.js';

export const toolDeclarations = [
  {
    functionDeclarations: [
      {
        name: 'read_file',
        description: 'Прочитать текстовое содержимое файла в проекте.',
        parameters: {
          type: 'OBJECT',
          properties: {
            filePath: { type: 'STRING', description: 'Относительный или абсолютный путь к файлу' }
          },
          required: ['filePath']
        }
      },
      {
        name: 'write_file',
        description: 'Записать или создать файл с новым содержимым.',
        parameters: {
          type: 'OBJECT',
          properties: {
            filePath: { type: 'STRING', description: 'Путь к создаваемому/изменяемому файлу' },
            content: { type: 'STRING', description: 'Полный текст для записи в файл' }
          },
          required: ['filePath', 'content']
        }
      },
      {
        name: 'list_dir',
        description: 'Показать список файлов и папок в указанной директории.',
        parameters: {
          type: 'OBJECT',
          properties: {
            dirPath: { type: 'STRING', description: 'Относительный путь (по умолчанию ".")' }
          }
        }
      },
      {
        name: 'run_command',
        description: 'Выполнить терминальную команду (PowerShell/Git/npm/и т.д.) в рабочей директории.',
        parameters: {
          type: 'OBJECT',
          properties: {
            command: { type: 'STRING', description: 'Команда для выполнения' }
          },
          required: ['command']
        }
      }
    ]
  }
];

export async function executeToolCall(name, args, workspaceDir) {
  try {
    if (name === 'read_file') {
      const targetPath = path.isAbsolute(args.filePath) ? args.filePath : path.join(workspaceDir, args.filePath);
      const content = await fs.readFile(targetPath, 'utf-8');
      return { status: 'success', content };
    }

    if (name === 'write_file') {
      const targetPath = path.isAbsolute(args.filePath) ? args.filePath : path.join(workspaceDir, args.filePath);
      await fs.mkdir(path.dirname(targetPath), { recursive: true });
      await fs.writeFile(targetPath, args.content, 'utf-8');
      return { status: 'success', message: `Файл ${args.filePath} успешно сохранен.` };
    }

    if (name === 'list_dir') {
      const relPath = args.dirPath || '.';
      const targetPath = path.isAbsolute(relPath) ? relPath : path.join(workspaceDir, relPath);
      const files = await fs.readdir(targetPath, { withFileTypes: true });
      const list = files.map(f => `${f.isDirectory() ? '[DIR]' : '[FILE]'} ${f.name}`);
      return { status: 'success', path: relPath, items: list };
    }

    if (name === 'run_command') {
      const output = await executeCommand(args.command, workspaceDir);
      return { status: 'success', output };
    }

    return { status: 'error', message: `Неизвестный инструмент: ${name}` };
  } catch (err) {
    return { status: 'error', message: err.message };
  }
}
