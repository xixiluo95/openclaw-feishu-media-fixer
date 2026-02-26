#!/bin/bash
#
# OpenClaw 飞书图片发送修复工具 - 一键安装脚本
#
# 使用方法：
#   curl -fsSL https://raw.githubusercontent.com/xixiluo95/openclaw-feishu-media-fixer/main/install.sh | bash
#
# 或：
#   wget -qO- https://raw.githubusercontent.com/xixiluo95/openclaw-feishu-media-fixer/main/install.sh | bash
#

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 日志函数
log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# 检测 OpenClaw 安装路径
detect_openclaw_path() {
    local paths=(
        "$HOME/.npm-global/lib/node_modules/openclaw"
        "/usr/local/lib/node_modules/openclaw"
        "/usr/lib/node_modules/openclaw"
        "$(npm root -g)/openclaw"
    )

    for path in "${paths[@]}"; do
        if [[ -d "$path" ]]; then
            echo "$path"
            return 0
        fi
    done

    # 尝试通过 which 查找
    local openclaw_bin=$(which openclaw 2>/dev/null)
    if [[ -n "$openclaw_bin" ]]; then
        local resolved=$(readlink -f "$openclaw_bin" 2>/dev/null)
        if [[ -n "$resolved" ]]; then
            echo "$(dirname "$(dirname "$resolved")")"
            return 0
        fi
    fi

    return 1
}

# 目标文件路径
TARGET_FILE=""
BACKUP_DIR="$HOME/.openclaw-feishu-fixer/backups"

# 检查是否已修复
check_if_fixed() {
    if [[ ! -f "$TARGET_FILE" ]]; then
        echo "not_found"
        return
    fi

    if grep -q "sendMediaFeishu" "$TARGET_FILE" && \
       grep -q "payload.mediaUrls" "$TARGET_FILE" && \
       grep -q "先发送媒体" "$TARGET_FILE"; then
        echo "fixed"
    else
        echo "not_fixed"
    fi
}

# 检查版本兼容性
check_version() {
    local pkg_file="$1/package.json"
    if [[ -f "$pkg_file" ]]; then
        local version=$(grep '"version"' "$pkg_file" | head -1 | sed 's/.*"version": *"\([^"]*\)".*/\1/')
        log_info "OpenClaw 版本: $version"

        # 检查是否是 2026.2.x 版本
        if [[ ! "$version" =~ ^2026\.2\. ]]; then
            log_warn "版本兼容性警告：此工具针对 OpenClaw 2026.2.x 版本设计"
            log_warn "当前版本 $version 可能不兼容，继续可能导致问题"
            read -p "是否继续？(y/N) " -n 1 -r
            echo
            if [[ ! $REPLY =~ ^[Yy]$ ]]; then
                exit 1
            fi
        fi
    fi
}

# 创建备份
create_backup() {
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local backup_file="${BACKUP_DIR}/reply-dispatcher.ts.backup.${timestamp}"

    mkdir -p "$BACKUP_DIR"
    cp "$TARGET_FILE" "$backup_file"

    log_success "已创建备份: $backup_file"
    echo "$backup_file"
}

# 应用修复
apply_fix() {
    log_info "正在应用修复..."

    # 1. 添加 import（如果不存在）
    if ! grep -q 'import { sendMediaFeishu } from "./media.js"' "$TARGET_FILE"; then
        sed -i '/import { sendMarkdownCardFeishu, sendMessageFeishu } from "\.\/send\.js";/a\import { sendMediaFeishu } from "./media.js";' "$TARGET_FILE"
        log_success "已添加 sendMediaFeishu import"
    fi

    # 2. 添加媒体发送逻辑（如果不存在）
    if ! grep -q "先发送媒体" "$TARGET_FILE"; then
        # 创建临时文件用于插入代码
        local temp_file=$(mktemp)

        # 媒体发送代码（使用变量避免转义问题）
        local media_code='        // 先发送媒体（图片/文件）- 由 openclaw-feishu-media-fixer 自动添加
        if (payload.mediaUrls?.length) {
          for (const mediaUrl of payload.mediaUrls) {
            try {
              await sendMediaFeishu({
                cfg,
                to: chatId,
                mediaUrl,
                replyToMessageId,
                accountId,
              });
              params.runtime.log?.(`feishu[${account.accountId}]: sent media: ${mediaUrl}`);
            } catch (error) {
              params.runtime.error?.(
                `feishu[${account.accountId}]: failed to send media ${mediaUrl}: ${String(error)}`,
              );
            }
          }
        }
'

        # 使用 sed 在 deliver 函数后插入代码
        # 先找到 deliver 函数行，然后在下一行插入代码
        local deliver_line=$(grep -n "deliver: async (payload: ReplyPayload, info) => {" "$TARGET_FILE" | head -1 | cut -d: -f1)

        if [[ -n "$deliver_line" ]]; then
            # 创建临时文件
            head -n "$deliver_line" "$TARGET_FILE" > "$temp_file"
            echo "" >> "$temp_file"
            echo "$media_code" >> "$temp_file"
            tail -n +$((deliver_line + 1)) "$TARGET_FILE" >> "$temp_file"
            mv "$temp_file" "$TARGET_FILE"
            log_success "已添加媒体发送逻辑"
        else
            log_error "未找到 deliver 函数"
            rm -f "$temp_file"
            return 1
        fi
    fi

    log_success "修复完成！"
}

