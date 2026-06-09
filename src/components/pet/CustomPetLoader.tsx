import React, { useCallback, useRef, useState } from 'react'
import { createMochiSprite } from '../../engine/PixelMochi'
import { usePetStore } from '../../store/petStore'
import {
  buildSpriteFromFrames,
  loadSpriteSheet,
  parsePetConfig,
  type PetAssetConfig,
} from '../../engine/CustomPetParser'
import {
  buildImportedPetRecordFromSprite,
  persistImportedPetRecord,
  type PersistImportedPetPayload,
} from '../../pets/ImportedPetRegistry'
import { buildImportedPetPayloadFromPackageFiles } from '../../pets/packageImport'
import { useSelectedPetStore } from '../../store/selectedPetStore'

interface Props {
  onClose: () => void
}

type LoaderStatus = 'idle' | 'loading' | 'loaded' | 'error'

const CustomPetLoader: React.FC<Props> = ({ onClose }) => {
  const [dragOver, setDragOver] = useState(false)
  const [status, setStatus] = useState<LoaderStatus>('idle')
  const [message, setMessage] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const setCustomPet = usePetStore((s) => s.setCustomPet)
  const selectPet = useSelectedPetStore((s) => s.selectPet)
  const refreshCatalog = useSelectedPetStore((s) => s.refreshCatalog)

  const processFiles = useCallback(async (files: File[]) => {
    if (files.length === 0) {
      setMessage('没有检测到可导入的文件。')
      setStatus('error')
      return
    }

    setStatus('loading')

    try {
      const payload = await buildImportPayload(files, setMessage)
      await persistImportedPetRecord(payload)
      refreshCatalog()
      selectPet(payload.id)
      setCustomPet(null)
      setMessage(`已把“${payload.name}”接进来了，现在它已经成为当前陪伴角色。`)
      setStatus('loaded')
    } catch (err) {
      const nextMessage = err instanceof Error ? err.message : '导入失败。'
      setMessage(nextMessage)
      setStatus('error')
    }
  }, [refreshCatalog, selectPet, setCustomPet])

  const handleDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setDragOver(false)
    processFiles(Array.from(event.dataTransfer.files))
  }, [processFiles])

  const handleFileInput = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      processFiles(Array.from(event.target.files))
    }
  }, [processFiles])

  const resetPreview = useCallback(() => {
    setCustomPet(null)
    setStatus('idle')
    setMessage('')
  }, [setCustomPet])

  React.useEffect(() => {
    let cancelled = false

    void (async () => {
      const flags = await window.electronAPI?.getRuntimeFlags?.()
      if (cancelled || flags?.smokeTarget !== 'import') {
        return
      }

      setStatus('loading')
      setMessage('正在模拟导入一只新的陪伴角色。')

      try {
        const payload = await buildImportedPetRecordFromSprite({
          name: 'bb7-smoke-import',
          spriteDefinition: createMochiSprite().definition,
        })

        await persistImportedPetRecord(payload)
        refreshCatalog()
        selectPet(payload.id)
        setCustomPet(null)
        setMessage(`已把“${payload.name}”接进来了，现在它已经成为当前陪伴角色。`)
        setStatus('loaded')

        window.setTimeout(() => {
          if (!cancelled && useSelectedPetStore.getState().selectedPetId === payload.id) {
            window.electronAPI?.emitSmokeCheckpoint?.('import-ready')
          }
        }, 80)
      } catch (error) {
        if (cancelled) {
          return
        }

        const nextMessage = error instanceof Error ? error.message : '导入 smoke 失败。'
        setMessage(nextMessage)
        setStatus('error')
      }
    })()

    return () => {
      cancelled = true
    }
  }, [refreshCatalog, selectPet, setCustomPet])

  const statusTone =
    status === 'loaded' ? '#8fc5ab' : status === 'error' ? '#e7a0a0' : status === 'loading' ? '#8ec5ec' : '#efb36a'

  const overlayStyle: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    background:
      'radial-gradient(circle at 18% 12%, rgba(255, 219, 204, 0.18), transparent 30%), radial-gradient(circle at 82% 14%, rgba(176, 211, 239, 0.18), transparent 26%), rgba(14, 24, 36, 0.72)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10001,
    backdropFilter: 'blur(18px)',
    padding: '14px',
  }

  const modalStyle: React.CSSProperties = {
    width: 'min(560px, calc(100vw - 24px))',
    padding: '22px',
    borderRadius: '28px',
    background:
      'linear-gradient(180deg, rgba(255, 252, 248, 0.98), rgba(247, 250, 255, 0.96) 44%, rgba(241, 247, 253, 0.98))',
    border: dragOver ? '1.5px solid rgba(142, 197, 236, 0.42)' : '1px solid rgba(162, 194, 221, 0.24)',
    boxShadow: '0 28px 80px rgba(23, 38, 52, 0.34)',
    color: '#49657f',
    position: 'relative',
    overflow: 'hidden',
  }

  const cardStyle: React.CSSProperties = {
    padding: '14px',
    borderRadius: '20px',
    background: 'rgba(255,255,255,0.68)',
    border: '1px solid rgba(138, 191, 230, 0.12)',
    boxShadow: '0 12px 28px rgba(120, 153, 181, 0.06)',
  }

  const dropZoneStyle: React.CSSProperties = {
    ...cardStyle,
    padding: '26px 20px',
    border: dragOver ? '1.5px dashed rgba(142, 197, 236, 0.48)' : '1px dashed rgba(138, 191, 230, 0.2)',
    background: status === 'loading'
      ? 'linear-gradient(180deg, rgba(240,249,255,0.82), rgba(255,255,255,0.7))'
      : 'linear-gradient(180deg, rgba(255,255,255,0.78), rgba(244,248,254,0.72))',
    cursor: 'pointer',
    transition: 'all 180ms ease',
  }

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div
        style={modalStyle}
        onClick={(event) => event.stopPropagation()}
        onDragOver={(event) => {
          event.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
      >
        <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.28em', color: 'rgba(104,132,157,0.58)', marginBottom: '6px' }}>
          Pet Import
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'flex-start', marginBottom: '16px' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '24px', fontWeight: 700, color: '#425a73' }}>导入新的陪伴角色</h3>
            <p style={{ margin: '10px 0 0', fontSize: '13px', lineHeight: 1.7, color: 'rgba(93,118,142,0.8)', maxWidth: '420px' }}>
              把完整宠物包或旧版 sprite 配置交给我，我会尽量把它原本的样子、动画和性格一起接进来。
            </p>
          </div>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '8px 10px',
              borderRadius: '999px',
              background: 'rgba(255,255,255,0.74)',
              border: '1px solid rgba(138,191,230,0.14)',
              color: '#64819a',
              fontSize: '11px',
              fontWeight: 700,
            }}
          >
            当前状态 · {status === 'idle' ? '等待导入' : status === 'loading' ? '整理中' : status === 'loaded' ? '已接入' : '需要处理'}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.1fr) minmax(220px, 0.9fr)', gap: '14px', marginBottom: '14px' }}>
          <div style={dropZoneStyle} onClick={() => fileInputRef.current?.click()}>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,.png,.jpg,.jpeg,.webp"
              multiple
              style={{ display: 'none' }}
              onChange={handleFileInput}
            />
            {status === 'idle' && (
              <div>
                <div style={{ fontSize: '15px', fontWeight: 700, color: '#4f6880', marginBottom: '8px' }}>
                  把宠物包拖进来，或点击选择文件
                </div>
                <div style={{ fontSize: '12px', lineHeight: 1.7, color: 'rgba(92,118,143,0.78)' }}>
                  最顺手的方式，是把同一个宠物目录里的文件一起拖进来。完整宠物包会保留更多角色感。
                </div>
              </div>
            )}

            {status === 'loading' && (
              <div style={{ fontSize: '13px', lineHeight: 1.75, color: '#56728b' }}>
                {message || '正在把新伙伴接进来...'}
              </div>
            )}

            {status === 'loaded' && (
              <div style={{ fontSize: '13px', lineHeight: 1.75, color: '#5e8571' }}>
                {message}
              </div>
            )}

            {status === 'error' && (
              <div style={{ fontSize: '13px', lineHeight: 1.75, color: '#a26f6f' }}>
                {message}
              </div>
            )}
          </div>

          <div style={{ display: 'grid', gap: '10px' }}>
            <div style={cardStyle}>
              <div style={{ fontSize: '11px', color: 'rgba(103,128,151,0.66)', marginBottom: '6px' }}>建议方式</div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#4f6880', marginBottom: '4px' }}>优先导入完整宠物包</div>
              <div style={{ fontSize: '12px', lineHeight: 1.65, color: 'rgba(92,118,143,0.82)' }}>
                会一起保留动画、personality、companion-content 和 atlas 资源。
              </div>
            </div>
            <div style={cardStyle}>
              <div style={{ fontSize: '11px', color: 'rgba(103,128,151,0.66)', marginBottom: '6px' }}>兼容旧资源</div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#4f6880', marginBottom: '4px' }}>旧版 JSON + PNG 也能导入</div>
              <div style={{ fontSize: '12px', lineHeight: 1.65, color: 'rgba(92,118,143,0.82)' }}>
                如果是旧资源，我会先替它套上一套默认陪伴人格和互动内容。
              </div>
            </div>
          </div>
        </div>

        <div
          style={{
            ...cardStyle,
            marginBottom: '16px',
            borderColor: status === 'idle' ? 'rgba(138, 191, 230, 0.12)' : `color-mix(in srgb, ${statusTone} 32%, rgba(138,191,230,0.12))`,
          }}
        >
          <div style={{ fontSize: '11px', color: 'rgba(103,128,151,0.66)', marginBottom: '6px' }}>导入说明</div>
          <div style={{ fontSize: '12px', lineHeight: 1.7, color: 'rgba(92,118,143,0.82)' }}>
            完整宠物包会更完整地保留角色自己的表现方式。旧版导入也能使用，只是会先以一套稳定默认配置开始陪伴。
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          {(status === 'loaded' || status === 'error') && (
            <button onClick={resetPreview} style={secondaryButtonStyle}>
              重新导入
            </button>
          )}
          <button onClick={onClose} style={status === 'loaded' ? primaryButtonStyle : secondaryButtonStyle}>
            {status === 'loaded' ? '完成' : '先关闭'}
          </button>
        </div>
      </div>
    </div>
  )
}

