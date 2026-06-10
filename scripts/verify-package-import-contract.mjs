import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const manifestPath = resolve('pets/mochi/manifest.json')
const productionPath = resolve('pets/mochi/production.json')
const assetStatusPath = resolve('pets/mochi/asset-status.json')

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
const production = JSON.parse(readFileSync(productionPath, 'utf8'))
const assetStatus = JSON.parse(readFileSync(assetStatusPath, 'utf8'))

const requiredJsonAssets = [
  'animations',
  'states',
  'personality',
  'companionContent',
  'appearance',
  'productionProfile',
  'assetStatus',
]

for (const key of requiredJsonAssets) {
  const relativePath = manifest.assets?.[key]
  if (!relativePath) {
    fail(`manifest.json 没有声明 ${key} 资源路径`)
  }

  const diskPath = resolve('pets/mochi', relativePath)
  if (!existsSync(diskPath)) {
    fail(`pets/mochi 中缺少 ${relativePath}`)
  }
}

const atlasPath = manifest.assets?.atlas
const previewPath = manifest.assets?.previewImage

if (!atlasPath) {
  fail('manifest.json 没有声明 atlas 资源路径')
}

if (!previewPath) {
  fail('manifest.json 没有声明 previewImage 资源路径')
}

if (!existsSync(resolve('public/pets/mochi', atlasPath))) {
  fail(`public/pets/mochi 中缺少 ${atlasPath}`)
}

if (!existsSync(resolve('public/pets/mochi', previewPath))) {
  fail(`public/pets/mochi 中缺少 ${previewPath}`)
}

if (production?.atlas?.file !== atlasPath) {
  fail(`production.json 的 atlas.file（${production?.atlas?.file}）与 manifest.json 的 atlas（${atlasPath}）不一致`)
}

if (manifest.name !== 'bb7') {
  fail(`内置宠物名应为 bb7，当前是 ${manifest.name}`)
}

if (manifest.renderer !== 'pixi-atlas') {
  fail(`内置宠物渲染器应为 pixi-atlas，当前是 ${manifest.renderer}`)
}

if (assetStatus?.atlasReady !== true) {
  fail('asset-status.json 没有标记 atlasReady=true')
}

console.log('[deep-pet] package import contract verified')

function fail(message) {
  console.error(`[deep-pet] package import contract verification failed: ${message}`)
  process.exit(1)
}
