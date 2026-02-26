# 技术方案：飞书图片发送修复工具

## 1. 架构设计

```
openclaw-feishu-media-fixer/
├── src/
│   ├── index.ts              # 入口文件
│   ├── commands/
│   │   ├── check.ts          # 检测命令
│   │   ├── fix.ts            # 修复命令
│   │   ├── undo.ts           # 撤销命令
│   │   └── status.ts         # 状态命令
│   ├── core/
│   │   ├── detector.ts       # 问题检测器
│   │   ├── patcher.ts        # 补丁应用器
│   │   └── backup.ts         # 备份管理器
│   ├── utils/
│   │   ├── logger.ts         # 日志工具
│   │   ├── file.ts           # 文件工具
│   │   └── service.ts        # 服务管理
│   └── types/
│       └── index.ts          # 类型定义
├── bin/
│   └── openclaw-feishu-fixer # 可执行脚本
├── tests/
│   ├── detector.test.ts
│   ├── patcher.test.ts
│   └── integration.test.ts
├── package.json
├── tsconfig.json
└── README.md
```

## 2. 技术选型

### 2.1 核心技术
| 技术 | 版本 | 用途 |
|------|------|------|
| TypeScript | 5.x | 核心语言 |
| Node.js | 18+ | 运行环境 |
| Commander | 11.x | CLI 框架 |
| Chalk | 5.x | 终端颜色 |

### 2.2 开发工具
| 工具 | 用途 |
|------|------|
| Jest | 单元测试 |
| ts-node | TypeScript 执行 |
| esbuild | 打包构建 |

## 3. 核心模块设计

### 3.1 问题检测器 (detector.ts)
```typescript
class ProblemDetector {
  // 检测问题
  async check(): Promise<CheckResult>;

  // 定位目标文件
  private locateTargetFile(): string | null;

  // 检查是否已修复
  private checkIfFixed(content: string): boolean;
}
```

### 3.2 补丁应用器 (patcher.ts)
```typescript
class Patcher {
  // 应用修复
  async apply(config: PatchConfig): Promise<FixResult>;

  // 添加 import
  private addImport(content: string): string;

  // 添加媒体发送逻辑
  private addMediaLogic(content: string): string;

  // 验证修复
  private verify(content: string): boolean;
}
```

### 3.3 备份管理器 (backup.ts)
```typescript
class BackupManager {
  // 创建备份
  async create(filePath: string): Promise<string>;

  // 恢复备份
  async restore(backupPath: string, targetPath: string): Promise<void>;

  // 列出备份
  async list(): Promise<string[]>;

  // 清理旧备份
  async cleanup(maxAge: number): Promise<void>;
}
```

## 4. 补丁策略

### 4.1 检测点
```typescript
// 检测是否已添加 import
const importPattern = /import\s+\{\s*sendMediaFeishu\s*\}\s+from\s+["']\.\/media\.js["']/;

// 检测是否已添加媒体发送逻辑
const mediaLogicPattern = /if\s*\(payload\.mediaUrls\?\.\length\)/;
```

### 4.2 补丁位置
```typescript
// import 添加位置：在 send.js 导入之后
const importAnchor = /import\s+\{\s*sendMarkdownCardFeishu.*\}\s+from\s+["']\.\/send\.js[""]/;

// 媒体逻辑添加位置：在 deliver 函数开头
const deliverAnchor = /deliver:\s*async\s*\(payload:\s*ReplyPayload/;
```

## 5. 服务管理

### 5.1 检查服务状态
```bash
systemctl --user is-active openclaw-gateway.service
```

### 5.2 重启服务
```bash
systemctl --user restart openclaw-gateway.service
```

### 5.3 等待服务就绪
```bash
# 等待服务启动，最多 30 秒
for i in {1..30}; do
  if systemctl --user is-active openclaw-gateway.service &>/dev/null; then
    break
  fi
  sleep 1
done
```

## 6. 错误处理

### 6.1 错误类型
```typescript
enum FixerError {
  OPENCLAW_NOT_FOUND = 'OPENCLAW_NOT_FOUND',
  FILE_NOT_FOUND = 'FILE_NOT_FOUND',
  ALREADY_FIXED = 'ALREADY_FIXED',
  NOT_FIXED = 'NOT_FIXED',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  PATCH_FAILED = 'PATCH_FAILED',
  SERVICE_ERROR = 'SERVICE_ERROR',
}
```

### 6.2 错误恢复
- 补丁失败时自动恢复备份
- 服务重启失败时提示手动操作
- 提供详细的错误诊断信息

## 7. 实现步骤

### Phase 1: 核心框架 (1天)
1. 项目初始化
2. 类型定义
3. 日志工具
4. CLI 框架

### Phase 2: 检测功能 (0.5天)
1. 问题检测器
2. check 命令

### Phase 3: 修复功能 (1天)
1. 备份管理器
2. 补丁应用器
3. fix 命令
4. undo 命令

### Phase 4: 测试与文档 (0.5天)
1. 单元测试
2. 集成测试
3. README 文档
4. 使用示例

## 8. 风险缓解

### 8.1 版本兼容性
- 检测 OpenClaw 版本
- 版本不匹配时发出警告
- 提供强制执行选项

### 8.2 文件安全
- 修改前必须备份
- 备份文件包含时间戳
- 保留多个历史备份

### 8.3 服务稳定性
- 重启前检查服务状态
- 重启后验证服务可用
- 提供回滚机制
