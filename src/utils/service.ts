/**
 * 服务管理工具
 *
 * 负责管理 OpenClaw Gateway systemd 服务
 */

import { execSync } from 'child_process';
import type { ServiceStatus } from '../types/index.js';
import { FixerError, FixerException } from '../types/index.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('service');

/** 服务名称 */
const SERVICE_NAME = 'openclaw-gateway.service';

/** 最大等待时间（毫秒） */
const MAX_WAIT_TIME = 30000;

/** 检查间隔（毫秒） */
const CHECK_INTERVAL = 1000;

/**
 * 检查服务状态
 */
export function checkServiceStatus(): ServiceStatus {
  try {
    // 检查服务是否激活
    const isActiveResult = execSync(
      `systemctl --user is-active ${SERVICE_NAME} 2>/dev/null || echo "inactive"`,
      { encoding: 'utf-8' }
    ).trim();

    const isActive = isActiveResult === 'active';

    // 获取服务状态详情
    let statusText = isActiveResult;
    let since: string | undefined;

    if (isActive) {
      try {
        // 获取服务启动时间
        const showResult = execSync(
          `systemctl --user show ${SERVICE_NAME} --property=ActiveEnterTimestamp 2>/dev/null`,
          { encoding: 'utf-8' }
        ).trim();

        const match = showResult.match(/ActiveEnterTimestamp=(.+)/);
        if (match) {
          since = match[1].trim();
        }
      } catch {
        // 获取时间失败，忽略
      }
    }

    // 检查服务是否启用
    let isEnabled = false;
    try {
      const isEnabledResult = execSync(
        `systemctl --user is-enabled ${SERVICE_NAME} 2>/dev/null || echo "disabled"`,
        { encoding: 'utf-8' }
      ).trim();
      isEnabled = isEnabledResult === 'enabled';
    } catch {
      // 检查启用状态失败，忽略
    }

    return {
      isActive,
      status: statusText,
      since,
    };
  } catch (error) {
    log.debug(`检查服务状态失败: ${error}`);
    return {
      isActive: false,
      status: 'unknown',
    };
  }
}

/**
 * 重启服务
 *
 * @returns 是否成功
 */
export async function restartService(): Promise<boolean> {
  log.info('正在重启 OpenClaw Gateway 服务...');

  try {
    // 执行重启命令
    execSync(`systemctl --user restart ${SERVICE_NAME}`, {
      encoding: 'utf-8',
      timeout: 10000,
    });

    log.info('重启命令已发送，等待服务就绪...');

    // 等待服务就绪
    const isReady = await waitForService();

    if (isReady) {
      log.success('服务已成功重启');
    } else {
      log.warn('服务重启超时，请手动检查服务状态');
    }

    return isReady;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log.error(`重启服务失败: ${errorMessage}`);

    // 提供手动重启指令
    log.info(`请手动执行: systemctl --user restart ${SERVICE_NAME}`);

    return false;
  }
}

/**
 * 停止服务
 */
export async function stopService(): Promise<boolean> {
  log.info('正在停止 OpenClaw Gateway 服务...');

  try {
    execSync(`systemctl --user stop ${SERVICE_NAME}`, {
      encoding: 'utf-8',
      timeout: 10000,
    });

    log.success('服务已停止');
    return true;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log.error(`停止服务失败: ${errorMessage}`);
    return false;
  }
}

/**
 * 启动服务
 */
export async function startService(): Promise<boolean> {
  log.info('正在启动 OpenClaw Gateway 服务...');

  try {
    execSync(`systemctl --user start ${SERVICE_NAME}`, {
      encoding: 'utf-8',
      timeout: 10000,
    });

    // 等待服务就绪
    const isReady = await waitForService();

    if (isReady) {
      log.success('服务已启动');
    } else {
      log.warn('服务启动超时');
    }

    return isReady;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log.error(`启动服务失败: ${errorMessage}`);
    return false;
  }
}

/**
 * 等待服务就绪
 *
 * @param maxWait 最大等待时间（毫秒）
 * @returns 服务是否就绪
 */
export async function waitForService(maxWait: number = MAX_WAIT_TIME): Promise<boolean> {
  const startTime = Date.now();

  while (Date.now() - startTime < maxWait) {
    const status = checkServiceStatus();
    if (status.isActive) {
      return true;
    }

    // 等待一段时间后再次检查
    await new Promise((resolve) => setTimeout(resolve, CHECK_INTERVAL));
  }

  return false;
}

/**
 * 查看服务日志
 *
 * @param lines 显示的行数
 */
export function viewServiceLogs(lines: number = 50): string {
  try {
    return execSync(
      `journalctl --user -u ${SERVICE_NAME} -n ${lines} --no-pager`,
      { encoding: 'utf-8' }
    );
  } catch (error) {
    log.error(`获取服务日志失败: ${error}`);
    return '';
  }
}

/**
 * 检查服务是否存在
 */
export function serviceExists(): boolean {
  try {
    execSync(`systemctl --user status ${SERVICE_NAME} 2>/dev/null`, {
      encoding: 'utf-8',
    });
    return true;
  } catch {
    return false;
  }
}
