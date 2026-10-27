import { ElectronAPI } from '../shared/ipc-contracts'

declare global {
  interface Window {
    api: ElectronAPI
  }
}
