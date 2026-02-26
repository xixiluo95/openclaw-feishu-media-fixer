/**
 * 文件工具
 *
 * 提供文件操作相关的辅助功能
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

/**
 * 确保目录存在，如果不存在则创建
 * @param dirPath 目录路径
 */
export function ensureDir(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * 安全读取文件内容
 * @param filePath 文件路径
 * @returns 文件内容，如果文件不存在返回 null
 */
export function safeReadFile(filePath: string): string | null {
  try {
    if (fs.existsSync(filePath)) {
      return fs.readFileSync(filePath, 'utf-8');
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * 写入文件内容
 * @param filePath 文件路径
 * @param content 文件内容
 */
export function writeFile(filePath: string, content: string): void {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, content, 'utf-8');
}

/**
 * 复制文件
 * @param src 源文件路径
 * @param dest 目标文件路径
 */
export function copyFile(src: string, dest: string): void {
  ensureDir(path.dirname(dest));
  fs.copyFileSync(src, dest);
}

/**
 * 删除文件（如果存在）
 * @param filePath 文件路径
 */
export function deleteFile(filePath: string): void {
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}

/**
 * 获取文件大小（字节）
 * @param filePath 文件路径
 * @returns 文件大小，如果文件不存在返回 0
 */
export function getFileSize(filePath: string): number {
  try {
    const stats = fs.statSync(filePath);
    return stats.size;
  } catch {
    return 0;
  }
}

/**
 * 获取文件的修改时间
 * @param filePath 文件路径
 * @returns 修改时间，如果文件不存在返回 null
 */
export function getFileModTime(filePath: string): Date | null {
  try {
    const stats = fs.statSync(filePath);
    return stats.mtime;
  } catch {
    return null;
  }
}

/**
 * 检查路径是否存在
 * @param filePath 文件路径
 * @returns 是否存在
 */
export function pathExists(filePath: string): boolean {
  return fs.existsSync(filePath);
}

/**
 * 获取默认备份目录路径
 * @returns 备份目录路径
 */
export function getDefaultBackupDir(): string {
  return path.join(os.homedir(), '.openclaw', 'backups');
}

/**
 * 获取可能的 OpenClaw 安装路径列表
 * @returns 可能的路径列表
 */
export function getPossibleOpenClawPaths(): string[] {
  const homeDir = os.homedir();
  const paths: string[] = [];

  // npm 全局安装路径
  paths.push(path.join(homeDir, '.npm-global', 'lib', 'node_modules', 'openclaw'));

  // 标准 npm 全局路径
  paths.push('/usr/local/lib/node_modules/openclaw');
  paths.push('/usr/lib/node_modules/openclaw');

  // nvm 安装路径
  const nvmDir = path.join(homeDir, '.nvm');
  if (fs.existsSync(nvmDir)) {
    // 尝试查找 nvm 下的 node 版本目录
    try {
      const versionsDir = path.join(nvmDir, 'versions', 'node');
      if (fs.existsSync(versionsDir)) {
        const versions = fs.readdirSync(versionsDir);
        for (const version of versions) {
          paths.push(
            path.join(versionsDir, version, 'lib', 'node_modules', 'openclaw')
          );
        }
      }
    } catch {
      // 忽略错误
    }
  }

  // pnpm 全局路径
  paths.push(path.join(homeDir, '.local', 'share', 'pnpm', 'global'));

  // yarn 全局路径
  paths.push(path.join(homeDir, '.config', 'yarn', 'global', 'node_modules', 'openclaw'));

  return paths;
}

/**
 * 查找 OpenClaw 安装路径
 * @returns OpenClaw 路径，如果未找到返回 null
 */
export function findOpenClawPath(): string | null {
  const possiblePaths = getPossibleOpenClawPaths();

  for (const p of possiblePaths) {
    const packageJsonPath = path.join(p, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      try {
        const content = fs.readFileSync(packageJsonPath, 'utf-8');
        const pkg = JSON.parse(content);
        // 验证是 OpenClaw 包
        if (pkg.name === 'openclaw' || pkg.name === '@anthropic/openclaw') {
          return p;
        }
      } catch {
        // 忽略解析错误，继续检查下一个路径
      }
    }
  }

  return null;
}

/**
 * 获取 OpenClaw 版本
 * @param openclawPath OpenClaw 安装路径
 * @returns 版本号，如果无法获取返回 null
 */
export function getOpenClawVersion(openclawPath: string): string | null {
  try {
    const packageJsonPath = path.join(openclawPath, 'package.json');
    const content = fs.readFileSync(packageJsonPath, 'utf-8');
    const pkg = JSON.parse(content);
    return pkg.version || null;
  } catch {
    return null;
  }
}

/**
 * 获取目标文件路径（reply-dispatcher.ts）
 * @param openclawPath OpenClaw 安装路径
 * @returns 目标文件路径
 */
export function getTargetFilePath(openclawPath: string): string {
  return path.join(
    openclawPath,
    'extensions',
    'feishu',
    'src',
    'reply-dispatcher.ts'
  );
}