async function buildImportPayload(
  files: File[],
  setMessage: (message: string) => void,
): Promise<PersistImportedPetPayload> {
  const manifestFile = files.find((file) => file.name.toLowerCase() === 'manifest.json')

  if (manifestFile) {
    setMessage('正在整理完整宠物包...')
    return buildImportedPetPayloadFromPackageFiles(
      files.map((file) => ({
        name: file.name,
        relativePath: inferRelativePath(file),
        file,
      })),
    )
  }

  const jsonFile = files.find((file) => file.name.toLowerCase().endsWith('.json'))
  const pngFile = files.find((file) => file.name.toLowerCase().endsWith('.png'))

  if (!jsonFile || !pngFile) {
    throw new Error('需要提供完整宠物包文件，或者至少一份旧版 JSON 配置和 PNG sprite sheet。')
  }

  setMessage('正在整理旧版 sprite 宠物...')
  const config: PetAssetConfig = parsePetConfig(await jsonFile.text())
  const frames = await loadSpriteSheet(pngFile, config)
  const sprite = buildSpriteFromFrames(frames, config)

  return buildImportedPetRecordFromSprite({
    name: config.name,
    spriteDefinition: sprite.definition,
  })
}

function inferRelativePath(file: File): string {
  const candidate = 'webkitRelativePath' in file && typeof file.webkitRelativePath === 'string'
    ? file.webkitRelativePath
    : file.name
  return candidate.replace(/\\/g, '/')
}

const primaryButtonStyle: React.CSSProperties = {
  padding: '10px 18px',
  borderRadius: '14px',
  border: 'none',
  background: 'linear-gradient(135deg, #7db8e8, #f0b7cb)',
  color: '#ffffff',
  fontSize: '13px',
  fontWeight: 700,
  cursor: 'pointer',
  boxShadow: '0 12px 24px rgba(125, 184, 232, 0.18)',
}

const secondaryButtonStyle: React.CSSProperties = {
  padding: '10px 16px',
  borderRadius: '14px',
  border: '1px solid rgba(138, 191, 230, 0.22)',
  background: 'rgba(255,255,255,0.72)',
  color: '#67839d',
  fontSize: '13px',
  cursor: 'pointer',
}

export default CustomPetLoader
