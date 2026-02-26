/**
 * undo 命令
 *
 * 撤销修复，恢复原始代码
 */

import chalk from 'chalk';
import { detect } from '../core/detector.js';
import { BackupManager } from '../core/backup.js';
import { restartService, checkServiceStatus } from '../utils/service.js';
import { createLogger } from '../utils/logger.js';
import { FixerError } from '../types/index.js';

const log = createLogger('undo');

/**
 * 撤销命令选项
 */
export interface UndoOptions {
  /** 是否重启服务 */
  restart?: boolean;
  /** 是否删除备份文件 */
  deleteBackup?: boolean;
}

/**
 * 执行撤销命令
 *
 * @param options 选项
 * @returns 退出码（0=成功，1=失败，2=错误）
 */
export async function runUndo(options: UndoOptions = {}): Promise<number> {
  const { restart = true, deleteBackup = false } = options;

  console.log();
  console.log(chalk.cyan('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
  console.log(chalk.cyan('  OpenClaw 飞书图片发送修复撤销'));
  console.log(chalk.cyan('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
  console.log();

  const startTime = Date.now();
  const steps = restart ? 4 : 3;
  let currentStep = 0;

  try {
    // 步骤1: 检测当前状态
    currentStep++;
    log.step(currentStep, steps, '检测当前状态...');
    const checkResult = await detect();

    if (!checkResult.openclawPath) {
      console.log();
      console.log(chalk.red('  ✗ 未找到 OpenClaw 安装路径'));
      console.log(chalk.gray('  请确认 OpenClaw 已正确安装'));
      console.log();
      return 1;
    }

    if (!checkResult.targetFile) {
      console.log();
      console.log(chalk.red('  ✗ 未找到目标文件'));
      console.log();
      return 1;
    }

    log.info(`目标文件: ${checkResult.targetFile}`);

    // 步骤2: 查找备份文件
    currentStep++;
    log.step(currentStep, steps, '查找备份文件...');
    const backupManager = new BackupManager();
    const backups = await backupManager.list(checkResult.targetFile);

    if (backups.length === 0) {
      console.log();
      console.log(chalk.red('  ✗ 未找到备份文件'));
      console.log(chalk.gray('  无法撤销修复，因为没有可用的备份'));
      console.log();
      return 1;
    }

    // 使用最新的备份
    const latestBackup = backups[0];
    log.info(`找到备份: ${latestBackup.path}`);
    log.info(`备份时间: ${latestBackup.createdAt.toLocaleString()}`);
    log.info(`文件大小: ${latestBackup.size} 字节`);

    // 步骤3: 恢复备份
    currentStep++;
    log.step(currentStep, steps, '恢复备份...');
    try {
      await backupManager.restore(latestBackup.path, checkResult.targetFile);
      log.success('备份已恢复');
    } catch (error) {
      console.log();
      console.log(chalk.red('  ✗ 恢复备份失败'));
      console.log(chalk.gray(`  错误: ${error instanceof Error ? error.message : String(error)}`));
      console.log();
      return 1;
    }

    // 可选：删除备份文件
    if (deleteBackup) {
      try {
        await backupManager.delete(latestBackup.path);
        log.info('备份文件已删除');
      } catch (error) {
        log.warn(`删除备份文件失败: ${error}`);
      }
    }

    // 步骤4: 重启服务（如果需要）
    if (restart) {
      currentStep++;
      log.step(currentStep, steps, '重启服务...');

      const serviceStatus = checkServiceStatus();
      if (serviceStatus.isActive !== undefined) {
        log.info('正在重启 OpenClaw Gateway 服务...');
        const restartSuccess = await restartService();

        if (!restartSuccess) {
          console.log();
          console.log(chalk.yellow('  ⚠ 服务重启失败'));
          console.log(chalk.gray('  请手动执行: systemctl --user restart openclaw-gateway.service'));
        }
      } else {
        log.warn('未检测到 OpenClaw Gateway 服务，跳过重启');
      }
    }

    // 显示完成信息
    const elapsed = Date.now() - startTime;
    console.log();
    console.log(chalk.green('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
    console.log(chalk.green.bold('  ✓ 撤销完成！'));
    console.log(chalk.green('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
    console.log();
    console.log(chalk.bold('  撤销摘要:'));
    console.log(`    ${chalk.gray('•')} 目标文件: ${chalk.cyan(checkResult.targetFile)}`);
    console.log(`    ${chalk.gray('•')} 恢复来源: ${chalk.cyan(latestBackup.path)}`);
    console.log(`    ${chalk.gray('•')} 执行时间: ${chalk.cyan(`${elapsed}ms`)}`);
    if (!deleteBackup && backups.length > 1) {
      console.log(`    ${chalk.gray('•')} 剩余备份: ${chalk.cyan(`${backups.length - 1} 个`)}`);
    }
    console.log();
    console.log(chalk.gray('  如需重新修复，请运行: openclaw-feishu-fixer fix'));
    console.log();

    return 0;
  } catch (error) {
    console.log();
    console.log(chalk.red.bold('  撤销过程中发生错误:'));
    console.log(`    ${chalk.red('✗')} ${error instanceof Error ? error.message : String(error)}`);
    console.log();
    return 2;
  }
}

export default runUndo;
