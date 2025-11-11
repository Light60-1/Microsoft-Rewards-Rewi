import { Page } from 'rebrowser-playwright'
import type { ConfigHumanization } from '../../interface/Config'
import { Util } from '../core/Utils'

export class Humanizer {
  private util: Util
  private cfg: ConfigHumanization | undefined

  constructor(util: Util, cfg?: ConfigHumanization) {
    this.util = util
    this.cfg = cfg
  }

  async microGestures(page: Page): Promise<void> {
    if (this.cfg && this.cfg.enabled === false) return
    const moveProb = this.cfg?.gestureMoveProb ?? 0.4
    const scrollProb = this.cfg?.gestureScrollProb ?? 0.2
    try {
      if (Math.random() < moveProb) {
        const x = Math.floor(Math.random() * 40) + 5
        const y = Math.floor(Math.random() * 30) + 5
        await page.mouse.move(x, y, { steps: 2 }).catch(() => {
          // Mouse move failed - page may be closed or unavailable
        })
      }
      if (Math.random() < scrollProb) {
        const dy = (Math.random() < 0.5 ? 1 : -1) * (Math.floor(Math.random() * 150) + 50)
        await page.mouse.wheel(0, dy).catch(() => {
          // Mouse wheel failed - page may be closed or unavailable
        })
      }
    } catch {
      // Gesture execution failed - not critical for operation
    }
  }

  async actionPause(): Promise<void> {
    if (this.cfg && this.cfg.enabled === false) return
    const defMin = 150
    const defMax = 450
    let min = defMin
    let max = defMax
    if (this.cfg?.actionDelay) {
      const parse = (v: number | string) => {
        if (typeof v === 'number') return v
        try {
          const n = this.util.stringToMs(String(v))
          return Math.max(0, Math.min(n, 10_000))
        } catch (e) {
          // Parse failed - use default minimum
          return defMin
        }
      }
      min = parse(this.cfg.actionDelay.min)
      max = parse(this.cfg.actionDelay.max)
      if (min > max) [min, max] = [max, min]
      max = Math.min(max, 5_000)
    }
    await this.util.wait(this.util.randomNumber(min, max))
  }
}

export default Humanizer
