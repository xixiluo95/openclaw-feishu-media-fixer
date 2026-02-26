#!/usr/bin/env node
/**
 * OpenClaw 飞书图片发送修复工具
 *
 * CLI 主入口文件
 *
 * 用法:
 *   openclaw-feishu-fixer check    - 检测是否存在飞书图片发送问题
 *   openclaw-feishu-fixer fix      - 应用修复补丁
 *   openclaw-feishu-fixer undo     - 撤销修复
 *   openclaw-feishu-fixer status   - 查看当前状态
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { runCheck } from './commands/check.js';
import { runFix } from './commands/fix.js';
import { runUndo } from './commands/undo.js';
import { runStatus } from './commands/status.js';

// 版本号（从 package.json 读取）
const VERSION = '1.0.0';

// 创建 CLI 程序
const program = new Command();

program
  .name('openclaw-feishu-fixer')
  .description('OpenClaw 飞书图片发送修复工具')
  .version(VERSION);

// check 命令
program
  .command('check')
  .description('检测是否存在飞书图片发送问题')
  .action(async () => {
    const exitCode = await runCheck();
    process.exit(exitCode);
  });

// fix 命令
program
  .command('fix')
  .description('应用修复补丁')
  .option('--no-restart', '不重启服务')
  .option('--no-backup', '不创建备份（不推荐）')
  .option('-f, --force', '强制修复（即使已经修复过）')
  .action(async (options) => {
    const exitCode = await runFix({
      restart: options.restart !== false,
      noBackup: options.noBackup || false,
      force: options.force || false,
    });
    process.exit(exitCode);
  });

// undo 命令
program
  .command('undo')
  .description('撤销修复')
  .option('--no-restart', '不重启服务')
  .option('-d, --delete-backup', '撤销后删除备份文件')
  .action(async (options) => {
    const exitCode = await runUndo({
      restart: options.restart !== false,
      deleteBackup: options.deleteBackup || false,
    });
    process.exit(exitCode);
  });

// status 命令
program
  .command('status')
  .description('查看当前状态')
  .action(async () => {
    const exitCode = await runStatus();
    process.exit(exitCode);
  });

// 显示帮助信息时添加一些样式
program.addHelpText('before', '\n' +
  chalk.cyan('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━') + '\n' +
  chalk.cyan.bold('  OpenClaw 飞书图片发送修复工具') + '\n' +
  chalk.cyan('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━') + '\n');

program.addHelpText('after', '\n' +
  chalk.bold('示例:') + '\n' +
  `  $ ${chalk.cyan('openclaw-feishu-fixer check')}    # 检测问题\n` +
  `  $ ${chalk.cyan('openclaw-feishu-fixer fix')}      # 修复问题\n` +
  `  $ ${chalk.cyan('openclaw-feishu-fixer undo')}     # 撤销修复\n` +
  `  $ ${chalk.cyan('openclaw-feishu-fixer status')}   # 查看状态\n` +
  '\n' +
  chalk.gray('更多信息请访问: https://github.com/your-repo/openclaw-feishu-media-fixer') + '\n');

// 全局错误处理
process.on('uncaughtException', (error) => {
  console.log();
  console.log(chalk.red.bold('发生未捕获的异常:'));
  console.log(chalk.red(`  ${error.message}`));
  if (error.stack) {
    console.log(chalk.gray(error.stack));
  }
  console.log();
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.log();
  console.log(chalk.red.bold('发生未处理的 Promise 拒绝:'));
  console.log(chalk.red(`  ${reason instanceof Error ? reason.message : String(reason)}`));
  console.log();
  process.exit(1);
});

// 解析命令行参数并执行
program.parse(process.argv);
