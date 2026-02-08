/**
 * fetch 命令实现
 * 获取邮件附件并保存到文件，供主应用通过 CLI 调用
 */
import { loadConfig } from '../config.js'
import { fetchEmail } from '../imap.js'
import { writeFileSync } from 'fs'
import { resolve, join } from 'path'

/**
 * 获取邮件附件命令
 * @param {string} uid - 邮件 UID
 * @param {object} options - 命令选项
 */
export async function fetchCommand(uid, options) {
  try {
    const config = await loadConfig()
    if (!config) {
      console.log(JSON.stringify({
        success: false,
        error: '尚未配置邮箱，请先运行: najie-email config set'
      }))
      process.exit(1)
    }

    const uidNumber = parseInt(uid)
    if (isNaN(uidNumber)) {
      console.log(JSON.stringify({
        success: false,
        error: '无效的邮件 UID'
      }))
      process.exit(1)
    }

    const result = await fetchEmail(config, uidNumber)

    if (!result.success) {
      console.log(JSON.stringify({
        success: false,
        error: result.error
      }))
      process.exit(1)
    }

    const email = result.email

    // 如果指定了输出目录，保存附件到文件
    if (options.output) {
      const outputDir = resolve(options.output)
      const savedAttachments = []

      if (email.attachments && email.attachments.length > 0) {
        for (const attachment of email.attachments) {
          const outputPath = join(outputDir, attachment.filename)
          writeFileSync(outputPath, attachment.content)
          savedAttachments.push({
            filename: attachment.filename,
            path: outputPath,
            size: attachment.size,
            contentType: attachment.contentType
          })
        }
      }

      console.log(JSON.stringify({
        success: true,
        email: {
          from: email.from,
          to: email.to,
          subject: email.subject,
          date: email.date
        },
        attachments: savedAttachments
      }))
    } else {
      // 不指定输出时，将附件内容转为 base64 输出
      const attachmentsWithBase64 = email.attachments?.map(a => ({
        filename: a.filename,
        contentType: a.contentType,
        size: a.size,
        content: a.content.toString('base64')
      })) || []

      console.log(JSON.stringify({
        success: true,
        email: {
          from: email.from,
          to: email.to,
          subject: email.subject,
          date: email.date,
          text: email.text
        },
        attachments: attachmentsWithBase64
      }))
    }
  } catch (error) {
    console.log(JSON.stringify({
      success: false,
      error: error.message
    }))
    process.exit(1)
  }
}
