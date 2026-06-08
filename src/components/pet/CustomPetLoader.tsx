import React, { useCallback, useRef, useState } from 'react'
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
      setMessage(`已导入“${payload.name}”，现在已经切换为当前陪伴宠物。`)
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

  const overlayStyle: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    background: 'rgba(12, 10, 18, 0.68)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10001,
    backdropFilter: 'blur(16px)',
  }

  const modalStyle: React.CSSProperties = {
    width: '380px',
    padding: '24px',
    borderRadius: '20px',
    background: 'linear-gradient(180deg, rgba(30, 28, 38, 0.96), rgba(20, 18, 28, 0.98))',
    border: dragOver ? '1.5px dashed rgba(163, 211, 255, 0.9)' : '1px solid rgba(255,255,255,0.08)',
    boxShadow: '0 24px 80px rgba(0, 0, 0, 0.35)',
    color: '#f4f3ef',
  }

  const dropZoneStyle: React.CSSProperties = {
    padding: '28px 20px',
    borderRadius: '16px',
    border: '1px dashed rgba(165, 204, 255, 0.28)',
    background: status === 'loading'
      ? 'rgba(111, 181, 255, 0.08)'
      : 'linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))',
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
        <h3 style={{ margin: '0 0 10px', fontSize: '18px', fontWeight: 600 }}>
          导入自定义宠物
        </h3>

        <p style={{ margin: '0 0 16px', fontSize: '12px', lineHeight: 1.6, color: 'rgba(244,243,239,0.68)' }}>
          可以导入完整宠物包，也可以导入旧版 sprite 配置。完整包会更完整地保留角色自己的样子、动画和性格。
        </p>

        <input
          ref={fileInputRef}
          type="file"
          accept=".json,.png,.jpg,.jpeg,.webp"
          multiple
          style={{ display: 'none' }}
          onChange={handleFileInput}
        />

        <div
          onClick={() => fileInputRef.current?.click()}
          style={dropZoneStyle}
        >
          {status === 'idle' && (
            <div>
              <div style={{ fontSize: '14px', fontWeight: 500, marginBottom: '8px' }}>
                把宠物包拖进来，或点击选择文件
              </div>
              <div style={{ fontSize: '12px', lineHeight: 1.6, color: 'rgba(244,243,239,0.56)' }}>
                最省心的方式，是把同一个宠物目录里的文件一起拖进来。
              </div>
            </div>
          )}

          {status === 'loading' && (
            <div style={{ fontSize: '13px', lineHeight: 1.7 }}>
              {message || '正在把新伙伴接进来...'}
            </div>
          )}

          {status === 'loaded' && (
            <div style={{ fontSize: '13px', lineHeight: 1.7, color: '#dff4df' }}>
              {message}
            </div>
          )}

          {status === 'error' && (
            <div style={{ fontSize: '13px', lineHeight: 1.7, color: '#ffd6d6' }}>
              {message}
            </div>
          )}
        </div>

        <p style={{ margin: '14px 0 18px', fontSize: '11px', lineHeight: 1.7, color: 'rgba(244,243,239,0.46)' }}>
          完整宠物包会保留自己的动画、personality、companion-content 和 atlas 资源。旧版导入也能使用，只是会先套用一套默认陪伴人格和互动内容。
        </p>

        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          {(status === 'loaded' || status === 'error') && (
            <button
              onClick={resetPreview}
              style={secondaryButtonStyle}
            >
              重新导入
            </button>
          )}

          <button
            onClick={onClose}
            style={status === 'loaded' ? primaryButtonStyle : secondaryButtonStyle}
          >
            {status === 'loaded' ? '完成' : '关闭'}
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
  padding: '9px 16px',
  borderRadius: '12px',
  border: 'none',
  background: 'linear-gradient(135deg, #7bc6ff, #94a8ff)',
  color: '#0f1720',
  fontSize: '13px',
  fontWeight: 600,
  cursor: 'pointer',
}

const secondaryButtonStyle: React.CSSProperties = {
  padding: '9px 16px',
  borderRadius: '12px',
  border: '1px solid rgba(255,255,255,0.1)',
  background: 'rgba(255,255,255,0.03)',
  color: 'rgba(244,243,239,0.78)',
  fontSize: '13px',
  cursor: 'pointer',
}

export default CustomPetLoader
