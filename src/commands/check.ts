/**
 * check 命令
 *
 * 检测 OpenClaw 是否存在飞书图片发送问题
 */

import chalk from 'chalk';
import { detect } from '../core/detector.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('check');

/**
 * 执行检测命令
 *
 * @returns 退出码（0=无问题，1=有问题，2=错误）
 */
export async function runCheck(): Promise<number> {
  console.log();
  console.log(chalk.cyan('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
  console.log(chalk.cyan('  OpenClaw 飞书图片发送问题检测'));
  console.log(chalk.cyan('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
  console.log();

  try {
    // 执行检测
    log.info('正在检测...');
    const result = await detect();

    console.log();
    console.log(chalk.bold('检测结果:'));
    console.log(chalk.gray('─'.repeat(40)));

    // 显示 OpenClaw 路径
    if (result.openclawPath) {
      console.log(`  OpenClaw 路径: ${chalk.green(result.openclawPath)}`);
    } else {
      console.log(`  OpenClaw 路径: ${chalk.red('未找到')}`);
    }

    // 显示版本
    if (result.openclawVersion) {
      console.log(`  OpenClaw 版本: ${chalk.green(result.openclawVersion)}`);
    } else {
      console.log(`  OpenClaw 版本: ${chalk.gray('未知')}`);
    }

    // 显示目标文件
    if (result.targetFile) {
      console.log(`  目标文件: ${chalk.green(result.targetFile)}`);
    } else {
      console.log(`  目标文件: ${chalk.red('未找到')}`);
    }

    console.log();

    // 显示问题状态
    if (result.hasProblem) {
      // 根据 needsFix 判断是否可以修复
      if (result.needsFix) {
        console.log(chalk.yellow.bold('  状态: 需要修复'));
      } else {
        console.log(chalk.red.bold('  状态: 无法自动修复'));
      }
      console.log();
      console.log(chalk.bold('  问题详情:'));
      for (const detail of result.details) {
        console.log(`    ${chalk.yellow('•')} ${detail}`);
      }

      // 显示 issues 列表（如果有）
      if (result.issues && result.issues.length > 0) {
        console.log();
        console.log(chalk.bold('  发现的问题:'));
        for (const issue of result.issues) {
          const icon = issue.type === 'error' ? chalk.red('✗') :
                       issue.type === 'warning' ? chalk.yellow('⚠') :
                       chalk.gray('○');
          console.log(`    ${icon} ${issue.message}`);
          if (issue.suggestion) {
            console.log(`      ${chalk.gray('建议:')} ${issue.suggestion}`);
          }
        }
      }

      console.log();
      if (result.needsFix) {
        console.log(chalk.gray('  运行 ') + chalk.cyan('openclaw-feishu-fixer fix') + chalk.gray(' 来修复此问题'));
      }
      console.log();
      return 1;
    } else {
      // 根据状态显示不同的信息
      if (result.status === 'fixed' || result.details.some(d => d.includes('已正常配置') || d.includes('已经应用'))) {
        console.log(chalk.green.bold('  状态: 已修复'));
        console.log();
        console.log(chalk.bold('  详情:'));
        for (const detail of result.details) {
          console.log(`    ${chalk.green('✓')} ${detail}`);
        }
      } else if (result.status === 'healthy') {
        console.log(chalk.green.bold('  状态: 健康'));
        console.log();
        console.log(chalk.bold('  详情:'));
        for (const detail of result.details) {
          console.log(`    ${chalk.green('✓')} ${detail}`);
        }
      } else {
        console.log(chalk.gray.bold('  状态: 未知'));
        console.log();
        console.log(chalk.bold('  详情:'));
        for (const detail of result.details) {
          console.log(`    ${chalk.gray('○')} ${detail}`);
        }
      }
      console.log();
      return 0;
    }
  } catch (error) {
    console.log();
    console.log(chalk.red.bold('  检测过程中发生错误:'));
    console.log(`    ${chalk.red('✗')} ${error instanceof Error ? error.message : String(error)}`);
    console.log();
    return 2;
  }
}

export default runCheck;
