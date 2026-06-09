export type PixiNamespace = any

const PIXI_SCRIPT_SELECTOR = 'script[data-deep-pet-pixi-vendor]'
const PIXI_UNSAFE_EVAL_SCRIPT_SELECTOR = 'script[data-deep-pet-pixi-unsafe-eval]'

let pixiLoadPromise: Promise<PixiNamespace> | null = null

export async function ensurePixiLoaded(): Promise<PixiNamespace> {
  if (window.PIXI) {
    return window.PIXI
  }

  if (!pixiLoadPromise) {
    pixiLoadPromise = new Promise<PixiNamespace>((resolve, reject) => {
      void ensurePixiScriptsSequentially()
        .then(() => {
          if (window.PIXI) {
            resolve(window.PIXI)
            return
          }

          reject(new Error('PixiJS scripts loaded but global namespace is missing.'))
        })
        .catch(reject)
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
  reject: (reason?: unknown) => void,
) {
  const onError = () => {
    reject(new Error(`Failed to load PixiJS from ${script.src}`))
  }

  script.addEventListener('error', onError, { once: true })
}

async function ensurePixiScriptsSequentially(): Promise<void> {
  await ensureScriptLoaded({
    selector: PIXI_SCRIPT_SELECTOR,
    src: './vendor/pixi/pixi.min.js',
    datasetKey: 'deepPetPixiVendor',
  })

  await ensureScriptLoaded({
    selector: PIXI_UNSAFE_EVAL_SCRIPT_SELECTOR,
    src: './vendor/pixi/unsafe-eval.min.js',
    datasetKey: 'deepPetPixiUnsafeEval',
  })
}

async function ensureScriptLoaded({
  selector,
  src,
  datasetKey,
}: {
  selector: string
  src: string
  datasetKey: string
}): Promise<void> {
  const existing = document.querySelector<HTMLScriptElement>(selector)
  if (existing) {
    if (hasScriptLoaded(existing)) {
      return
    }

    await waitForScriptLoad(existing)
    return
  }

  const script = document.createElement('script')
  script.src = new URL(src, window.location.href).toString()
  script.async = false
  script.dataset[datasetKey] = 'true'
  document.head.appendChild(script)
  await waitForScriptLoad(script)
}

function waitForScriptLoad(script: HTMLScriptElement): Promise<void> {
  if (hasScriptLoaded(script)) {
    return Promise.resolve()
  }

  return new Promise<void>((resolve, reject) => {
    const onLoad = () => {
      script.dataset.deepPetLoaded = 'true'
      resolve()
    }

    attachListeners(script, reject)
    script.addEventListener('load', onLoad, { once: true })
  })
}

function hasScriptLoaded(script: HTMLScriptElement): boolean {
  return script.dataset.deepPetLoaded === 'true'
}
