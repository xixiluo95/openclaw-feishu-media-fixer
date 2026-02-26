/**
 * fix 命令
 *
 * 应用修复补丁来解决飞书图片发送问题
 */

import chalk from 'chalk';
import { detect } from '../core/detector.js';
import { BackupManager } from '../core/backup.js';
import { Patcher } from '../core/patcher.js';
import { restartService, checkServiceStatus } from '../utils/service.js';
import { createLogger } from '../utils/logger.js';
import { FixerError } from '../types/index.js';

const log = createLogger('fix');

/**
 * 修复命令选项
 */
export interface FixOptions {
  /** 是否重启服务 */
  restart?: boolean;
  /** 是否跳过备份 */
  noBackup?: boolean;
  /** 是否强制执行（即使已经修复） */
  force?: boolean;
}

/**
 * 执行修复命令
 *
 * @param options 选项
 * @returns 退出码（0=成功，1=失败，2=错误）
 */
export async function runFix(options: FixOptions = {}): Promise<number> {
  const { restart = true, noBackup = false, force = false } = options;

  console.log();
  console.log(chalk.cyan('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
  console.log(chalk.cyan('  OpenClaw 飞书图片发送问题修复'));
  console.log(chalk.cyan('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
  console.log();

  const startTime = Date.now();
  const steps = restart ? 5 : 4;
  let currentStep = 0;

  try {
    // 步骤1: 检测问题
    currentStep++;
    log.step(currentStep, steps, '检测问题...');
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
      console.log(chalk.gray('  请确认 OpenClaw 版本兼容（需要 2026.2.x 版本）'));
      console.log();
      return 1;
    }

    if (!checkResult.hasProblem && !force) {
      console.log();
      console.log(chalk.green('  ✓ 已经修复过了，无需重复修复'));
      console.log(chalk.gray('  使用 --force 选项强制重新修复'));
      console.log();
      return 0;
    }

    log.info(`OpenClaw 路径: ${checkResult.openclawPath}`);
    log.info(`目标文件: ${checkResult.targetFile}`);

    // 步骤2: 创建备份
    currentStep++;
    log.step(currentStep, steps, '创建备份...');
    const backupManager = new BackupManager();
    let backupPath: string | undefined;

    if (!noBackup) {
      try {
        backupPath = await backupManager.create(checkResult.targetFile);
        log.success(`备份已创建: ${backupPath}`);
      } catch (error) {
        console.log();
        console.log(chalk.red('  ✗ 创建备份失败'));
        console.log(chalk.gray(`  错误: ${error instanceof Error ? error.message : String(error)}`));
        console.log();
        return 1;
      }
    } else {
      log.warn('跳过备份创建（--no-backup 选项）');
    }

    // 步骤3: 应用补丁
    currentStep++;
    log.step(currentStep, steps, '应用修复补丁...');
    const patcher = new Patcher(backupManager);
    const fixResult = await patcher.apply(checkResult, { noBackup });

    if (!fixResult.success) {
      console.log();
      console.log(chalk.red('  ✗ 修复失败'));
      console.log(chalk.gray(`  错误: ${fixResult.message}`));

      // 如果有备份，尝试恢复
      if (backupPath) {
        log.info('正在恢复备份...');
        try {
          await backupManager.restore(backupPath, checkResult.targetFile);
          log.success('备份已恢复');
        } catch (restoreError) {
          log.error(`恢复备份失败: ${restoreError}`);
        }
      }

      console.log();
      return 1;
    }

    log.success('补丁已应用');

    // 步骤4: 验证修复
    currentStep++;
    log.step(currentStep, steps, '验证修复...');
    const verifyResult = await detect();

    if (verifyResult.hasProblem) {
      console.log();
      console.log(chalk.yellow('  ⚠ 修复应用成功，但验证检测仍有问题'));
      console.log(chalk.gray('  请手动检查目标文件'));

      // 显示问题详情
      if (verifyResult.issues && verifyResult.issues.length > 0) {
        for (const issue of verifyResult.issues) {
          console.log(chalk.gray(`    • ${issue.message}`));
        }
      }
    } else {
      log.success('修复验证成功');
    }

    // 步骤5: 重启服务（如果需要）
    if (restart) {
      currentStep++;
      log.step(currentStep, steps, '重启服务...');

      // 检查服务是否存在
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
    console.log(chalk.green.bold('  ✓ 修复完成！'));
    console.log(chalk.green('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
    console.log();
    console.log(chalk.bold('  修复摘要:'));
    console.log(`    ${chalk.gray('•')} 目标文件: ${chalk.cyan(checkResult.targetFile)}`);
    if (backupPath) {
      console.log(`    ${chalk.gray('•')} 备份文件: ${chalk.cyan(backupPath)}`);
    }
    console.log(`    ${chalk.gray('•')} 执行时间: ${chalk.cyan(`${elapsed}ms`)}`);
    console.log();
    console.log(chalk.gray('  如需撤销修复，请运行: openclaw-feishu-fixer undo'));
    console.log();

    return 0;
  } catch (error) {
    console.log();
    console.log(chalk.red.bold('  修复过程中发生错误:'));
    console.log(`    ${chalk.red('✗')} ${error instanceof Error ? error.message : String(error)}`);
    console.log();
    return 2;
  }
}

export default runFix;
