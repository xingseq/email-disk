# 邮盘 (email-disk)

邮盘是一个基于邮箱的云盘工具，可以将邮件收件箱作为云存储空间使用。支持通过 CLI 命令行或 Web 界面管理文件。

## 功能特性

- 📧 利用邮箱收件箱作为云存储空间
- 📤 上传文件到云盘
- 📥 下载文件到本地
- 📋 列出云盘中的文件
- 🗑️ 删除云盘文件
- 🌐 支持 Web UI 界面
- 🔧 CLI 命令行操作

## 安装

### 作为 CLI 工具全局安装

```bash
npm install -g @najie/email-cli
```

### 本地开发安装

```bash
git clone <repository>
cd email-cli
npm install
```

## CLI 使用指南

### 全局安装后的使用

安装完成后，可以使用 `najie-email` 命令：

```bash
# 查看帮助
najie-email --help

# 查看版本
najie-email --version
```

### 配置邮箱

在使用前需要先配置邮箱账号信息：

```bash
# 设置邮箱配置
najie-email config set

# 查看当前配置
najie-email config show

# 测试邮箱连接
najie-email config test
```

配置信息包括：
- 邮箱地址
- 邮箱密码/授权码
- SMTP 服务器地址
- IMAP 服务器地址

### 邮盘命令

```bash
# 列出云盘中的文件
najie-email ls

# 上传文件到云盘
najie-email upload <文件路径>

# 从云盘删除文件
najie-email rm <文件UID>
```

### 邮件命令

```bash
# 发送邮件
najie-email send --to <收件人邮箱> --subject <主题> --body <正文> --attach <附件路径>

# 列出收件箱邮件
najie-email list --filter <关键词> --limit <数量>

# 获取邮件详情
najie-email fetch <邮件UID> --output <附件保存目录>
```

### Web UI 服务

```bash
# 启动 Web 界面服务（默认端口 5174）
najie-email serve

# 指定端口启动
najie-email serve -p 8080

# 停止服务
najie-email serve --stop
```

### 本地开发使用

如果不全局安装，也可以在项目目录下使用：

```bash
# 使用 node 直接运行
node bin/najie-email.js --help

# 或使用 npm 脚本
npm run subapp      # 启动服务
npm run subapp:stop # 停止服务
npm run dev         # 同时启动服务和 UI 开发服务器
npm run build       # 构建 UI
```

## 技术栈

- **后端**: Node.js + Express
- **前端**: React + Vite + Tailwind CSS
- **邮件协议**: SMTP / IMAP
- **CLI 框架**: Commander.js

## 系统要求

- Node.js >= 18.0.0

## 许可证

MIT