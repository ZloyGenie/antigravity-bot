import { exec } from 'child_process';
import { promisify } from 'util';

const execPromise = promisify(exec);

/**
 * Execute shell command safely in the specified directory
 */
export async function executeCommand(command, cwd = process.cwd(), timeoutMs = 60000) {
  try {
    const { stdout, stderr } = await execPromise(command, {
      cwd,
      timeout: timeoutMs,
      shell: 'powershell.exe',
      maxBuffer: 1024 * 1024 * 10 // 10MB
    });

    let output = '';
    if (stdout && stdout.trim()) output += stdout.trim();
    if (stderr && stderr.trim()) output += (output ? '\n--- STDERR ---\n' : '') + stderr.trim();

    return output || 'Команда выполнена успешно (вывод пуст).';
  } catch (error) {
    let errOutput = '';
    if (error.stdout && error.stdout.trim()) errOutput += error.stdout.trim();
    if (error.stderr && error.stderr.trim()) errOutput += (errOutput ? '\n--- STDERR ---\n' : '') + error.stderr.trim();
    
    return `Ошибка выполнения (${error.code || 'FAIL'}):\n${errOutput || error.message}`;
  }
}

/**
 * Split long text into chunks that fit into Telegram message limits (4096 chars)
 */
export function splitMessage(text, maxLength = 3900) {
  if (!text) return ['(пусто)'];
  if (text.length <= maxLength) return [text];

  const chunks = [];
  let current = '';

  const lines = text.split('\n');
  for (const line of lines) {
    if ((current + '\n' + line).length > maxLength) {
      if (current) chunks.push(current);
      if (line.length > maxLength) {
        // Line itself is too long, slice it
        for (let i = 0; i < line.length; i += maxLength) {
          chunks.push(line.slice(i, i + maxLength));
        }
        current = '';
      } else {
        current = line;
      }
    } else {
      current = current ? current + '\n' + line : line;
    }
  }
  if (current) chunks.push(current);

  return chunks;
}
