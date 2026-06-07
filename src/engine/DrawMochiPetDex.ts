// DrawMochiPetDex.ts — Canvas2D-rendered Mochi PetDEX spritesheet experiment.
// Each frame is drawn at 192x208 (standard PetDEX cell).

const C = {
  skin: "#fcd9b8", skinShd: "#e8c4a0", blush: "#fca5a5",
  eyeW: "#ffffff", iris: "#a78bfa", pupil: "#2d1b69", hi: "#ffffff",
  hair: "#a78bfa", hairL: "#c4b5fd", hairD: "#7c3aed",
  hoodie: "#d8b4fe", hoodieD: "#9b72cf",
  skirt: "#9b72cf", skirtD: "#754fa0",
  ear: "#f9a8d4", earD: "#f472b6",
  mouth: "#e87979",
}

// Draw a single Mochi frame. row = 0..8, col = 0..7 (per PetDEX row layout)
export function drawMochiFrame(ctx: OffscreenCanvasRenderingContext2D, row: number, col: number): void {
  const W = 192, H = 208, cx = 96, base = 120
  ctx.clearRect(0, 0, W, H)

  // Frame-specific parameters
  const fc = col // 0-based frame count within row
  const total = [6, 8, 8, 4, 5, 8, 6, 6, 6][row] || 6
  const p = fc / Math.max(total - 1, 1) // progress 0..1 within this row

  switch (row) {
    case 0: drawIdle(ctx, cx, base, fc, total); break
    case 1: drawWatch(ctx, cx, base, p); break
    case 2: drawWatch(ctx, cx, base, 1 - p); break // mirrored
    case 3: drawHappy(ctx, cx, base, fc); break
    case 4: drawExcited(ctx, cx, base, fc); break
    case 5: drawEmbarrassed(ctx, cx, base, p); break
    case 6: drawSleeping(ctx, cx, base, p); break
    case 7: drawWalk(ctx, cx, base, fc); break
    case 8: drawThinking(ctx, cx, base, p); break
  }
}

function breath(t: number): number { return Math.sin(t * Math.PI * 2) * 1.5 }

// === ANIMATION FRAMES ===

function drawIdle(ctx: any, cx: number, base: number, fc: number, total: number) {
  const t = fc / total
  const br = breath(t)
  const blink = fc === 3
  drawBody(ctx, cx, base + br, { blink, squint: 1, smile: 0.1, tail: 0 })
}

function drawWatch(ctx: any, cx: number, base: number, p: number) {
  const lookX = Math.sin(p * Math.PI * 2) * 4
  const br = breath(p) * 0.5
  drawBody(ctx, cx + lookX * 0.3, base + br, { blink: false, squint: 1, smile: 0, tail: 0, lookX })
}

function drawHappy(ctx: any, cx: number, base: number, fc: number) {
  const bounce = [-3, 0, -5, 0][fc] || 0
  drawBody(ctx, cx, base + bounce, { blink: false, squint: 0.6, smile: 0.5, tail: 1, armUp: 1 })
}

function drawExcited(ctx: any, cx: number, base: number, fc: number) {
  const bounce = [-2, -6, 0, -4, 0][fc] || 0
  drawBody(ctx, cx, base + bounce, { blink: false, squint: 0.5, smile: 0.6, tail: 1, armUp: 2, sparkle: true })
}

function drawEmbarrassed(ctx: any, cx: number, base: number, p: number) {
  const tilt = Math.sin(p * Math.PI) * 2
  const blushA = 0.3 + Math.sin(p * Math.PI * 3) * 0.2
  drawBody(ctx, cx + tilt, base, { blink: p < 0.5, squint: 1, smile: -0.3, tail: 0, blushA, hideFace: p > 0.5 })
}

function drawSleeping(ctx: any, cx: number, base: number, p: number) {
  const br = breath(p * 0.5)
  const zProgress = Math.floor(p * 3)
  drawBody(ctx, cx, base + br, { blink: true, squint: 1, smile: 0, tail: 0, sleeping: true, zStage: zProgress })
}

