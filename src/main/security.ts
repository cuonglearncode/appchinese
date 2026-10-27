import { session, safeStorage, IpcMainInvokeEvent } from 'electron'
import { ZodType, ZodError } from 'zod'
import { IpcResult } from '@shared/schemas'

/**
 * Kiểm tra tính hợp lệ của senderFrame trong các IPC Invocation
 * Đảm bảo chỉ có renderer chính thức từ local dev server hoặc file bundle của app được phép gọi IPC.
 */
export function validateSenderFrame(event: IpcMainInvokeEvent): boolean {
  const frame = event.senderFrame
  if (!frame) {
    console.error('[Bảo mật IPC] Bị từ chối: senderFrame rỗng hoặc không tồn tại.')
    return false
  }

  const urlStr = frame.url
  if (!urlStr) {
    console.error('[Bảo mật IPC] Bị từ chối: senderFrame URL rỗng.')
    return false
  }

  try {
    const parsed = new URL(urlStr)

    // Trong môi trường phát triển (Dev)
    const isDev = process.env.NODE_ENV === 'development' || !!process.env.ELECTRON_RENDERER_URL
    if (isDev) {
      const allowedDevHostnames = ['localhost', '127.0.0.1']
      if (allowedDevHostnames.includes(parsed.hostname) && (parsed.protocol === 'http:' || parsed.protocol === 'https:')) {
        return true
      }
    }

    // Trong môi trường Production (File đóng gói)
    if (parsed.protocol === 'file:') {
      return true
    }

    console.warn(`[Bảo mật IPC] Bị từ chối: Nguồn gọi không hợp lệ từ ${urlStr}`)
    return false
  } catch (err) {
    console.error(`[Bảo mật IPC] Lỗi phân tích cú pháp sender URL ${urlStr}:`, err)
    return false
  }
}

/**
 * Thiết lập Content Security Policy (CSP) nghiêm ngặt
 */
export function setupContentSecurityPolicy(isDev: boolean): void {
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    let cspDirective: string

    if (isDev) {
      // Môi trường dev cần hỗ trợ Vite HMR (WebSocket ws://localhost:* & inline styles)
      cspDirective = [
        "default-src 'self'",
        "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
        "style-src 'self' 'unsafe-inline'",
        "font-src 'self' data:",
        "img-src 'self' data: blob: app-asset:",
        "connect-src 'self' ws://localhost:* http://localhost:* ws://127.0.0.1:* http://127.0.0.1:*",
        "media-src 'self' data: blob:",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'"
      ].join('; ')
    } else {
      // Môi trường production tuyệt đối không cho phép eval hoặc kết nối mạng tùy tiện
      cspDirective = [
        "default-src 'self'",
        "script-src 'self'",
        "style-src 'self' 'unsafe-inline'",
        "font-src 'self' data:",
        "img-src 'self' data: blob: app-asset:",
        "connect-src 'self'",
        "media-src 'self' data: blob:",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'"
      ].join('; ')
    }

    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [cspDirective]
      }
    })
  })
}

/**
 * Kiểm tra trạng thái mã hóa an toàn an toàn của safeStorage (Keychain / Secret Service)
 */
export function checkSafeStorageStatus(): { encryptionAvailable: boolean; backend: string } {
  try {
    const encryptionAvailable = safeStorage.isEncryptionAvailable()
    let backend = 'none'

    if (typeof safeStorage.getSelectedStorageBackend === 'function') {
      backend = safeStorage.getSelectedStorageBackend()
    }

    if (process.platform === 'linux' && backend === 'basic_text') {
      console.warn(
        '[Bảo mật safeStorage] Cảnh báo: Linux đang sử dụng backend "basic_text". Mật khẩu/token sẽ không được mã hóa với libsecret.'
      )
    }

    return {
      encryptionAvailable,
      backend
    }
  } catch (err) {
    console.error('[Bảo mật safeStorage] Lỗi khi kiểm tra safeStorage:', err)
    return {
      encryptionAvailable: false,
      backend: 'error'
    }
  }
}

/**
 * Wrapper an toàn để xử lý IPC handler với xác thực senderFrame và schema Zod
 */
export function createSafeIpcHandler<TReq, TRes>(
  requestSchema: ZodType<TReq, any, any>,
  handler: (payload: TReq, event: IpcMainInvokeEvent) => Promise<TRes> | TRes
): (event: IpcMainInvokeEvent, rawPayload: unknown) => Promise<IpcResult<TRes>>
export function createSafeIpcHandler<TRes>(
  requestSchema: null,
  handler: (payload: void, event: IpcMainInvokeEvent) => Promise<TRes> | TRes
): (event: IpcMainInvokeEvent, rawPayload: unknown) => Promise<IpcResult<TRes>>
export function createSafeIpcHandler<TReq, TRes>(
  requestSchema: ZodType<TReq, any, any> | null,
  handler: (payload: any, event: IpcMainInvokeEvent) => Promise<TRes> | TRes
): (event: IpcMainInvokeEvent, rawPayload: unknown) => Promise<IpcResult<TRes>> {
  return async (event: IpcMainInvokeEvent, rawPayload: unknown): Promise<IpcResult<TRes>> => {
    // 1. Kiểm tra senderFrame
    if (!validateSenderFrame(event)) {
      return {
        success: false,
        error: 'Truy cập IPC bị từ chối: Nguồn gọi không hợp lệ.'
      }
    }

    // 2. Kiểm tra và validate request payload qua Zod
    let validatedPayload: any
    if (requestSchema) {
      const parseResult = requestSchema.safeParse(rawPayload)
      if (!parseResult.success) {
        const zodError = parseResult.error as ZodError
        const formattedError = zodError.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ')
        console.warn('[IPC Validation] Dữ liệu đầu vào không hợp lệ:', formattedError)
        return {
          success: false,
          error: `Dữ liệu yêu cầu không hợp lệ: ${formattedError}`,
          details: zodError.flatten()
        }
      }
      validatedPayload = parseResult.data
    } else {
      validatedPayload = undefined
    }

    // 3. Thực thi nghiệp vụ handler trong try-catch
    try {
      const data = await handler(validatedPayload, event)
      return {
        success: true,
        data
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err)
      console.error('[IPC Handler Error]:', errorMessage)
      return {
        success: false,
        error: errorMessage
      }
    }
  }
}
