/**
 * status 命令
 *
 * 显示当前修复状态和相关信息
 */

import chalk from 'chalk';
import { existsSync } from 'fs';
import { detect } from '../core/detector.js';
import { BackupManager } from '../core/backup.js';
import { checkServiceStatus, serviceExists } from '../utils/service.js';
import { createLogger } from '../utils/logger.js';
import type { StatusInfo } from '../types/index.js';

const log = createLogger('status');

/**
 * 执行状态查看命令
 *
 * @returns 退出码（0=成功，1=错误）
 */
export async function runStatus(): Promise<number> {
  console.log();
  console.log(chalk.cyan('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
  console.log(chalk.cyan('  OpenClaw 飞书图片发送修复状态'));
  console.log(chalk.cyan('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
  console.log();

  try {
    // 收集状态信息
    const statusInfo: StatusInfo = {
      openclawInstalled: false,
      isFixed: false,
      backups: [],
    };

    // 检测 OpenClaw 状态
    log.info('正在收集状态信息...');
    const checkResult = await detect();

    statusInfo.openclawInstalled = !!checkResult.openclawPath;
    statusInfo.openclawVersion = checkResult.openclawVersion;
    statusInfo.isFixed = !checkResult.hasProblem;

    // 获取备份信息
    if (checkResult.targetFile) {
      const backupManager = new BackupManager();
      statusInfo.backups = await backupManager.list(checkResult.targetFile);
    }

    // 获取服务状态
    if (serviceExists()) {
      statusInfo.serviceStatus = checkServiceStatus();
    }

    // 显示状态信息
    console.log(chalk.bold('  系统信息:'));
    console.log(chalk.gray('─'.repeat(40)));

    // OpenClaw 安装状态
    if (statusInfo.openclawInstalled) {
      console.log(`  OpenClaw 状态: ${chalk.green('已安装')}`);
      console.log(`  安装路径: ${chalk.cyan(checkResult.openclawPath || '未知')}`);
      if (statusInfo.openclawVersion) {
        console.log(`  版本号: ${chalk.cyan(statusInfo.openclawVersion)}`);
      }
    } else {
      console.log(`  OpenClaw 状态: ${chalk.red('未安装')}`);
    }

    console.log();

    // 修复状态
    console.log(chalk.bold('  修复状态:'));
    console.log(chalk.gray('─'.repeat(40)));

    if (statusInfo.isFixed) {
      console.log(`  当前状态: ${chalk.green('已修复')}`);
      console.log(`  飞书图片发送: ${chalk.green('正常')}`);
    } else if (statusInfo.openclawInstalled) {
      console.log(`  当前状态: ${chalk.yellow('需要修复')}`);
      console.log(`  飞书图片发送: ${chalk.yellow('可能存在问题')}`);
    } else {
      console.log(`  当前状态: ${chalk.gray('无法检测')}`);
    }

    if (checkResult.targetFile) {
      console.log(`  目标文件: ${chalk.cyan(checkResult.targetFile)}`);
    }

    console.log();

    // 备份信息
    console.log(chalk.bold('  备份信息:'));
    console.log(chalk.gray('─'.repeat(40)));

    if (statusInfo.backups.length > 0) {
      console.log(`  备份数量: ${chalk.cyan(statusInfo.backups.length)} 个`);
      console.log();
      console.log(`  ${chalk.bold('最近的备份:')}`);

      // 显示最近3个备份
      const recentBackups = statusInfo.backups.slice(0, 3);
      for (let i = 0; i < recentBackups.length; i++) {
        const backup = recentBackups[i];
        const icon = i === 0 ? chalk.green('●') : chalk.gray('○');
        const sizeKB = (backup.size / 1024).toFixed(2);
        console.log(`    ${icon} ${chalk.cyan(backup.path)}`);
        console.log(`       时间: ${backup.createdAt.toLocaleString()}`);
        console.log(`       大小: ${sizeKB} KB`);
      }

      if (statusInfo.backups.length > 3) {
        console.log(`    ${chalk.gray(`... 还有 ${statusInfo.backups.length - 3} 个旧备份`)}`);
      }
    } else {
      console.log(`  备份数量: ${chalk.gray('无')}`);
    }

    console.log();

    // 服务状态
    if (statusInfo.serviceStatus) {
      console.log(chalk.bold('  服务状态:'));
      console.log(chalk.gray('─'.repeat(40)));

      const service = statusInfo.serviceStatus;
      if (service.isActive) {
        console.log(`  运行状态: ${chalk.green('运行中')}`);
        if (service.since) {
          console.log(`  启动时间: ${chalk.cyan(service.since)}`);
        }
      } else {
        console.log(`  运行状态: ${chalk.gray('未运行')}`);
      }
      console.log();
    }

    // 建议操作
    console.log(chalk.bold('  建议操作:'));
    console.log(chalk.gray('─'.repeat(40)));

    if (!statusInfo.openclawInstalled) {
      console.log(`  ${chalk.yellow('•')} 安装 OpenClaw`);
    } else if (!statusInfo.isFixed) {
      console.log(`  ${chalk.yellow('•')} 运行 ${chalk.cyan('openclaw-feishu-fixer fix')} 修复问题`);
    } else {
      console.log(`  ${chalk.green('✓')} 系统状态正常，无需操作`);
    }

    console.log();
    return 0;
  } catch (error) {
    console.log();
    console.log(chalk.red.bold('  获取状态信息时发生错误:'));
    console.log(`    ${chalk.red('✗')} ${error instanceof Error ? error.message : String(error)}`);
    console.log();
    return 1;
  }
}

export default runStatus;
