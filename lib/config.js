/**
 * 配置管理模块
 * 使用本地 JSON 文件存储邮箱配置
 */
import { promises as fs } from 'fs'
import path from 'path'
import os from 'os'

// 配置文件路径：~/.najie/email-config.json
const CONFIG_DIR = path.join(os.homedir(), '.najie')
const CONFIG_FILE = path.join(CONFIG_DIR, 'email-config.json')

/**
 * 确保配置目录存在
 */
async function ensureConfigDir() {
  try {
    await fs.mkdir(CONFIG_DIR, { recursive: true })
  } catch (err) {
    if (err.code !== 'EEXIST') throw err
  }
}

/**
 * 读取配置
 * @returns {Promise<object|null>}
 */
export async function loadConfig() {
  try {
    const data = await fs.readFile(CONFIG_FILE, 'utf-8')
    return JSON.parse(data)
  } catch (err) {
    if (err.code === 'ENOENT') return null
    throw err
  }
}

/**
 * 保存配置
 * @param {object} config - 配置对象
 */
export async function saveConfig(config) {
  await ensureConfigDir()
  await fs.writeFile(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8')
}

/**
 * 获取配置文件路径
 * @returns {string}
 */
export function getConfigPath() {
  return CONFIG_FILE
}

/**
 * 配置结构示例
 * {
 *   user: 'xxx@qq.com',
 *   pass: 'xxxxxx',  // 授权码
 *   smtp: { host: 'smtp.qq.com', port: 465, secure: true },
 *   imap: { host: 'imap.qq.com', port: 993, tls: true }
 * }
 */
