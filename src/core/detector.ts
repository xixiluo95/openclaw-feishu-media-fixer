/**
 * 问题检测器
 *
 * 检测 OpenClaw 飞书扩展是否存在图片发送问题
 */

import { execSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import type { CheckResult, CheckIssue } from '../types/index.js';
import { FixerError, CheckStatus, IssueType } from '../types/index.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('detector');

/** OpenClaw 可能的安装路径 */
const OPENCLAW_PATHS = [
  // npm 全局安装路径
  join(process.env.HOME || '', '.npm-global', 'lib', 'node_modules', 'openclaw'),
  // 用户主目录下的 .openclaw
  join(process.env.HOME || '', '.openclaw'),
  // 工作区路径
  join(process.env.HOME || '', '.openclaw', 'workspace'),
  // 标准 npm 全局路径
  '/usr/local/lib/node_modules/openclaw',
  '/usr/lib/node_modules/openclaw',
];

/** 目标文件相对路径（飞书扩展） */
const TARGET_FILE_RELATIVE = 'extensions/feishu/src/reply-dispatcher.ts';

/** 编译后的 JS 文件相对路径 */
const COMPILED_FILE_RELATIVE = 'extensions/feishu/dist/reply-dispatcher.js';

/** sendMediaFeishu 导入语句的正则表达式 */
const MEDIA_IMPORT_PATTERN =
  /import\s*\{[^}]*sendMediaFeishu[^}]*\}\s*from\s*['"]\.\/media\.js['"]/;

/** 媒体发送逻辑的正则表达式 */
const MEDIA_LOGIC_PATTERN = /payload\.mediaUrls\?\.length/;

/** sendMediaFeishu 调用的正则表达式 */
const SEND_MEDIA_CALL_PATTERN = /await\s+sendMediaFeishu\s*\(/;

/** deliver 函数定义的正则表达式 */
const DELIVER_FUNCTION_PATTERN =
  /deliver:\s*async\s*\(payload:\s*ReplyPayload/;

/**
 * 问题检测器类
 *
 * 用于检测 OpenClaw 飞书扩展是否存在图片发送问题
 */
export class ProblemDetector {
  private openclawPath: string | null = null;
  private targetFile: string | null = null;

  /**
   * 执行检测
   *
   * @returns 检测结果
   */
  async check(): Promise<CheckResult> {
    log.debug('开始检测 OpenClaw 飞书图片发送问题...');

    const issues: CheckIssue[] = [];
    const checkedFiles: string[] = [];

    // 步骤1: 定位 OpenClaw 安装路径
    this.openclawPath = this.locateOpenClaw();
    if (!this.openclawPath) {
      log.error('未找到 OpenClaw 安装路径');
      return {
        hasProblem: true,
        needsFix: false,
        status: CheckStatus.OPENCLAW_NOT_FOUND,
        details: ['未找到 OpenClaw 安装路径，请确认 OpenClaw 已正确安装'],
        issues: [
          {
            type: 'error',
            code: FixerError.OPENCLAW_NOT_FOUND,
            message: '未找到 OpenClaw 安装路径',
            suggestion: '请使用 npm install -g openclaw 安装 OpenClaw',
          },
        ],
      };
    }

    log.info(`找到 OpenClaw 安装路径: ${this.openclawPath}`);

    // 步骤2: 获取 OpenClaw 版本
    const version = this.getOpenClawVersion();
    log.info(`OpenClaw 版本: ${version || '未知'}`);

    // 步骤3: 定位目标文件
    this.targetFile = this.locateTargetFile();
    if (!this.targetFile) {
      log.error('未找到目标文件 reply-dispatcher.ts');
      return {
        hasProblem: true,
        needsFix: false,
        status: CheckStatus.FILE_NOT_FOUND,
        details: ['未找到目标文件: extensions/feishu/src/reply-dispatcher.ts'],
        openclawPath: this.openclawPath ?? undefined,
        openclawVersion: version ?? undefined,
        issues: [
          {
            type: 'error',
            code: FixerError.FILE_NOT_FOUND,
            message: '未找到目标文件 reply-dispatcher.ts',
            suggestion: '请确认 OpenClaw 版本是否兼容（需要 2026.2.x 版本）',
          },
        ],
      };
    }

    checkedFiles.push(this.targetFile);
    log.debug(`目标文件: ${this.targetFile}`);

    // 步骤4: 读取文件内容
    let content: string;
    try {
      content = readFileSync(this.targetFile, 'utf-8');
    } catch (err) {
      log.error('无法读取目标文件内容');
      return {
        hasProblem: true,
        needsFix: false,
        status: CheckStatus.READ_ERROR,
        details: ['无法读取目标文件内容'],
        openclawPath: this.openclawPath ?? undefined,
        openclawVersion: version ?? undefined,
        targetFile: this.targetFile,
        issues: [
          {
            type: 'error',
            code: FixerError.PERMISSION_DENIED,
            message: '无法读取目标文件内容',
            file: this.targetFile,
          },
        ],
        checkedFiles,
      };
    }

    // 步骤5: 检测是否已添加 sendMediaFeishu 导入
    const hasMediaImport = MEDIA_IMPORT_PATTERN.test(content);
    if (!hasMediaImport) {
      log.warn('未找到 sendMediaFeishu 导入语句');
      issues.push({
        type: 'missing',
        code: FixerError.NOT_FIXED,
        message: '缺少 sendMediaFeishu 导入语句',
        file: this.targetFile,
        suggestion: '需要添加: import { sendMediaFeishu } from "./media.js";',
      });
    } else {
      log.success('已找到 sendMediaFeishu 导入语句');
    }

    // 步骤6: 检测是否已添加媒体发送逻辑
    const hasMediaLogic = MEDIA_LOGIC_PATTERN.test(content);
    if (!hasMediaLogic) {
      log.warn('未找到媒体发送逻辑');
      issues.push({
        type: 'missing',
        code: FixerError.NOT_FIXED,
        message: '缺少媒体发送逻辑',
        file: this.targetFile,
        suggestion: '需要在 deliver 函数开头添加媒体发送代码',
      });
    } else {
      log.success('已找到媒体发送逻辑');
    }

    // 步骤7: 检测是否包含 sendMediaFeishu 调用
    const hasSendMediaCall = SEND_MEDIA_CALL_PATTERN.test(content);
    if (!hasSendMediaCall && hasMediaLogic) {
      log.warn('有媒体逻辑但缺少 sendMediaFeishu 调用');
      issues.push({
        type: 'warning',
        code: FixerError.NOT_FIXED,
        message: '缺少 sendMediaFeishu 函数调用',
        file: this.targetFile,
        suggestion: '需要调用 sendMediaFeishu 函数发送媒体',
      });
    }

    // 步骤8: 生成检测结果
    const isFixed = hasMediaImport && hasMediaLogic && hasSendMediaCall;
    const details: string[] = [];

    if (isFixed) {
      details.push('OpenClaw 飞书图片发送功能已正常配置');
      details.push('媒体发送功能已启用');
      log.success('检测完成：飞书图片发送功能正常');
    } else {
      details.push('OpenClaw 飞书图片发送功能需要修复');
      if (!hasMediaImport) {
        details.push('- 缺少 sendMediaFeishu 导入语句');
      }
      if (!hasMediaLogic) {
        details.push('- 缺少媒体发送逻辑');
      }
      if (!hasSendMediaCall && hasMediaLogic) {
        details.push('- 缺少 sendMediaFeishu 函数调用');
      }
      log.warn('检测完成：发现需要修复的问题');
    }

    return {
      hasProblem: !isFixed,
      needsFix: !isFixed,
      status: isFixed ? CheckStatus.FIXED : CheckStatus.NEEDS_FIX,
      details,
      issues,
      checkedFiles,
      openclawPath: this.openclawPath ?? undefined,
      openclawVersion: version ?? undefined,
      targetFile: this.targetFile ?? undefined,
    };
  }

  /**
   * 定位 OpenClaw 安装路径
   */
  private locateOpenClaw(): string | null {
    // 首先检查预定义的路径
    for (const path of OPENCLAW_PATHS) {
      if (existsSync(join(path, 'package.json'))) {
        return path;
      }
    }

    // 尝试通过 which 查找
    try {
      const result = execSync('which openclaw-gateway 2>/dev/null', {
        encoding: 'utf-8',
      }).trim();
      if (result) {
        // 从可执行文件路径推断安装路径
        // 通常在 node_modules/.bin/ 下，向上查找
        const binDir = join(result, '..');
        const nodeModulesDir = join(binDir, '..');
        if (existsSync(join(nodeModulesDir, 'package.json'))) {
          return nodeModulesDir;
        }
      }
    } catch {
      // which 命令失败，忽略
    }

    // 尝试通过 npm root 查找全局安装路径
    try {
      const npmRoot = execSync('npm root -g 2>/dev/null', {
        encoding: 'utf-8',
      }).trim();
      const openclawPath = join(npmRoot, 'openclaw');
      if (existsSync(join(openclawPath, 'package.json'))) {
        return openclawPath;
      }
    } catch {
      // npm 命令失败，忽略
    }

    return null;
  }

  /**
   * 获取 OpenClaw 版本
   */
  private getOpenClawVersion(): string | null {
    if (!this.openclawPath) {
      return null;
    }

    // 尝试从 package.json 读取版本
    const packageJsonPath = join(this.openclawPath, 'package.json');
    if (existsSync(packageJsonPath)) {
      try {
        const content = readFileSync(packageJsonPath, 'utf-8');
        const pkg = JSON.parse(content);
        return pkg.version || null;
      } catch {
        // 解析失败，忽略
      }
    }

    // 尝试从版本文件读取
    const versionPath = join(this.openclawPath, 'VERSION');
    if (existsSync(versionPath)) {
      try {
        return readFileSync(versionPath, 'utf-8').trim();
      } catch {
        // 读取失败，忽略
      }
    }

    return null;
  }

  /**
   * 定位目标文件
   */
  private locateTargetFile(): string | null {
    if (!this.openclawPath) {
      return null;
    }

    // 优先检查 TypeScript 源文件
    const tsPath = join(this.openclawPath, TARGET_FILE_RELATIVE);
    if (existsSync(tsPath)) {
      return tsPath;
    }

    // 如果没有源文件，检查编译后的 JS 文件
    const jsPath = join(this.openclawPath, COMPILED_FILE_RELATIVE);
    if (existsSync(jsPath)) {
      return jsPath;
    }

    return null;
  }

  /**
   * 获取 OpenClaw 路径（检测后可用）
   */
  getOpenClawPath(): string | null {
    return this.openclawPath;
  }

  /**
   * 获取目标文件路径（检测后可用）
   */
  getTargetFile(): string | null {
    return this.targetFile;
  }

  /**
   * 验证文件内容格式
   * @param content 文件内容
   * @returns 验证结果
   */
  validateContent(content: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // 检查是否包含必要的导入
    if (!content.includes('from "openclaw/plugin-sdk"')) {
      errors.push('文件格式异常：缺少 openclaw/plugin-sdk 导入');
    }

    // 检查是否包含 deliver 函数
    if (!DELIVER_FUNCTION_PATTERN.test(content)) {
      errors.push('文件格式异常：未找到 deliver 函数定义');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}

/**
 * 创建检测器实例并执行检测
 */
export async function detect(): Promise<CheckResult> {
  const detector = new ProblemDetector();
  return detector.check();
}

/**
 * 快速检测是否需要修复
 * @returns 是否需要修复
 */
export async function needsFix(): Promise<boolean> {
  const result = await detect();
  return result.hasProblem;
}
