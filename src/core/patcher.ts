/**
 * 补丁应用器
 *
 * 负责应用修复补丁到 OpenClaw 的 reply-dispatcher.js 文件
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import type { CheckResult, FixResult } from '../types/index.js';
import { FixerError, FixerException } from '../types/index.js';
import { createLogger } from '../utils/logger.js';
import { BackupManager } from './backup.js';

const log = createLogger('patcher');

/**
 * 需要添加的 import 语句
 */
const MEDIA_IMPORT = `import { sendMediaFeishu } from "./media.js";`;

/**
 * 媒体发送逻辑代码
 */
const MEDIA_LOGIC = `
  // 先发送媒体（图片/文件）- 由 openclaw-feishu-media-fixer 添加
  if (payload.mediaUrls?.length) {
    for (const mediaUrl of payload.mediaUrls) {
      try {
        await sendMediaFeishu({
          cfg,
          to: chatId,
          mediaUrl,
          replyToMessageId,
          accountId,
        });
        params.runtime.log?.(\`feishu[\${account.accountId}]: sent media: \${mediaUrl}\`);
      } catch (error) {
        params.runtime.error?.(
          \`feishu[\${account.accountId}]: failed to send media \${mediaUrl}: \${String(error)}\`,
        );
      }
    }
  }
`;

/**
 * 补丁应用器类
 */
export class Patcher {
  private backupManager: BackupManager;

  constructor(backupManager?: BackupManager) {
    this.backupManager = backupManager || new BackupManager();
  }

  /**
   * 应用补丁
   *
   * @param checkResult 检测结果
   * @param options 选项
   * @returns 修复结果
   */
  async apply(
    checkResult: CheckResult,
    options: { noBackup?: boolean } = {}
  ): Promise<FixResult> {
    log.info('开始应用修复补丁...');

    // 验证检测结果
    if (!checkResult.targetFile) {
      return {
        success: false,
        message: '未找到目标文件',
        errors: [{ code: FixerError.FILE_NOT_FOUND, message: '未找到目标文件' }],
      };
    }

    if (!checkResult.hasProblem) {
      return {
        success: false,
        message: '已经修复过了，无需重复修复',
        errors: [{ code: FixerError.ALREADY_FIXED, message: '已经修复过了' }],
      };
    }

    const targetFile = checkResult.targetFile;

    // 检查文件是否存在
    if (!existsSync(targetFile)) {
      return {
        success: false,
        message: `目标文件不存在: ${targetFile}`,
        errors: [{ code: FixerError.FILE_NOT_FOUND, message: `目标文件不存在: ${targetFile}` }],
      };
    }

    // 读取文件内容
    let content: string;
    try {
      content = readFileSync(targetFile, 'utf-8');
    } catch (error) {
      return {
        success: false,
        message: `无法读取文件: ${error instanceof Error ? error.message : String(error)}`,
        error: error instanceof Error ? error : new Error(String(error)),
        errors: [{ code: FixerError.PERMISSION_DENIED, message: `无法读取文件: ${error instanceof Error ? error.message : String(error)}` }],
      };
    }

    // 创建备份
    let backupPath: string | undefined;
    if (!options.noBackup) {
      try {
        backupPath = await this.backupManager.create(targetFile);
        log.info(`备份已创建: ${backupPath}`);
      } catch (error) {
        return {
          success: false,
          message: `备份失败: ${error instanceof Error ? error.message : String(error)}`,
          error: error instanceof Error ? error : new Error(String(error)),
          errors: [{ code: FixerError.PERMISSION_DENIED, message: `备份失败: ${error instanceof Error ? error.message : String(error)}` }],
        };
      }
    }

    // 应用补丁
    try {
      // 步骤1: 添加 import
      content = this.addImport(content);

      // 步骤2: 添加媒体发送逻辑
      content = this.addMediaLogic(content);

      // 步骤3: 验证补丁
      if (!this.verify(content)) {
        throw new FixerException(
          FixerError.PATCH_FAILED,
          '补丁验证失败，修复后的代码不包含预期的内容'
        );
      }

      // 步骤4: 写入文件
      writeFileSync(targetFile, content, 'utf-8');
      log.success('补丁已应用');

      return {
        success: true,
        message: '修复补丁应用成功',
        backupPath,
      };
    } catch (error) {
      // 如果补丁失败且有备份，恢复备份
      if (backupPath) {
        try {
          await this.backupManager.restore(backupPath, targetFile);
          log.info('已恢复备份');
        } catch (restoreError) {
          log.error(`恢复备份失败: ${restoreError}`);
        }
      }

      return {
        success: false,
        message: `应用补丁失败: ${error instanceof Error ? error.message : String(error)}`,
        error: error instanceof Error ? error : new Error(String(error)),
        errors: [{ code: FixerError.PATCH_FAILED, message: `应用补丁失败: ${error instanceof Error ? error.message : String(error)}` }],
        backupPath,
      };
    }
  }

