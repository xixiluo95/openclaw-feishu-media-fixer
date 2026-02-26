# 功能规格：飞书图片发送修复

## 用户故事

**作为** OpenClaw 用户
**我希望** 飞书能正确接收 OpenClaw 发送的图片
**以便** 在飞书中查看 AI 生成的图片

## 功能需求

### F1: 问题检测 (check)
**描述**: 检测当前 OpenClaw 是否存在飞书图片发送问题

**输入**: 无

**输出**:
- 检测结果（有问题/无问题）
- 问题详情（如果有）

**逻辑**:
1. 检查 OpenClaw 是否已安装
2. 定位 `reply-dispatcher.ts` 文件
3. 检查文件是否包含 `sendMediaFeishu` import
4. 检查 `deliver` 函数是否包含媒体发送逻辑
5. 返回检测结果

### F2: 应用修复 (fix)
**描述**: 自动应用修复补丁

**输入**:
- `--no-restart`: 不重启服务（可选）

**输出**:
- 修复结果（成功/失败）
- 备份文件路径

**逻辑**:
1. 验证问题存在（调用 F1）
2. 备份原始文件
3. 应用修复补丁
4. 验证修复成功
5. 重启 OpenClaw Gateway 服务（除非 --no-restart）
6. 返回结果

### F3: 撤销修复 (undo)
**描述**: 恢复原始代码

**输入**:
- `--no-restart`: 不重启服务（可选）

**输出**:
- 撤销结果（成功/失败）

**逻辑**:
1. 检查备份文件是否存在
2. 恢复备份文件
3. 删除备份文件
4. 重启 OpenClaw Gateway 服务（除非 --no-restart）
5. 返回结果

### F4: 查看状态 (status)
**描述**: 显示当前修复状态

**输入**: 无

**输出**:
- 当前状态（已修复/未修复）
- OpenClaw 版本
- 备份文件信息

**逻辑**:
1. 调用 F1 检测问题
2. 显示 OpenClaw 版本
3. 显示备份文件信息（如果存在）
4. 返回结果

## 数据模型

### PatchConfig
```typescript
interface PatchConfig {
  openclawPath: string;      // OpenClaw 安装路径
  targetFile: string;        // 目标文件路径
  backupDir: string;         // 备份目录
}
```

### FixResult
```typescript
interface FixResult {
  success: boolean;          // 是否成功
  message: string;           // 结果消息
  backupPath?: string;       // 备份文件路径
  error?: Error;             // 错误信息
}
```

### CheckResult
```typescript
interface CheckResult {
  hasProblem: boolean;       // 是否有问题
  details: string[];         // 问题详情
  openclawVersion?: string;  // OpenClaw 版本
}
```

## 验收标准

### AC1: 检测功能
- [ ] 能正确检测已修复的 OpenClaw
- [ ] 能正确检测未修复的 OpenClaw
- [ ] 能处理 OpenClaw 未安装的情况

### AC2: 修复功能
- [ ] 能成功应用修复补丁
- [ ] 能正确备份原始文件
- [ ] 修复后 OpenClaw 能发送图片
- [ ] 能处理修复失败的情况

### AC3: 撤销功能
- [ ] 能成功恢复原始代码
- [ ] 撤销后 OpenClaw 恢复原状
- [ ] 能处理撤销失败的情况

### AC4: 状态功能
- [ ] 能正确显示当前状态
- [ ] 能显示 OpenClaw 版本
- [ ] 能显示备份文件信息

## 修复补丁内容

### 需要添加的 import
```typescript
import { sendMediaFeishu } from "./media.js";
```

### 需要添加的代码（在 deliver 函数开头）
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

## 风险评估

| 风险 | 影响 | 可能性 | 缓解措施 |
|------|------|--------|----------|
| OpenClaw 版本不兼容 | 高 | 中 | 版本检测和警告 |
| 文件权限不足 | 中 | 低 | 权限检查和提示 |
| 备份文件丢失 | 中 | 低 | 多重备份机制 |
| 服务重启失败 | 高 | 低 | 提供手动重启指令 |

## 依赖关系

- OpenClaw 2026.2.x
- Node.js 18+
- TypeScript 5+
- systemd (用于服务管理)
