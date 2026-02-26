/**
 * 日志工具
 *
 * 提供统一的日志输出功能，支持彩色输出和日志级别
 */

import chalk from 'chalk';

/** 日志级别 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'success';

/** 日志配置 */
interface LoggerConfig {
  /** 是否启用彩色输出 */
  colorEnabled: boolean;
  /** 最小日志级别 */
  minLevel: LogLevel;
  /** 是否显示时间戳 */
  showTimestamp: boolean;
}

/** 默认配置 */
const defaultConfig: LoggerConfig = {
  colorEnabled: true,
  minLevel: 'info',
  showTimestamp: false,
};

/** 全局配置 */
let config = { ...defaultConfig };

/**
 * 日志工具类
 */
export class Logger {
  private prefix: string;

  constructor(prefix: string = '') {
    this.prefix = prefix;
  }

  /**
   * 设置全局日志配置
   */
  static configure(newConfig: Partial<LoggerConfig>): void {
    config = { ...config, ...newConfig };
  }

  /**
   * 输出调试信息
   */
  debug(message: string, ...args: unknown[]): void {
    this.log('debug', message, ...args);
  }

  /**
   * 输出普通信息
   */
  info(message: string, ...args: unknown[]): void {
    this.log('info', message, ...args);
  }

  /**
   * 输出警告信息
   */
  warn(message: string, ...args: unknown[]): void {
    this.log('warn', message, ...args);
  }

  /**
   * 输出错误信息
   */
  error(message: string, ...args: unknown[]): void {
    this.log('error', message, ...args);
  }

  /**
   * 输出成功信息
   */
  success(message: string, ...args: unknown[]): void {
    this.log('success', message, ...args);
  }

  /**
   * 输出步骤信息
   */
  step(stepNum: number, total: number, message: string): void {
    const prefix = chalk.gray(`[${stepNum}/${total}]`);
    this.info(`${prefix} ${message}`);
  }

  /**
   * 内部日志方法
   */
  private log(level: LogLevel, message: string, ...args: unknown[]): void {
    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error', 'success'];
    if (levels.indexOf(level) < levels.indexOf(config.minLevel)) {
      return;
    }

    const timestamp = config.showTimestamp
      ? chalk.gray(`[${new Date().toISOString()}] `)
      : '';

    const prefixStr = this.prefix ? chalk.cyan(`[${this.prefix}] `) : '';

    let formattedMessage: string;
    if (config.colorEnabled) {
      switch (level) {
        case 'debug':
          formattedMessage = chalk.gray(message);
          break;
        case 'info':
          formattedMessage = chalk.blue(message);
          break;
        case 'warn':
          formattedMessage = chalk.yellow(message);
          break;
        case 'error':
          formattedMessage = chalk.red(message);
          break;
        case 'success':
          formattedMessage = chalk.green(message);
          break;
        default:
          formattedMessage = message;
      }
    } else {
      formattedMessage = message;
    }

    const levelIcon = this.getLevelIcon(level);
    const output = `${timestamp}${prefixStr}${levelIcon} ${formattedMessage}`;

    if (level === 'error') {
      console.error(output, ...args);
    } else if (level === 'warn') {
      console.warn(output, ...args);
    } else {
      console.log(output, ...args);
    }
  }

  /**
   * 获取日志级别图标
   */
  private getLevelIcon(level: LogLevel): string {
    const icons: Record<LogLevel, string> = {
      debug: '○',
      info: '●',
      warn: '⚠',
      error: '✖',
      success: '✓',
    };
    return config.colorEnabled ? icons[level] : `[${level.toUpperCase()}]`;
  }
}

/** 默认日志实例 */
export const logger = new Logger('fixer');

/** 创建带前缀的日志实例 */
export function createLogger(prefix: string): Logger {
  return new Logger(prefix);
}
