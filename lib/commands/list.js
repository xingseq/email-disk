/**
 * list 命令实现
 */
import { loadConfig } from '../config.js'
import { listEmails } from '../imap.js'

/**
 * 列出邮件命令
 * @param {object} options - 命令选项
 */
export async function listCommand(options) {
  const config = await loadConfig()
  if (!config) {
    console.error('尚未配置邮箱，请先运行: najie-email config set')
    process.exit(1)
  }

  console.log('正在获取邮件列表...\n')
  
  const result = await listEmails(config, {
    filter: options.filter,
    limit: parseInt(options.limit)
  })

  if (!result.success) {
    console.error(`获取失败: ${result.error}`)
    process.exit(1)
  }

  if (result.emails.length === 0) {
    console.log('没有找到邮件')
    return
  }

  // 格式化输出
  console.log(`找到 ${result.emails.length} 封邮件:\n`)
  result.emails.forEach((email, index) => {
    console.log(`[${index + 1}] UID: ${email.uid}`)
    console.log(`    主题: ${email.subject || '(无主题)'}`)
    console.log(`    发件人: ${email.from || '(未知)'}`)
    console.log(`    日期: ${email.date || '(未知)'}`)
    console.log('')
  })
}
