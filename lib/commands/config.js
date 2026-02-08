/**
 * config 命令实现
 */
import { Command } from 'commander'
import { loadConfig, saveConfig, getConfigPath } from '../config.js'
import { getPreset, listPresets } from '../presets.js'
import { testSmtp } from '../smtp.js'
import { testImap } from '../imap.js'

export const configCommand = {
  /**
   * najie-email config set
   */
  set: new Command('set')
    .description('设置邮箱配置')
    .requiredOption('--user <email>', '邮箱地址')
    .requiredOption('--pass <password>', '授权码/密码')
    .option('--preset <name>', '使用预设 (qq, 163, gmail, outlook)')
    .option('--smtp-host <host>', 'SMTP 服务器')
    .option('--smtp-port <port>', 'SMTP 端口', parseInt)
    .option('--imap-host <host>', 'IMAP 服务器')
    .option('--imap-port <port>', 'IMAP 端口', parseInt)
    .action(async (options) => {
      try {
        let config = { user: options.user, pass: options.pass }
        
        if (options.preset) {
          const preset = getPreset(options.preset)
          if (!preset) {
            console.error(`错误: 未知预设 "${options.preset}"`)
            console.log(`可用预设: ${listPresets().join(', ')}`)
            process.exit(1)
          }
          config.smtp = preset.smtp
          config.imap = preset.imap
          console.log(`使用预设: ${preset.name}`)
        } else {
          // 手动配置
          if (!options.smtpHost || !options.imapHost) {
            console.error('错误: 需要指定 --preset 或完整的 SMTP/IMAP 配置')
            process.exit(1)
          }
          config.smtp = {
            host: options.smtpHost,
            port: options.smtpPort || 465,
            secure: (options.smtpPort || 465) === 465
          }
          config.imap = {
            host: options.imapHost,
            port: options.imapPort || 993,
            tls: true
          }
        }
        
        await saveConfig(config)
        console.log(`配置已保存到: ${getConfigPath()}`)
      } catch (err) {
        console.error('保存配置失败:', err.message)
        process.exit(1)
      }
    }),

  /**
   * najie-email config show
   */
  show: new Command('show')
    .description('显示当前配置')
    .action(async () => {
      const config = await loadConfig()
      if (!config) {
        console.log('尚未配置，请先运行: najie-email config set')
        return
      }
      console.log('当前配置:')
      console.log(`  邮箱: ${config.user}`)
      console.log(`  SMTP: ${config.smtp.host}:${config.smtp.port}`)
      console.log(`  IMAP: ${config.imap.host}:${config.imap.port}`)
      console.log(`\n配置文件: ${getConfigPath()}`)
    }),

  /**
   * najie-email config test
   */
  test: new Command('test')
    .description('测试 SMTP/IMAP 连接')
    .action(async () => {
      const config = await loadConfig()
      if (!config) {
        console.log('尚未配置，请先运行: najie-email config set')
        process.exit(1)
      }

      console.log('测试 SMTP 连接...')
      const smtpResult = await testSmtp(config)
      console.log(smtpResult.success ? '  ✓ SMTP 连接成功' : `  ✗ SMTP 失败: ${smtpResult.error}`)

      console.log('测试 IMAP 连接...')
      const imapResult = await testImap(config)
      console.log(imapResult.success ? '  ✓ IMAP 连接成功' : `  ✗ IMAP 失败: ${imapResult.error}`)
    })
}
