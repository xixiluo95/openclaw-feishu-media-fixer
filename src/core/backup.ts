/**
 * 备份管理器
 *
 * 负责文件的备份和恢复操作
 */

import { copyFileSync, existsSync, statSync, readdirSync, unlinkSync, mkdirSync } from 'fs';
import { join, basename, dirname } from 'path';
import type { BackupInfo } from '../types/index.js';
import { FixerError, FixerException } from '../types/index.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('backup');

/** 默认备份目录 */
const DEFAULT_BACKUP_DIR = join(process.env.HOME || '', '.openclaw-feishu-fixer', 'backups');

/**
 * 备份管理器类
 */
export class BackupManager {
  private backupDir: string;

  constructor(backupDir?: string) {
    this.backupDir = backupDir || DEFAULT_BACKUP_DIR;
    this.ensureBackupDir();
  }

  /**
   * 确保备份目录存在
   */
  private ensureBackupDir(): void {
    if (!existsSync(this.backupDir)) {
      mkdirSync(this.backupDir, { recursive: true });
      log.debug(`创建备份目录: ${this.backupDir}`);
    }
  }

  /**
   * 创建备份
   *
   * @param filePath 要备份的文件路径
   * @returns 备份文件路径
   */
  async create(filePath: string): Promise<string> {
    if (!existsSync(filePath)) {
      throw new FixerException(
        FixerError.FILE_NOT_FOUND,
        `文件不存在: ${filePath}`
      );
    }

    // 生成备份文件名（带时间戳）
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = basename(filePath);
    const backupFileName = `${fileName}.backup-${timestamp}`;
    const backupPath = join(this.backupDir, backupFileName);

    // 复制文件
    try {
      copyFileSync(filePath, backupPath);
      log.success(`备份已创建: ${backupPath}`);
      return backupPath;
    } catch (error) {
      throw new FixerException(
        FixerError.PERMISSION_DENIED,
        `无法创建备份: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * 恢复备份
   *
   * @param backupPath 备份文件路径
   * @param targetPath 目标文件路径
   */
  async restore(backupPath: string, targetPath: string): Promise<void> {
    if (!existsSync(backupPath)) {
      throw new FixerException(
        FixerError.BACKUP_NOT_FOUND,
        `备份文件不存在: ${backupPath}`
      );
    }

    try {
      copyFileSync(backupPath, targetPath);
      log.success(`备份已恢复: ${targetPath}`);
    } catch (error) {
      throw new FixerException(
        FixerError.PERMISSION_DENIED,
        `无法恢复备份: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * 列出所有备份
   *
   * @param originalFile 可选，筛选特定原始文件的备份
   * @returns 备份信息列表
   */
  async list(originalFile?: string): Promise<BackupInfo[]> {
    if (!existsSync(this.backupDir)) {
      return [];
    }

    const files = readdirSync(this.backupDir);
    const backups: BackupInfo[] = [];

    for (const file of files) {
      // 筛选备份文件
      if (!file.includes('.backup-')) {
        continue;
      }

      // 如果指定了原始文件，只返回该文件的备份
      const originalName = file.split('.backup-')[0];
      if (originalFile && originalName !== basename(originalFile)) {
        continue;
      }

      const backupPath = join(this.backupDir, file);
      try {
        const stats = statSync(backupPath);

        // 从文件名解析时间戳
        const timestampMatch = file.match(/\.backup-(.+)$/);
        let createdAt = stats.birthtime;
        if (timestampMatch) {
          const timestampStr = timestampMatch[1].replace(/-/g, ':').replace(/-/g, '.');
          const parsed = new Date(timestampStr);
          if (!isNaN(parsed.getTime())) {
            createdAt = parsed;
          }
        }

        backups.push({
          path: backupPath,
          originalPath: originalFile || join(dirname(originalFile || ''), originalName),
          createdAt,
          size: stats.size,
        });
      } catch {
        // 跳过无法读取的文件
        continue;
      }
    }

    // 按创建时间倒序排列（最新的在前）
    backups.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    return backups;
  }

  /**
   * 获取最新的备份
   *
   * @param originalFile 原始文件路径
   * @returns 最新的备份信息，如果没有则返回 null
   */
  async getLatestBackup(originalFile: string): Promise<BackupInfo | null> {
    const backups = await this.list(originalFile);
    return backups.length > 0 ? backups[0] : null;
  }

  /**
   * 删除备份
   *
   * @param backupPath 备份文件路径
   */
  async delete(backupPath: string): Promise<void> {
    if (!existsSync(backupPath)) {
      log.warn(`备份文件不存在，无需删除: ${backupPath}`);
      return;
    }

    try {
      unlinkSync(backupPath);
      log.success(`备份已删除: ${backupPath}`);
    } catch (error) {
      throw new FixerException(
        FixerError.PERMISSION_DENIED,
        `无法删除备份: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * 清理旧备份
   *
   * @param maxAge 最大保留天数
   * @param originalFile 可选，只清理特定文件的备份
   * @returns 删除的备份数量
   */
  async cleanup(maxAge: number, originalFile?: string): Promise<number> {
    const backups = await this.list(originalFile);
    const now = new Date();
    const maxAgeMs = maxAge * 24 * 60 * 60 * 1000;
    let deletedCount = 0;

    for (const backup of backups) {
      const age = now.getTime() - backup.createdAt.getTime();
      if (age > maxAgeMs) {
        await this.delete(backup.path);
        deletedCount++;
      }
    }

    if (deletedCount > 0) {
      log.info(`已清理 ${deletedCount} 个旧备份`);
    }

    return deletedCount;
  }

  /**
   * 获取备份目录路径
   */
  getBackupDir(): string {
    return this.backupDir;
  }
}

/** 默认备份管理器实例 */
export const backupManager = new BackupManager();