  /**
   * 添加 import 语句
   */
  private addImport(content: string): string {
    // 检查是否已有 import
    if (content.includes('sendMediaFeishu') && content.includes('./media.js')) {
      log.debug('import 语句已存在，跳过');
      return content;
    }

    // 在 send.js 导入之后添加 media.js 导入
    const importAnchor = /import\s*\{[^}]*sendMarkdownCardFeishu[^}]*\}\s*from\s*['"]\.\/send\.js['"]/;

    if (importAnchor.test(content)) {
      // 在 send.js 导入后添加新行
      content = content.replace(
        importAnchor,
        (match) => `${match}\n${MEDIA_IMPORT}`
      );
      log.debug('已添加 media.js 导入');
    } else {
      // 如果找不到锚点，在文件开头的 import 区域末尾添加
      const lastImportIndex = content.lastIndexOf('import ');
      const nextNewlineIndex = content.indexOf('\n', lastImportIndex);

      if (nextNewlineIndex !== -1) {
        content =
          content.slice(0, nextNewlineIndex + 1) +
          MEDIA_IMPORT +
          '\n' +
          content.slice(nextNewlineIndex + 1);
        log.debug('已在 import 区域末尾添加 media.js 导入');
      } else {
        throw new FixerException(
          FixerError.PATCH_FAILED,
          '无法找到合适的位置添加 import 语句'
        );
      }
    }

    return content;
  }

  /**
   * 添加媒体发送逻辑
   */
  private addMediaLogic(content: string): string {
    // 检查是否已有媒体发送逻辑
    if (content.includes('payload.mediaUrls?.length')) {
      log.debug('媒体发送逻辑已存在，跳过');
      return content;
    }

    // 在 deliver 函数开头添加媒体发送逻辑
    // 寻找 deliver 函数定义后的第一个 await 或代码块开始
    const deliverAnchor = /deliver:\s*async\s*\(\s*payload\s*:\s*ReplyPayload/;

    if (deliverAnchor.test(content)) {
      // 找到函数参数结束后的位置
      // 匹配: deliver: async (payload: ReplyPayload, ...) => {
      const fullPattern = /deliver:\s*async\s*\([^)]*\)\s*(?::\s*[^=]+)?\s*=>\s*\{/;

      if (fullPattern.test(content)) {
        content = content.replace(fullPattern, (match) => {
          return match + MEDIA_LOGIC;
        });
        log.debug('已在 deliver 函数开头添加媒体发送逻辑');
      } else {
        throw new FixerException(
          FixerError.PATCH_FAILED,
          '无法解析 deliver 函数结构'
        );
      }
    } else {
      throw new FixerException(
        FixerError.PATCH_FAILED,
        '无法找到 deliver 函数定义'
      );
    }

    return content;
  }

  /**
   * 验证补丁是否正确应用
   */
  private verify(content: string): boolean {
    // 检查 import
    const hasImport = content.includes('sendMediaFeishu') && content.includes('./media.js');

    // 检查媒体发送逻辑
    const hasMediaLogic = content.includes('payload.mediaUrls?.length');

    // 检查 sendMediaFeishu 调用
    const hasSendCall = content.includes('await sendMediaFeishu');

    // 检查添加的注释标记
    const hasMarker = content.includes('openclaw-feishu-media-fixer');

    return hasImport && hasMediaLogic && hasSendCall && hasMarker;
  }
}

/** 默认补丁应用器实例 */
export const patcher = new Patcher();