# 重启服务
restart_service() {
    log_info "正在重启 OpenClaw Gateway 服务..."

    if systemctl --user is-active openclaw-gateway.service &>/dev/null; then
        systemctl --user restart openclaw-gateway.service

        # 等待服务启动
        local count=0
        while [[ $count -lt 30 ]]; do
            if systemctl --user is-active openclaw-gateway.service &>/dev/null; then
                log_success "服务已重启"
                return 0
            fi
            sleep 1
            ((count++))
        done

        log_warn "服务重启超时，请手动检查"
    else
        log_warn "OpenClaw Gateway 服务未运行"
    fi
}

# 主函数
main() {
    echo ""
    echo "╔════════════════════════════════════════════════════════════╗"
    echo "║     OpenClaw 飞书图片发送修复工具 - 一键安装脚本          ║"
    echo "╚════════════════════════════════════════════════════════════╝"
    echo ""

    # 1. 检测 OpenClaw
    log_info "正在检测 OpenClaw 安装路径..."
    local openclaw_path=$(detect_openclaw_path)

    if [[ -z "$openclaw_path" ]]; then
        log_error "未找到 OpenClaw 安装路径"
        log_info "请确保已安装 OpenClaw: npm install -g openclaw"
        exit 1
    fi

    log_success "找到 OpenClaw: $openclaw_path"

    # 2. 检查版本兼容性
    check_version "$openclaw_path"

    # 3. 检查目标文件
    TARGET_FILE="$openclaw_path/extensions/feishu/src/reply-dispatcher.ts"

    if [[ ! -f "$TARGET_FILE" ]]; then
        log_error "未找到目标文件: $TARGET_FILE"
        exit 1
    fi

    log_success "找到目标文件: $TARGET_FILE"

    # 3. 检查是否已修复
    local status=$(check_if_fixed)

    case "$status" in
        "fixed")
            log_success "OpenClaw 已经修复过了，无需重复操作"
            exit 0
            ;;
        "not_found")
            log_error "目标文件不存在"
            exit 1
            ;;
        "not_fixed")
            log_info "检测到问题，准备修复..."
            ;;
    esac

    # 4. 创建备份
    log_info "正在创建备份..."
    local backup_file=$(create_backup)

    # 5. 应用修复
    apply_fix

    # 6. 验证修复
    log_info "正在验证修复..."
    status=$(check_if_fixed)

    if [[ "$status" == "fixed" ]]; then
        log_success "验证通过！"
    else
        log_error "验证失败，正在恢复备份..."
        cp "$backup_file" "$TARGET_FILE"
        log_info "已恢复原始文件"
        exit 1
    fi

    # 7. 重启服务
    restart_service

    # 8. 完成
    echo ""
    echo "╔════════════════════════════════════════════════════════════╗"
    echo "║                    ✅ 修复成功！                           ║"
    echo "╠════════════════════════════════════════════════════════════╣"
    echo "║  现在可以在飞书中测试发送图片功能了                        ║"
    echo "║                                                            ║"
    echo "║  如需撤销修复，请运行：                                    ║"
    echo "║  cp $backup_file $TARGET_FILE"
    echo "║  systemctl --user restart openclaw-gateway.service         ║"
    echo "╚════════════════════════════════════════════════════════════╝"
    echo ""
}

# 运行主函数
main "$@"
