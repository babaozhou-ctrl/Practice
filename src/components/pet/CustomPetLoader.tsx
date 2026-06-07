import React, { useState, useRef, useCallback } from 'react'
import { usePetStore } from '../../store/petStore'
import { loadSpriteSheet, parsePetConfig, buildSpriteFromFrames, PetAssetConfig } from '../../engine/CustomPetParser'
import { buildImportedPetRecordFromSprite, persistImportedPetRecord } from '../../pets/ImportedPetRegistry'
import { useSelectedPetStore } from '../../store/selectedPetStore'

interface Props { onClose: () => void }

const CustomPetLoader: React.FC<Props> = ({ onClose }) => {
  const [dragOver, setDragOver] = useState(false)
  const [status, setStatus] = useState<'idle' | 'loading' | 'loaded' | 'error'>('idle')
  const [message, setMessage] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const setCustomPet = usePetStore((s) => s.setCustomPet)
  const selectPet = useSelectedPetStore((s) => s.selectPet)

  const processFiles = useCallback(async (files: File[]) => {
    const jsonFile = files.find(f => f.name.endsWith('.json'))
    const pngFile = files.find(f => f.name.endsWith('.png'))

    if (!jsonFile) {
      setMessage('Need a .json config file')
      setStatus('error')
      return
    }
    if (!pngFile) {
      setMessage('Need a .png sprite sheet')
      setStatus('error')
      return
    }

    setStatus('loading')
    setMessage('Parsing pet config...')

    try {
      const config: PetAssetConfig = parsePetConfig(await jsonFile.text())
      setMessage(`Loading sprite sheet (${config.gridWidth}x${config.gridHeight})...`)

      const frames = await loadSpriteSheet(pngFile, config)
      const sprite = buildSpriteFromFrames(frames, config)
      const imported = buildImportedPetRecordFromSprite({
        name: config.name,
        spriteDefinition: sprite.definition,
      })

      await persistImportedPetRecord(imported)
      selectPet(imported.id)
      setCustomPet(sprite.definition, config.name)
      setMessage(`Pet "${config.name}" imported to your companion library.`)
      setStatus('loaded')
    } catch (err: any) {
      setMessage(`Error: ${err.message}`)
      setStatus('error')
    }
  }, [selectPet, setCustomPet])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    processFiles(Array.from(e.dataTransfer.files))
  }, [processFiles])

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) processFiles(Array.from(e.target.files))
  }, [processFiles])

  const resetPet = useCallback(() => {
    setCustomPet(null)
    setStatus('idle')
    setMessage('')
  }, [setCustomPet])

  const ov: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10001 }
  const modal: React.CSSProperties = {
    background: 'rgba(22, 18, 36, 0.95)', backdropFilter: 'blur(12px)',
    borderRadius: '16px', padding: '24px', width: '340px',
    border: dragOver ? '1.5px dashed #c084fc' : '1.5px solid rgba(192, 132, 252, 0.2)',
    textAlign: 'center', color: '#e8d8ff',
  }
  const dropZone: React.CSSProperties = {
    padding: '30px 20px', border: '1.5px dashed rgba(192, 132, 252, 0.25)',
    borderRadius: '12px', cursor: 'pointer', marginBottom: '12px',
    fontSize: '13px', color: status === 'error' ? '#fca5a5' : 'rgba(200,180,230,0.5)',
    background: status === 'loading' ? 'rgba(192, 132, 252, 0.05)' : 'transparent',
  }

  return (
    <div style={ov} onClick={onClose}>
      <div style={modal} onClick={e => e.stopPropagation()}
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)} onDrop={handleDrop}>
        <h3 style={{ margin: '0 0 12px', fontSize: '16px', fontWeight: 500 }}>Import Custom Pet</h3>

        <input ref={fileInputRef} type="file" accept=".json,.png" multiple
          style={{ display: 'none' }} onChange={handleFileInput} />

        <div onClick={() => fileInputRef.current?.click()} style={dropZone}>
          {status === 'idle' && 'Drop a .json config and .png sprite sheet here, or click to select files.'}
          {status === 'loading' && `${message}...`}
          {status === 'loaded' && message}
          {status === 'error' && message}
        </div>

        <p style={{ fontSize: '11px', color: 'rgba(200,180,230,0.35)', margin: '0 0 12px' }}>
          Requires a pet config JSON and a sprite sheet PNG. Imported pets will appear in Companion Settings.
        </p>

        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
          {(status === 'loaded' || status === 'error') && (
            <>
              <button onClick={resetPet} style={{
                padding: '8px 16px', borderRadius: '10px', border: '1px solid rgba(192,132,252,0.2)',
                background: 'transparent', color: 'rgba(200,180,230,0.6)', cursor: 'pointer', fontSize: '13px'
              }}>Clear Preview</button>
              <button onClick={onClose} style={{
                padding: '8px 16px', borderRadius: '10px', border: 'none',
                background: 'linear-gradient(135deg, #a78bfa, #c084fc)',
                color: '#fff', cursor: 'pointer', fontSize: '13px'
              }}>Done</button>
            </>
          )}
          {status === 'idle' && (
            <button onClick={onClose} style={{
              padding: '8px 16px', borderRadius: '10px', border: '1px solid rgba(192,132,252,0.2)',
              background: 'transparent', color: 'rgba(200,180,230,0.6)', cursor: 'pointer', fontSize: '13px'
            }}>Cancel</button>
          )}
        </div>
      </div>
    </div>
  )
}

export default CustomPetLoader
