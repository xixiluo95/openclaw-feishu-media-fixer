<div align="center">

# 🔧 OpenClaw 飞书图片发送修复工具

**一键修复 OpenClaw 无法发送图片到飞书的问题**

[![Author](https://img.shields.io/badge/Author-RuPengYang-blue?style=for-the-badge&logo=github)](https://github.com/xixiluo95)
[![GitHub](https://img.shields.io/badge/GitHub-Open%20Source-black?style=for-the-badge&logo=github)](https://github.com/xixiluo95/openclaw-feishu-media-fixer)
[![Stars](https://img.shields.io/github/stars/xixiluo95/openclaw-feishu-media-fixer?style=for-the-badge&color=yellow)](https://github.com/xixiluo95/openclaw-feishu-media-fixer/stargazers)
[![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)](LICENSE)

</div>

---

## 👤 作者

**RuPengYang**

- 🔗 GitHub: [@xixiluo95](https://github.com/xixiluo95)
- 📦 仓库: [openclaw-feishu-media-fixer](https://github.com/xixiluo95/openclaw-feishu-media-fixer)
- ⭐ 如果这个项目帮到了你，请点个 Star 支持一下！

---

## 📖 问题说明

OpenClaw 的飞书 channel 在处理 `MEDIA:` 语法时，`reply-dispatcher.ts` 中的 `deliver` 函数只处理 `payload.text`，没有处理 `payload.mediaUrls`，导致图片无法发送到飞书。

---

## 🚀 一键修复

**只需执行一条命令：**

### 使用 curl
```bash
curl -fsSL https://raw.githubusercontent.com/xixiluo95/openclaw-feishu-media-fixer/main/install.sh | bash
```

### 使用 wget
```bash
wget -qO- https://raw.githubusercontent.com/xixiluo95/openclaw-feishu-media-fixer/main/install.sh | bash
```

---

## ✅ 修复过程

脚本会自动完成以下操作：

| 步骤 | 描述 |
|------|------|
| 1️⃣ | 检测 OpenClaw 安装路径 |
| 2️⃣ | 检查是否需要修复 |
| 3️⃣ | 创建备份文件 |
| 4️⃣ | 应用修复补丁 |
| 5️⃣ | 验证修复结果 |
| 6️⃣ | 重启 OpenClaw Gateway 服务 |

---

## 🎉 修复效果

修复后，OpenClaw 可以正确发送图片到飞书：

```
用户: 你随便发送一张图片给我
OpenClaw: 好的主人～ [图片] 这张怎么样？💕
```

---

## ↩️ 撤销修复

如果需要撤销修复，恢复原始代码：

```bash
# 找到最新的备份文件
ls -la ~/.openclaw-feishu-fixer/backups/

# 恢复备份（替换时间戳）
cp ~/.openclaw-feishu-fixer/backups/reply-dispatcher.ts.backup.YYYYMMDD_HHMMSS \
 ~/.npm-global/lib/node_modules/openclaw/extensions/feishu/src/reply-dispatcher.ts

# 重启服务
systemctl --user restart openclaw-gateway.service
```

---

## 🔧 技术细节

### 修复的文件
`~/.npm-global/lib/node_modules/openclaw/extensions/feishu/src/reply-dispatcher.ts`

### 修复内容

1. 添加 import：
```typescript
import { sendMediaFeishu } from "./media.js";
```

2. 在 `deliver` 函数开头添加媒体发送逻辑：
```typescript
// 先发送媒体（图片/文件）
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
```

---

## 💻 兼容性

- ✅ OpenClaw 2026.2.x
- ✅ Linux (systemd)
- ✅ Node.js 18+

---

## 📜 许可证

[MIT](LICENSE) © RuPengYang

---

<div align="center">

**Made with ❤️ by [RuPengYang](https://github.com/xixiluo95)**

</div>
