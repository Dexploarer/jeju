/**
 * Workerd-compatible EventEmitter
 *
 * Uses EventTarget API instead of Node.js EventEmitter for workerd/V8 isolate compatibility
 */

type EventCallback = (data?: unknown) => void

export class WorkerdEventEmitter {
  private target = new EventTarget()
  private listeners = new Map<string, Set<EventCallback>>()

  emit(event: string, data?: unknown): boolean {
    this.target.dispatchEvent(
      new CustomEvent(event, { detail: data }),
    )
    return (this.listeners.get(event)?.size ?? 0) > 0
  }

  on(event: string, callback: EventCallback): this {
    const handler = (e: Event) => callback((e as CustomEvent).detail)
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    this.listeners.get(event)?.add(callback)
    this.target.addEventListener(event, handler)
    return this
  }

  once(event: string, callback: EventCallback): this {
    const handler = (e: Event) => {
      callback((e as CustomEvent).detail)
      this.target.removeEventListener(event, handler)
      this.listeners.get(event)?.delete(callback)
    }
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    this.listeners.get(event)?.add(callback)
    this.target.addEventListener(event, handler, { once: true })
    return this
  }

  removeListener(event: string, callback: EventCallback): this {
    this.listeners.get(event)?.delete(callback)
    return this
  }

  removeAllListeners(event?: string): this {
    if (event) {
      this.listeners.delete(event)
    } else {
      this.listeners.clear()
    }
    return this
  }

  listenerCount(event: string): number {
    return this.listeners.get(event)?.size ?? 0
  }
}
