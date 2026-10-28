import '@testing-library/jest-dom/vitest'
import { instalarMensajesZod } from '@/lib/mensajesZod'

// Igual que main.tsx: las pruebas ven los mensajes de validación en español.
instalarMensajesZod()

/**
 * jsdom no implementa estas APIs de navegador que usa el prototipo
 * (recharts, scrollIntoView y el observer de IntersectionObserver).
 */
if (!window.matchMedia) {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia
}

if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {}
}

if (!globalThis.ResizeObserver) {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver
}
