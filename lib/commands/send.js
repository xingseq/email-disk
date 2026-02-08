/**
 * send 命令实现
 */
import { loadConfig } from '../config.js'
import { sendEmail } from '../smtp.js'

/**
 * 发送邮件命令
 * @param {object} options - 命令选项
 */
export async function sendCommand(options) {
  const config = await loadConfig()
  if (!config) {
    console.error('尚未配置邮箱，请先运行: najie-email config set')
    process.exit(1)
  }

  console.log(`发送邮件到: ${options.to}`)
  
  const result = await sendEmail(config, {
    to: options.to,
    subject: options.subject,
    body: options.body,
    attachPath: options.attach
  })

  if (result.success) {
    console.log(`✓ 发送成功! MessageId: ${result.messageId}`)
  } else {
    console.error(`✗ 发送失败: ${result.error}`)
    process.exit(1)
  }
}
