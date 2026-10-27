import React, { useEffect, useState } from 'react'
import { ShieldCheck, Volume2 } from 'lucide-react'
import { SystemInfoResponse } from '@shared/schemas'

export interface HeaderProps {
  ttsVoiceName?: string
  hasChineseVoice?: boolean
}

export const Header: React.FC<HeaderProps> = ({ ttsVoiceName, hasChineseVoice }) => {
  const [systemInfo, setSystemInfo] = useState<SystemInfoResponse | null>(null)

  useEffect(() => {
    async function loadSystem(): Promise<void> {
      try {
        if (window.api?.system?.getInfo) {
          const res = await window.api.system.getInfo()
          if (res.success) {
            setSystemInfo(res.data)
          }
        }
      } catch (err) {
        console.error('Không thể nạp thông tin hệ thống:', err)
      }
    }
    loadSystem()
  }, [])

  return (
    <header className="flex h-14 items-center justify-between border-b border-slate-200 bg-white px-6 shadow-xs dark:border-slate-800 dark:bg-slate-950 shrink-0 select-none">
      <div className="flex items-center gap-3">
        <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100">
          Tra cứu Từ điển HSK 1–6
        </h2>
        <span className="hidden sm:inline-block rounded-md bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-900">
          Chuẩn HSK 2.0 (5.003 từ)
        </span>
      </div>

      {/* Thông tin môi trường, TTS & Bảo mật */}
      <div className="flex items-center gap-3 text-xs">
        {/* Giọng đọc TTS */}
        <div
          className={`hidden md:flex items-center gap-1.5 rounded-lg border px-2.5 py-1 ${
            hasChineseVoice
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300'
              : 'border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400'
          }`}
          title="Bộ giọng đọc tiếng Trung (Web Speech API)"
        >
          <Volume2 className="h-3.5 w-3.5" />
          <span className="max-w-[140px] truncate">{ttsVoiceName || 'Đang quét TTS...'}</span>
        </div>

        {/* Bảo mật Electron & Storage */}
        {systemInfo && (
          <div
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
            title={`Nền tảng: ${systemInfo.platform} | Backend lưu trữ: ${systemInfo.storage_backend}`}
          >
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
            <span className="hidden lg:inline capitalize">{systemInfo.platform}</span>
            <span className="text-[11px] text-slate-400">Sandbox OK</span>
          </div>
        )}
      </div>
    </header>
  )
}