function drawWalk(ctx: any, cx: number, base: number, fc: number) {
  const cycle = Math.sin(fc / 6 * Math.PI * 2)
  const bounce = Math.abs(cycle) * 3
  drawBody(ctx, cx, base - bounce, { blink: false, squint: 1, smile: 0.1, tail: 0, walkCycle: cycle, armSwing: cycle * 8 })
}

function drawThinking(ctx: any, cx: number, base: number, p: number) {
  const tilt = Math.sin(p * Math.PI * 0.5) * 2
  drawBody(ctx, cx + tilt, base - 1, { blink: false, squint: 1, smile: 0, tail: 0, think: true, lookX: -2, lookUp: true })
}

// === BODY DRAWING ===

interface FrameOpts {
  blink: boolean; squint: number; smile: number; tail: number
  lookX?: number; armUp?: number; sparkle?: boolean; blushA?: number
  hideFace?: boolean; sleeping?: boolean; zStage?: number
  walkCycle?: number; armSwing?: number; think?: boolean; lookUp?: boolean
}

function drawBody(ctx: any, cx: number, base: number, o: FrameOpts) {
  const earL = { x: cx - 30, y: base - 62 }
  const earR = { x: cx + 30, y: base - 62 }
  const lookX = o.lookX || 0
  const armSwing = o.armSwing || 0
  const armUpY = (o.armUp || 0) * -6

  // Tail
  if (o.tail) {
    ctx.fillStyle = C.hair
    ctx.beginPath()
    ctx.moveTo(cx + 22, base - 6)
    ctx.quadraticCurveTo(cx + 36, base - 18, cx + 30, base - 28)
    ctx.quadraticCurveTo(cx + 26, base - 32, cx + 24, base - 26)
    ctx.quadraticCurveTo(cx + 28, base - 16, cx + 22, base - 8)
    ctx.fill()
  }

  // Hair back
  ctx.fillStyle = C.hairD
  ctx.beginPath()
  ctx.ellipse(cx, base - 44, 32, 24, 0, 0, Math.PI * 2)
  ctx.fill()

  // Ears
  for (const ear of [earL, earR]) {
    const dir = ear === earL ? -1 : 1
    ctx.fillStyle = C.ear
    ctx.beginPath()
    ctx.moveTo(ear.x, ear.y)
    ctx.lineTo(ear.x + dir * -14, ear.y - 22)
    ctx.lineTo(ear.x + dir * 6, ear.y - 18)
    ctx.closePath(); ctx.fill()
    ctx.fillStyle = C.earD
    ctx.beginPath()
    ctx.moveTo(ear.x + dir * -1, ear.y - 4)
    ctx.lineTo(ear.x + dir * -7, ear.y - 16)
    ctx.lineTo(ear.x + dir * 3, ear.y - 12)
    ctx.closePath(); ctx.fill()
  }

  // Head
  ctx.fillStyle = C.skin
  ctx.beginPath()
  ctx.ellipse(cx, base - 34, 24, 26, 0, 0, Math.PI * 2)
  ctx.fill()

  // Hair bangs
  ctx.fillStyle = C.hair
  ctx.beginPath()
  ctx.ellipse(cx, base - 42, 28, 18, 0, Math.PI, Math.PI * 2)
  ctx.fill()
  for (let i = -3; i <= 3; i++) {
    ctx.beginPath()
    ctx.ellipse(cx + i * 7, base - 44 + Math.abs(i) * 2 + Math.sin(i * 2) * 2, 5, 12 + Math.abs(i) * 2, i * 0.1, 0, Math.PI)
    ctx.fillStyle = i % 2 === 0 ? C.hair : C.hairL
    ctx.fill()
  }
  // Hair sides
  ctx.fillStyle = C.hairD
  ctx.beginPath()
  ctx.moveTo(cx - 26, base - 36); ctx.quadraticCurveTo(cx - 34, base - 10, cx - 28, base + 12)
  ctx.quadraticCurveTo(cx - 26, base + 6, cx - 22, base - 4); ctx.quadraticCurveTo(cx - 24, base - 20, cx - 24, base - 34)
  ctx.fill()
  ctx.beginPath()
  ctx.moveTo(cx + 26, base - 36); ctx.quadraticCurveTo(cx + 34, base - 10, cx + 28, base + 12)
  ctx.quadraticCurveTo(cx + 26, base + 6, cx + 22, base - 4); ctx.quadraticCurveTo(cx + 24, base - 20, cx + 24, base - 34)
  ctx.fill()

  // === FACE ===
  const eyeY = base - 34
  const hide = o.hideFace
  if (!hide) {
    // Eyes
    ctx.fillStyle = C.eyeW
    ctx.beginPath()
    ctx.ellipse(cx - 9 + lookX, eyeY, 6 * o.squint, o.blink ? 1 : 7, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.ellipse(cx + 9 + lookX, eyeY, 6 * o.squint, o.blink ? 1 : 7, 0, 0, Math.PI * 2)
    ctx.fill()
    if (!o.blink) {
      ctx.fillStyle = C.iris
      ctx.beginPath()
      ctx.ellipse(cx - 8 + lookX, eyeY + 1, 4, o.lookUp ? 3 : 5, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.beginPath()
      ctx.ellipse(cx + 10 + lookX, eyeY + 1, 4, o.lookUp ? 3 : 5, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = C.pupil
      ctx.beginPath()
      ctx.ellipse(cx - 8 + lookX, eyeY + 1, 2, o.lookUp ? 1.5 : 3, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.beginPath()
      ctx.ellipse(cx + 10 + lookX, eyeY + 1, 2, o.lookUp ? 1.5 : 3, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = C.hi
      ctx.beginPath()
      ctx.ellipse(cx - 10 + lookX, eyeY - 1, 1.5, 2, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.beginPath()
      ctx.ellipse(cx + 8 + lookX, eyeY - 1, 1.5, 2, 0, 0, Math.PI * 2)
      ctx.fill()
    }
  } else {
    // Embarrassed — cover face with hands
    ctx.fillStyle = C.skin
    ctx.beginPath()
    ctx.ellipse(cx, eyeY, 16, 12, 0, 0, Math.PI * 2)
    ctx.fill()
  }

  // Blush
  if ((o.blushA || 0.3) > 0 && !hide) {
    ctx.fillStyle = C.blush
    ctx.globalAlpha = o.blushA || 0.3
    ctx.beginPath(); ctx.ellipse(cx - 16, base - 26, 6, 4, 0, 0, Math.PI * 2); ctx.fill()
    ctx.beginPath(); ctx.ellipse(cx + 16, base - 26, 6, 4, 0, 0, Math.PI * 2); ctx.fill()
    ctx.globalAlpha = 1
  }

  // Mouth
  if (!hide) {
    ctx.strokeStyle = C.mouth; ctx.lineWidth = 1.5
    ctx.beginPath()
    if (o.smile > 0.3) ctx.arc(cx, base - 22, 4, 0.2, Math.PI - 0.2)
    else if (o.smile < 0) ctx.arc(cx, base - 20, 3, Math.PI + 0.3, -0.3)
    else if (o.think) ctx.arc(cx - 2, base - 24, 2, 0, Math.PI * 2)
    else ctx.arc(cx, base - 24, 3, 0.1, Math.PI - 0.1)
    ctx.stroke()
  }

  // Body / Hoodie
  const bodyY = base - 12
  ctx.fillStyle = C.hoodie
  ctx.beginPath()
  ctx.moveTo(cx - 24, bodyY)
  ctx.quadraticCurveTo(cx - 28, bodyY + 10, cx - 26, bodyY + 28)
  ctx.quadraticCurveTo(cx - 20, bodyY + 38, cx, bodyY + 40)
  ctx.quadraticCurveTo(cx + 20, bodyY + 38, cx + 26, bodyY + 28)
  ctx.quadraticCurveTo(cx + 28, bodyY + 10, cx + 24, bodyY)
  ctx.closePath(); ctx.fill()
  ctx.strokeStyle = C.hoodieD; ctx.lineWidth = 1
  ctx.beginPath(); ctx.moveTo(cx, bodyY + 2); ctx.lineTo(cx, bodyY + 38); ctx.stroke()
  ctx.fillStyle = C.hoodieD
  ctx.beginPath(); ctx.ellipse(cx, bodyY + 26, 12, 4, 0, 0, Math.PI); ctx.fill()

  // Arms
  const armsUp = (o.armUp || 0) * -5
  ctx.fillStyle = C.hoodie
  ctx.beginPath()
  ctx.ellipse(cx - 30, bodyY + 10 - armSwing * 0.3 + armsUp, 6, 10, -0.2 + armsUp * 0.01, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.ellipse(cx + 30, bodyY + 10 + armSwing * 0.3 + armsUp, 6, 10, 0.2 - armsUp * 0.01, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = C.skin
  ctx.beginPath()
  ctx.ellipse(cx - 31, bodyY + 20 - armSwing * 0.3 + armsUp, 4, 5, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.ellipse(cx + 31, bodyY + 20 + armSwing * 0.3 + armsUp, 4, 5, 0, 0, Math.PI * 2)
  ctx.fill()

  // Skirt
  const skirtY = bodyY + 38
  ctx.fillStyle = C.skirt
  ctx.beginPath()
  ctx.moveTo(cx - 18, skirtY)
  ctx.quadraticCurveTo(cx - 24, skirtY + 16, cx - 20, skirtY + 26)
  ctx.quadraticCurveTo(cx - 10, skirtY + 32, cx, skirtY + 32)
  ctx.quadraticCurveTo(cx + 10, skirtY + 32, cx + 20, skirtY + 26)
  ctx.quadraticCurveTo(cx + 24, skirtY + 16, cx + 18, skirtY)
  ctx.closePath(); ctx.fill()
  ctx.strokeStyle = C.skirtD; ctx.lineWidth = 0.8
  for (let i = -2; i <= 2; i++) {
    ctx.beginPath(); ctx.moveTo(cx + i * 8, skirtY + 2); ctx.lineTo(cx + i * 8 + 2, skirtY + 28); ctx.stroke()
  }

  // Legs
  const legOffset = (o.walkCycle || 0) * 4
  ctx.fillStyle = C.skin
  ctx.beginPath()
  ctx.ellipse(cx - 8 + legOffset, skirtY + 36, 5, 8, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.ellipse(cx + 8 - legOffset, skirtY + 36, 5, 8, 0, 0, Math.PI * 2)
  ctx.fill()

  // Zs for sleeping
  if (o.sleeping) {
    ctx.fillStyle = C.iris; ctx.globalAlpha = 0.5
    const zStages = [
      () => { ctx.font = "12px sans-serif"; ctx.fillText("z", cx + 16, eyeY - 16) },
      () => { ctx.font = "14px sans-serif"; ctx.fillText("Z", cx + 22, eyeY - 24); ctx.font = "12px sans-serif"; ctx.fillText("z", cx + 14, eyeY - 16) },
      () => { ctx.font = "18px sans-serif"; ctx.fillText("Z", cx + 26, eyeY - 34); ctx.font = "14px sans-serif"; ctx.fillText("Z", cx + 20, eyeY - 24); ctx.font = "12px sans-serif"; ctx.fillText("z", cx + 14, eyeY - 16) },
    ]
    zStages[o.zStage || 0]?.()
    ctx.globalAlpha = 1
  }

  // Sparkles for excited
  if (o.sparkle) {
    ctx.fillStyle = "#fde68a"; ctx.globalAlpha = 0.6
    const sp = [12, 22, 30, 16]
    for (let i = 0; i < 4; i++) {
      const angle = Date.now() * 0.001 + i * 1.5
      ctx.beginPath()
      ctx.arc(cx + sp[i], base - 56 + Math.sin(angle) * 3, 2, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalAlpha = 1
  }
}

// Generate full PetDEX spritesheet (9 rows x 8 cols)
export function generateMochiSpritesheet(): OffscreenCanvas {
  const sheet = new OffscreenCanvas(1536, 1872)
  const ctx = sheet.getContext("2d")!
  for (let row = 0; row < 9; row++) {
    const count = [6, 8, 8, 4, 5, 8, 6, 6, 6][row]
    for (let col = 0; col < (count || 6); col++) {
      drawMochiFrame(ctx, row, col)
      // The draw function draws at (0,0) — need to offset by cell position
      const frameData = ctx.getImageData(0, 0, 192, 208)
      // composite onto the sheet
      ctx.putImageData(frameData, col * 192, row * 208)
    }
  }
  return sheet
}
