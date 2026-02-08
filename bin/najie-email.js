#!/usr/bin/env node
/**
 * najie-email CLI 入口
 * 邮盘 - 邮箱云盘工具
 */
import { Command } from 'commander'
import { configCommand } from '../lib/commands/config.js'
import { sendCommand } from '../lib/commands/send.js'
import { listCommand } from '../lib/commands/list.js'
import { listJsonCommand } from '../lib/commands/list-json.js'
import { fetchCommand } from '../lib/commands/fetch.js'
import { createServer } from '../lib/server.js'
import { listFiles, uploadFile, deleteFile } from '../lib/disk.js'
import { readFileSync } from 'fs'
import { resolve } from 'path'

import { exec } from 'child_process'

const program = new Command()

program
  .name('najie-email')
  .description('邮盘 - 邮箱云盘工具')
  .version('0.1.0')

// 配置命令组
const config = new Command('config').description('管理邮箱配置')
config.addCommand(configCommand.set)
config.addCommand(configCommand.show)
config.addCommand(configCommand.test)
program.addCommand(config)

// 发送命令
program
  .command('send')
  .description('发送邮件')
  .requiredOption('--to <email>', '收件人邮箱')
  .option('--subject <subject>', '邮件主题', '(无主题)')
  .option('--body <body>', '邮件正文', '')
  .option('--attach <file>', '附件路径')
  .action(sendCommand)

// 列表命令  
program
  .command('list')
  .description('列出收件箱邮件')
  .option('--filter <keyword>', '按主题关键词过滤')
  .option('--limit <n>', '显示数量', '10')
  .action(listCommand)

// 列表命令（JSON 输出，供主应用调用）
program
  .command('list-json')
  .description('列出收件箱邮件（JSON 输出）')
  .option('--filter <keyword>', '按主题关键词过滤')
  .option('--limit <n>', '显示数量', '20')
  .action(listJsonCommand)

// 获取邮件命令（JSON 输出，供主应用调用）
program
  .command('fetch <uid>')
  .description('获取邮件详情和附件（JSON 输出）')
  .option('--output <dir>', '附件保存目录')
  .action(fetchCommand)

// ==================== 邮盘命令 ====================

// 启动 Web UI 服务
program
  .command('serve')
  .description('启动邮盘 Web 界面')
  .option('-p, --port <port>', '端口号', '5174')
  .option('--stop', '停止服务')
  .action(async (options) => {
    const port = parseInt(options.port)
    
    if (options.stop) {
      // 停止服务：杀死占用端口的进程
      console.log(`正在停止端口 ${port} 上的服务...`)
      const isWin = process.platform === 'win32'
      const cmd = isWin
        ? `for /f "tokens=5" %a in ('netstat -aon ^| findstr :${port}') do taskkill /F /PID %a`
        : `lsof -ti:${port} | xargs kill -9 2>/dev/null || true`
      
      exec(cmd, (err) => {
        if (err) {
          console.log('服务可能未运行或已停止')
        } else {
          console.log('服务已停止')
        }
        process.exit(0)
      })
    } else {
      createServer(port)
    }
  })

// 列出云盘文件
program
  .command('ls')
  .description('列出云盘中的文件')
  .action(async () => {
    try {
      const files = await listFiles()
      if (files.length === 0) {
        console.log('云盘为空')
        return
      }
      console.log('\n文件列表：')
      files.forEach(f => {
        const size = f.size ? `${(f.size / 1024).toFixed(1)}KB` : '-'
        console.log(`  ${f.name}  [${size}]  ${new Date(f.date).toLocaleString()}`)
      })
      console.log(`\n共 ${files.length} 个文件`)
    } catch (err) {
      console.error('错误:', err.message)
    }
  })

// 上传文件
program
  .command('upload <file>')
  .description('上传文件到云盘')
  .action(async (file) => {
    try {
      const filepath = resolve(file)
      const data = readFileSync(filepath)
      const filename = filepath.split('/').pop()
      console.log(`上传中: ${filename}...`)
      await uploadFile(data, filename)
      console.log('上传成功!')
    } catch (err) {
      console.error('上传失败:', err.message)
    }
  })

// 删除文件
program
  .command('rm <uid>')
  .description('从云盘删除文件')
  .action(async (uid) => {
    try {
      await deleteFile(uid)
      console.log('删除成功')
    } catch (err) {
      console.error('删除失败:', err.message)
    }
  })

program.parse()
