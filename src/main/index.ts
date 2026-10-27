import { app, shell, BrowserWindow } from 'electron'
import { join } from 'path'
import * as fs from 'fs'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { setupContentSecurityPolicy, checkSafeStorageStatus } from './security'
import { registerIpcHandlers } from './ipc-handlers'
import { ensureSqliteDatabase, closeSqliteDatabase } from './database/sqlite-db'

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  const preloadPath = [
    join(__dirname, '../preload/index.mjs'),
    join(__dirname, '../preload/index.js')
  ].find((p) => fs.existsSync(p)) || join(__dirname, '../preload/index.mjs')

  // 1. Khởi tạo BrowserWindow với cấu hình bảo mật nghiêm ngặt
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 960,
    minHeight: 640,
    show: false,
    autoHideMenuBar: true,
    title: 'Ứng dụng Học Tiếng Trung HSK 1-6',
    webPreferences: {
      preload: preloadPath,
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
      allowRunningInsecureContent: false
    }
  })

  // 2. Chỉ hiển thị cửa sổ khi nội dung đã sẵn sàng (chống nhấp nháy trắng)
  mainWindow.on('ready-to-show', () => {
    if (mainWindow) {
      mainWindow.show()
    }
  })

  // 3. Chặn mở cửa sổ mới trái phép (XSS protection)
  mainWindow.webContents.setWindowOpenHandler((details) => {
    // Chỉ cho phép mở các liên kết bên ngoài qua trình duyệt mặc định của OS nếu là giao thức an toàn
    if (details.url.startsWith('https://') || details.url.startsWith('http://')) {
      shell.openExternal(details.url)
    }
    return { action: 'deny' }
  })

  // 4. Chặn điều hướng trang trái phép trong webContents
  mainWindow.webContents.on('will-navigate', (event, navigationUrl) => {
    const parsedUrl = new URL(navigationUrl)
    const isDev = is.dev && process.env['ELECTRON_RENDERER_URL']

    if (isDev) {
      const allowedDevHosts = ['localhost', '127.0.0.1']
      if (allowedDevHosts.includes(parsedUrl.hostname)) {
        return
      }
    } else {
      if (parsedUrl.protocol === 'file:') {
        return
      }
    }

    // Chặn mọi URL ngoài phạm vi ứng dụng
    event.preventDefault()
    console.warn(`[Bảo mật] Đã chặn điều hướng đến URL trái phép: ${navigationUrl}`)
  })

  // 5. Nạp URL giao diện (Dev server hoặc file tĩnh HTML)
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// 6. Kiểm tra Single Instance Lock (Đảm bảo chỉ có 1 tiến trình ứng dụng chạy)
const gotTheLock = app.requestSingleInstanceLock()
if (!gotTheLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })

  // Khởi động ứng dụng khi Electron sẵn sàng
  app.whenReady().then(async () => {
    // Đặt App User Model Id cho Windows notifications
    electronApp.setAppUserModelId('com.appchinese.desktop')

    // Tối ưu phím tắt F12 trong dev và chặn reload không mong muốn
    app.on('browser-window-created', (_, window) => {
      optimizer.watchWindowShortcuts(window)
    })

    // Thiết lập Content Security Policy
    setupContentSecurityPolicy(is.dev)

    // Khởi tạo Database SQLite cục bộ (100% Offline, không phụ thuộc MySQL service)
    try {
      ensureSqliteDatabase()
      console.info('[Khởi động] Database SQLite cục bộ đã sẵn sàng.')
    } catch (dbErr) {
      console.error('[Khởi động] Cảnh báo kết nối Database SQLite:', dbErr)
    }

    // Đăng ký toàn bộ IPC handlers an toàn
    registerIpcHandlers()

    // Kiểm tra tính sẵn sàng của Keychain / safeStorage
    const storageInfo = checkSafeStorageStatus()
    console.info(
      `[Khởi động] safeStorage Encryption Available: ${storageInfo.encryptionAvailable}, Backend: ${storageInfo.backend}`
    )

    createWindow()

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })

  app.on('window-all-closed', () => {
    closeSqliteDatabase()
    if (process.platform !== 'darwin') {
      app.quit()
    }
  })
}
