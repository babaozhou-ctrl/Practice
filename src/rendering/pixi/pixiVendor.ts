export type PixiNamespace = any

const PIXI_SCRIPT_SELECTOR = 'script[data-deep-pet-pixi-vendor]'

let pixiLoadPromise: Promise<PixiNamespace> | null = null

export async function ensurePixiLoaded(): Promise<PixiNamespace> {
  if (window.PIXI) {
    return window.PIXI
  }

  if (!pixiLoadPromise) {
    pixiLoadPromise = new Promise<PixiNamespace>((resolve, reject) => {
      const existing = document.querySelector<HTMLScriptElement>(PIXI_SCRIPT_SELECTOR)
      if (existing) {
        attachListeners(existing, resolve, reject)
        return
      }

      const script = document.createElement('script')
      script.src = new URL('./vendor/pixi/pixi.min.js', window.location.href).toString()
      script.async = false
      script.dataset.deepPetPixiVendor = 'true'
      attachListeners(script, resolve, reject)
      document.head.appendChild(script)
    })
  }

  return pixiLoadPromise
}

export function getPixi(): PixiNamespace {
  if (!window.PIXI) {
    throw new Error('PixiJS has not been loaded yet.')
  }

  return window.PIXI
}

function attachListeners(
  script: HTMLScriptElement,
  resolve: (value: PixiNamespace) => void,
  reject: (reason?: unknown) => void,
) {
  const onLoad = () => {
    if (window.PIXI) {
      resolve(window.PIXI)
      return
    }

    reject(new Error('PixiJS script loaded but global namespace is missing.'))
  }

  const onError = () => {
    reject(new Error(`Failed to load PixiJS from ${script.src}`))
  }

  script.addEventListener('load', onLoad, { once: true })
  script.addEventListener('error', onError, { once: true })
}
