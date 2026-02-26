/**
 * 类型定义：飞书图片发送修复工具
 *
 * 定义了核心数据模型和接口
 */

/**
 * 修复配置
 */
export interface PatchConfig {
  /** OpenClaw 安装路径 */
  openclawPath: string;
  /** 目标文件路径 */
  targetFile: string;
  /** 备份目录 */
  backupDir: string;
  /** 是否创建备份 */
  createBackup?: boolean;
  /** 是否自动重启服务 */
  autoRestart?: boolean;
  /** 备份文件后缀 */
  backupSuffix?: string;
}

/**
 * 修复结果
 */
export interface FixResult {
  /** 是否成功 */
  success: boolean;
  /** 结果消息 */
  message: string;
  /** 备份文件路径 */
  backupPath?: string;
  /** 错误信息 */
  error?: Error;
  /** 修复的文件路径列表 */
  fixedFiles?: string[];
  /** 错误信息列表 */
  errors?: FixerErrorInfo[];
  /** 警告信息列表 */
  warnings?: string[];
  /** 备份文件路径列表 */
  backupFiles?: string[];
  /** 执行时间（毫秒） */
  executionTime?: number;
}

/**
 * 检测结果
 */
export interface CheckResult {
  /** 是否有问题（未修复） */
  hasProblem: boolean;
  /** 是否需要修复 */
  needsFix?: boolean;
  /** 当前状态描述 */
  status?: CheckStatus;
  /** 问题详情 */
  details: string[];
  /** 检测到的问题列表 */
  issues?: CheckIssue[];
  /** 检查的文件路径列表 */
  checkedFiles?: string[];
  /** OpenClaw 版本 */
  openclawVersion?: string;
  /** OpenClaw 安装路径 */
  openclawPath?: string;
  /** 目标文件路径 */
  targetFile?: string;
}

/**
 * 备份信息
 */
export interface BackupInfo {
  /** 备份文件路径 */
  path: string;
  /** 原始文件路径 */
  originalPath: string;
  /** 创建时间 */
  createdAt: Date;
  /** 文件大小（字节） */
  size: number;
}

/**
 * 服务状态
 */
export interface ServiceStatus {
  /** 服务是否运行 */
  isActive: boolean;
  /** 服务状态文本 */
  status: string;
  /** 上次启动时间 */
  since?: string;
}

/**
 * 错误类型枚举
 */
export enum FixerError {
  /** OpenClaw 未找到 */
  OPENCLAW_NOT_FOUND = 'OPENCLAW_NOT_FOUND',
  /** 目标文件未找到 */
  FILE_NOT_FOUND = 'FILE_NOT_FOUND',
  /** 已经修复 */
  ALREADY_FIXED = 'ALREADY_FIXED',
  /** 未修复 */
  NOT_FIXED = 'NOT_FIXED',
  /** 权限不足 */
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  /** 补丁失败 */
  PATCH_FAILED = 'PATCH_FAILED',
  /** 服务错误 */
  SERVICE_ERROR = 'SERVICE_ERROR',
  /** 备份不存在 */
  BACKUP_NOT_FOUND = 'BACKUP_NOT_FOUND',
}

/**
 * 自定义错误类
 */
export class FixerException extends Error {
  constructor(
    public readonly code: FixerError,
    message: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'FixerException';
  }
}

/**
 * 错误信息接口
 */
export interface FixerErrorInfo {
  /** 错误代码 */
  code: FixerError;
  /** 错误消息 */
  message: string;
  /** 相关文件路径 */
  file?: string;
  /** 原始错误 */
  cause?: Error;
}

/**
 * 检查状态枚举
 */
export enum CheckStatus {
  /** 健康 - 不需要修复 */
  HEALTHY = 'healthy',
  /** 已修复 */
  FIXED = 'fixed',
  /** 需要修复 */
  NEEDS_FIX = 'needs_fix',
  /** 未知状态 */
  UNKNOWN = 'unknown',
  /** 错误状态 */
  ERROR = 'error',
  /** OpenClaw 未找到 */
  OPENCLAW_NOT_FOUND = 'openclaw_not_found',
  /** 文件未找到 */
  FILE_NOT_FOUND = 'file_not_found',
  /** 读取错误 */
  READ_ERROR = 'read_error',
}

/**
 * 检查问题接口
 */
export interface CheckIssue {
  /** 问题类型 */
  type: 'error' | 'warning' | 'missing' | IssueType;
  /** 错误代码 */
  code?: FixerError;
  /** 问题描述 */
  description?: string;
  /** 问题消息 */
  message: string;
  /** 相关文件路径 */
  file?: string;
  /** 行号 */
  line?: number;
  /** 建议的修复方案 */
  suggestion?: string;
}

/**
 * 问题类型枚举
 */
export enum IssueType {
  /** 缺少 MEDIA 语法处理 */
  MISSING_MEDIA_HANDLER = 'missing_media_handler',
  /** MEDIA 语法处理不完整 */
  INCOMPLETE_MEDIA_HANDLER = 'incomplete_media_handler',
  /** 配置文件缺失 */
  MISSING_CONFIG = 'missing_config',
  /** 版本不兼容 */
  VERSION_INCOMPATIBLE = 'version_incompatible',
  /** 文件权限问题 */
  PERMISSION_ERROR = 'permission_error',
  /** 未知问题 */
  UNKNOWN = 'unknown',
}

/**
 * 日志级别枚举
 */
export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
}

/**
 * 状态显示信息接口
 */
export interface StatusInfo {
  /** OpenClaw 是否已安装 */
  openclawInstalled: boolean;
  /** OpenClaw 版本 */
  openclawVersion?: string;
  /** 是否已修复 */
  isFixed: boolean;
  /** 备份文件列表 */
  backups: BackupInfo[];
  /** 服务状态 */
  serviceStatus?: ServiceStatus;
}

/**
 * 默认配置
 */
export const DEFAULT_CONFIG: Omit<PatchConfig, 'openclawPath' | 'targetFile' | 'backupDir'> = {
  createBackup: true,
  autoRestart: false,
  backupSuffix: '.backup',
};
