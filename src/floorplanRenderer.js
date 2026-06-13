// src/floorplanRenderer.js
// Deterministic SVG renderer — tager JSON fra AI og bygger pixel-perfekt SVG

const SCALE = 0.9          // px per cm
const MARGIN = 80          // px margen rundt om
const WALL_OUTER = 7       // ydervæg tykkelse px
const WALL_INNER = 4       // indervæg tykkelse px
const BRAND_HEIGHT = 80    // plads til branding i bunden

const ROOM_COLORS = {
  bathroom:  '#dff0f5',
  kitchen:   '#f0f5e8',
  hallway:   '#f5f5f3',
  terrace:   '#f8f8f6',
  garage:    '#f5f5f3',
  other:     '#ffffff',
  living:    '#ffffff',
  bedroom:   '#ffffff',
  utility:   '#ffffff',
}

function s(cm) { return cm * SCALE }

function roomColor(type) {
  return ROOM_COLORS[type] || '#ffffff'
}

// Tegn dør: linje + bue
function renderDoor(wall, roomX, roomY, roomW, roomH, door, wallThickness) {
  const { pos, width: dw, swing, inward } = door
  const hw = wallThickness / 2
  let x1, y1, x2, y2, arcX, arcY, sweepFlag, swingDir

  const p = s(pos)
  const dws = s(dw)

  if (wall === 'top') {
    x1 = roomX + p; y1 = roomY
    x2 = roomX + p + dws; y2 = roomY
    if (swing === 'right') {
      arcX = x1 + dws; arcY = y1 + dws
      return `
        <line x1="${x1}" y1="${y1}" x2="${x1}" y2="${y1 + dws}" stroke="#1a1a1a" stroke-width="1.5"/>
        <path d="M ${x1},${y1 + dws} A ${dws},${dws} 0 0,0 ${x1 + dws},${y1}" fill="none" stroke="#1a1a1a" stroke-width="1"/>
        <rect x="${x1}" y="${y1 - hw}" width="${dws}" height="${hw * 2}" fill="${roomColor('living')}"/>
      `
    } else {
      return `
        <line x1="${x2}" y1="${y1}" x2="${x2}" y2="${y1 + dws}" stroke="#1a1a1a" stroke-width="1.5"/>
        <path d="M ${x2},${y1 + dws} A ${dws},${dws} 0 0,1 ${x2 - dws},${y1}" fill="none" stroke="#1a1a1a" stroke-width="1"/>
        <rect x="${x1}" y="${y1 - hw}" width="${dws}" height="${hw * 2}" fill="${roomColor('living')}"/>
      `
    }
  }
  if (wall === 'bottom') {
    x1 = roomX + p; y1 = roomY + roomH
    x2 = roomX + p + dws
    if (swing === 'right') {
      return `
        <line x1="${x1}" y1="${y1}" x2="${x1}" y2="${y1 - dws}" stroke="#1a1a1a" stroke-width="1.5"/>
        <path d="M ${x1},${y1 - dws} A ${dws},${dws} 0 0,1 ${x1 + dws},${y1}" fill="none" stroke="#1a1a1a" stroke-width="1"/>
        <rect x="${x1}" y="${y1 - hw}" width="${dws}" height="${hw * 2}" fill="white"/>
      `
    } else {
      return `
        <line x1="${x2}" y1="${y1}" x2="${x2}" y2="${y1 - dws}" stroke="#1a1a1a" stroke-width="1.5"/>
        <path d="M ${x2},${y1 - dws} A ${dws},${dws} 0 0,0 ${x2 - dws},${y1}" fill="none" stroke="#1a1a1a" stroke-width="1"/>
        <rect x="${x1}" y="${y1 - hw}" width="${dws}" height="${hw * 2}" fill="white"/>
      `
    }
  }
  if (wall === 'left') {
    x1 = roomX; y1 = roomY + p
    y2 = roomY + p + dws
    if (swing === 'right') {
      return `
        <line x1="${x1}" y1="${y1}" x2="${x1 + dws}" y2="${y1}" stroke="#1a1a1a" stroke-width="1.5"/>
        <path d="M ${x1 + dws},${y1} A ${dws},${dws} 0 0,0 ${x1},${y1 + dws}" fill="none" stroke="#1a1a1a" stroke-width="1"/>
        <rect x="${x1 - hw}" y="${y1}" width="${hw * 2}" height="${dws}" fill="white"/>
      `
    } else {
      return `
        <line x1="${x1}" y1="${y2}" x2="${x1 + dws}" y2="${y2}" stroke="#1a1a1a" stroke-width="1.5"/>
        <path d="M ${x1 + dws},${y2} A ${dws},${dws} 0 0,1 ${x1},${y2 - dws}" fill="none" stroke="#1a1a1a" stroke-width="1"/>
        <rect x="${x1 - hw}" y="${y1}" width="${hw * 2}" height="${dws}" fill="white"/>
      `
    }
  }
  if (wall === 'right') {
    x1 = roomX + roomW; y1 = roomY + p
    y2 = roomY + p + dws
    if (swing === 'right') {
      return `
        <line x1="${x1}" y1="${y2}" x2="${x1 - dws}" y2="${y2}" stroke="#1a1a1a" stroke-width="1.5"/>
        <path d="M ${x1 - dws},${y2} A ${dws},${dws} 0 0,0 ${x1},${y2 - dws}" fill="none" stroke="#1a1a1a" stroke-width="1"/>
        <rect x="${x1 - hw}" y="${y1}" width="${hw * 2}" height="${dws}" fill="white"/>
      `
    } else {
      return `
        <line x1="${x1}" y1="${y1}" x2="${x1 - dws}" y2="${y1}" stroke="#1a1a1a" stroke-width="1.5"/>
        <path d="M ${x1 - dws},${y1} A ${dws},${dws} 0 0,1 ${x1},${y1 + dws}" fill="none" stroke="#1a1a1a" stroke-width="1"/>
        <rect x="${x1 - hw}" y="${y1}" width="${hw * 2}" height="${dws}" fill="white"/>
      `
    }
  }
  return ''
}

// Tegn vindue: hvid gap + tre parallelle linjer
function renderWindow(wall, roomX, roomY, roomW, roomH, win, wallThickness) {
  const { pos, width: ww } = win
  const ps = s(pos)
  const wws = s(ww)
  const hw = wallThickness / 2

  if (wall === 'top') {
    const x = roomX + ps; const y = roomY
    return `
      <rect x="${x}" y="${y - hw}" width="${wws}" height="${hw * 2}" fill="white"/>
      <line x1="${x}" y1="${y - 2.5}" x2="${x + wws}" y2="${y - 2.5}" stroke="#1a1a1a" stroke-width="1"/>
      <line x1="${x}" y1="${y}" x2="${x + wws}" y2="${y}" stroke="#1a1a1a" stroke-width="1"/>
      <line x1="${x}" y1="${y + 2.5}" x2="${x + wws}" y2="${y + 2.5}" stroke="#1a1a1a" stroke-width="1"/>
    `
  }
  if (wall === 'bottom') {
    const x = roomX + ps; const y = roomY + roomH
    return `
      <rect x="${x}" y="${y - hw}" width="${wws}" height="${hw * 2}" fill="white"/>
      <line x1="${x}" y1="${y - 2.5}" x2="${x + wws}" y2="${y - 2.5}" stroke="#1a1a1a" stroke-width="1"/>
      <line x1="${x}" y1="${y}" x2="${x + wws}" y2="${y}" stroke="#1a1a1a" stroke-width="1"/>
      <line x1="${x}" y1="${y + 2.5}" x2="${x + wws}" y2="${y + 2.5}" stroke="#1a1a1a" stroke-width="1"/>
    `
  }
  if (wall === 'left') {
    const x = roomX; const y = roomY + ps
    return `
      <rect x="${x - hw}" y="${y}" width="${hw * 2}" height="${wws}" fill="white"/>
      <line x1="${x - 2.5}" y1="${y}" x2="${x - 2.5}" y2="${y + wws}" stroke="#1a1a1a" stroke-width="1"/>
      <line x1="${x}" y1="${y}" x2="${x}" y2="${y + wws}" stroke="#1a1a1a" stroke-width="1"/>
      <line x1="${x + 2.5}" y1="${y}" x2="${x + 2.5}" y2="${y + wws}" stroke="#1a1a1a" stroke-width="1"/>
    `
  }
  if (wall === 'right') {
    const x = roomX + roomW; const y = roomY + ps
    return `
      <rect x="${x - hw}" y="${y}" width="${hw * 2}" height="${wws}" fill="white"/>
      <line x1="${x - 2.5}" y1="${y}" x2="${x - 2.5}" y2="${y + wws}" stroke="#1a1a1a" stroke-width="1"/>
      <line x1="${x}" y1="${y}" x2="${x}" y2="${y + wws}" stroke="#1a1a1a" stroke-width="1"/>
      <line x1="${x + 2.5}" y1="${y}" x2="${x + 2.5}" y2="${y + wws}" stroke="#1a1a1a" stroke-width="1"/>
    `
  }
  return ''
}

// Tegn skab
function renderCabinet(wall, roomX, roomY, roomW, roomH, cab) {
  const { pos, width: cw, depth: cd = 60 } = cab
  const ps = s(pos); const cws = s(cw); const cds = s(cd)
  let x, y, w, h

  if (wall === 'top')    { x = roomX + ps; y = roomY; w = cws; h = cds }
  if (wall === 'bottom') { x = roomX + ps; y = roomY + roomH - cds; w = cws; h = cds }
  if (wall === 'left')   { x = roomX; y = roomY + ps; w = cds; h = cws }
  if (wall === 'right')  { x = roomX + roomW - cds; y = roomY + ps; w = cds; h = cws }

  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#e8e6e2" stroke="#1a1a1a" stroke-width="0.8"/>`
}

// Tegn inventar (toilet, komfur, osv.)
function renderFixtures(fixtures, roomX, roomY, roomW, roomH) {
  if (!fixtures || fixtures.length === 0) return ''
  const cx = roomX + roomW / 2
  const cy = roomY + roomH / 2
  let out = ''

  fixtures.forEach((f, i) => {
    const ox = cx + (i % 2 === 0 ? -20 : 20)
    const oy = cy + Math.floor(i / 2) * 30 - 10

    if (f === 'toilet') {
      out += `
        <rect x="${ox - 12}" y="${oy - 8}" width="24" height="8" rx="2" fill="#f0f0f0" stroke="#999" stroke-width="0.8"/>
        <ellipse cx="${ox}" cy="${oy + 12}" rx="13" ry="16" fill="#f0f0f0" stroke="#999" stroke-width="0.8"/>
      `
    } else if (f === 'sink') {
      out += `<rect x="${ox - 12}" y="${oy - 12}" width="24" height="24" rx="4" fill="#f0f0f0" stroke="#999" stroke-width="0.8"/>
              <circle cx="${ox}" cy="${oy}" r="5" fill="none" stroke="#999" stroke-width="0.8"/>`
    } else if (f === 'bathtub') {
      out += `<rect x="${ox - 18}" y="${oy - 30}" width="36" height="55" rx="8" fill="#dff0f5" stroke="#999" stroke-width="0.8"/>
              <ellipse cx="${ox}" cy="${oy}" rx="14" ry="20" fill="#c8e6f0" stroke="#999" stroke-width="0.8"/>`
    } else if (f === 'shower') {
      out += `<rect x="${ox - 18}" y="${oy - 18}" width="36" height="36" fill="#dff0f5" stroke="#999" stroke-width="0.8"/>
              <line x1="${ox - 14}" y1="${oy - 14}" x2="${ox + 14}" y2="${oy + 14}" stroke="#aaa" stroke-width="0.8"/>
              <line x1="${ox + 14}" y1="${oy - 14}" x2="${ox - 14}" y2="${oy + 14}" stroke="#aaa" stroke-width="0.8"/>`
    } else if (f === 'stove') {
      out += `<rect x="${ox - 18}" y="${oy - 18}" width="36" height="36" fill="#e8e6e2" stroke="#999" stroke-width="0.8"/>
              <circle cx="${ox - 8}" cy="${oy - 8}" r="5" fill="none" stroke="#888" stroke-width="1"/>
              <circle cx="${ox + 8}" cy="${oy - 8}" r="5" fill="none" stroke="#888" stroke-width="1"/>
              <circle cx="${ox - 8}" cy="${oy + 8}" r="5" fill="none" stroke="#888" stroke-width="1"/>
              <circle cx="${ox + 8}" cy="${oy + 8}" r="5" fill="none" stroke="#888" stroke-width="1"/>`
    } else if (f === 'refrigerator') {
      out += `<rect x="${ox - 10}" y="${oy - 18}" width="20" height="36" fill="#f0f0f0" stroke="#999" stroke-width="0.8"/>
              <line x1="${ox - 10}" y1="${oy}" x2="${ox + 10}" y2="${oy}" stroke="#ccc" stroke-width="0.8"/>
              <circle cx="${ox + 6}" cy="${oy - 8}" r="2" fill="#aaa"/>
              <circle cx="${ox + 6}" cy="${oy + 8}" r="2" fill="#aaa"/>`
    } else if (f === 'washing_machine') {
      out += `<rect x="${ox - 14}" y="${oy - 14}" width="28" height="28" rx="2" fill="#f0f0f0" stroke="#999" stroke-width="0.8"/>
              <circle cx="${ox}" cy="${oy}" r="10" fill="none" stroke="#aaa" stroke-width="1"/>
              <circle cx="${ox}" cy="${oy}" r="5" fill="#ddf" stroke="#aaa" stroke-width="0.8"/>`
    }
  })
  return out
}

// Mål-linje
function renderDimension(x1, y1, x2, y2, label, side = 'outside') {
  const isHoriz = Math.abs(y2 - y1) < 2
  const offset = 22
  let lx, ly, tx, ty, rot = 0

  if (isHoriz) {
    ly = y1 - offset; lx = x1
    tx = (x1 + x2) / 2; ty = ly - 5
    return `
      <line x1="${x1}" y1="${ly}" x2="${x2}" y2="${ly}" stroke="#cccccc" stroke-width="0.8"/>
      <line x1="${x1}" y1="${y1}" x2="${x1}" y2="${ly}" stroke="#cccccc" stroke-width="0.5" stroke-dasharray="2,2"/>
      <line x1="${x2}" y1="${y2}" x2="${x2}" y2="${ly}" stroke="#cccccc" stroke-width="0.5" stroke-dasharray="2,2"/>
      <text x="${tx}" y="${ty}" text-anchor="middle" font-family="Arial, sans-serif" font-size="10" fill="#aaaaaa">${label}</text>
    `
  } else {
    lx = x1 - offset; ly = y1
    tx = lx - 5; ty = (y1 + y2) / 2
    return `
      <line x1="${lx}" y1="${y1}" x2="${lx}" y2="${y2}" stroke="#cccccc" stroke-width="0.8"/>
      <line x1="${x1}" y1="${y1}" x2="${lx}" y2="${y1}" stroke="#cccccc" stroke-width="0.5" stroke-dasharray="2,2"/>
      <line x1="${x2}" y1="${y2}" x2="${lx}" y2="${y2}" stroke="#cccccc" stroke-width="0.5" stroke-dasharray="2,2"/>
      <text x="${tx}" y="${ty}" text-anchor="middle" font-family="Arial, sans-serif" font-size="10" fill="#aaaaaa" transform="rotate(-90, ${tx}, ${ty})">${label}</text>
    `
  }
}

export function renderFloorplanSVG(data) {
  const { rooms = [], totalWidth = 1000, totalHeight = 700, address = '', northDirection = 'up' } = data

  // Find faktisk bounding box
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  rooms.forEach(r => {
    minX = Math.min(minX, r.x)
    minY = Math.min(minY, r.y)
    maxX = Math.max(maxX, r.x + r.width)
    maxY = Math.max(maxY, r.y + r.height)
  })
  if (!isFinite(minX)) { minX = 0; minY = 0; maxX = totalWidth; maxY = totalHeight }

  const W = s(maxX - minX) + MARGIN * 2
  const H = s(maxY - minY) + MARGIN * 2 + BRAND_HEIGHT

  const offsetX = MARGIN - s(minX)
  const offsetY = MARGIN - s(minY)

  let roomsSVG = ''
  let doorsSVG = ''
  let windowsSVG = ''
  let cabinetsSVG = ''
  let fixturesSVG = ''
  let labelsSVG = ''
  let dimsSVG = ''

  rooms.forEach((room, idx) => {
    const rx = s(room.x) + offsetX
    const ry = s(room.y) + offsetY
    const rw = s(room.width)
    const rh = s(room.height)
    const isExterior = room.isExterior || room.type === 'terrace' || room.type === 'garage'
    const strokeW = isExterior ? 2 : (idx === 0 ? WALL_OUTER : WALL_OUTER)
    const fill = roomColor(room.type)
    const stroke = isExterior ? '#888888' : '#1a1a1a'
    const dash = isExterior ? 'stroke-dasharray="none"' : ''

    // Rum-rektangel
    roomsSVG += `<rect x="${rx}" y="${ry}" width="${rw}" height="${rh}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeW}" ${dash}/>\n`

    // Mål langs facade (kun ydervægge)
    if (!isExterior) {
      const wLabel = (room.width / 100).toFixed(1) + ' m'
      const hLabel = (room.height / 100).toFixed(1) + ' m'
      dimsSVG += renderDimension(rx, ry - 5, rx + rw, ry - 5, wLabel)
      dimsSVG += renderDimension(rx - 5, ry, rx - 5, ry + rh, hLabel)
    }

    // Vinduer
    const walls = room.walls || {}
    ;['top', 'bottom', 'left', 'right'].forEach(wall => {
      const wallData = walls[wall] || {}
      ;(wallData.windows || []).forEach(win => {
        windowsSVG += renderWindow(wall, rx, ry, rw, rh, win, strokeW)
      })
      ;(wallData.doors || []).forEach(door => {
        doorsSVG += renderDoor(wall, rx, ry, rw, rh, door, strokeW)
      })
    })

    // Skabe
    ;(room.cabinets || []).forEach(cab => {
      cabinetsSVG += renderCabinet(cab.wall, rx, ry, rw, rh, cab)
    })

    // Inventar
    fixturesSVG += renderFixtures(room.fixtures, rx, ry, rw, rh)

    // Label
    const cx = rx + rw / 2
    const cy = ry + rh / 2
    labelsSVG += `<text x="${cx}" y="${cy - (room.ceilingHeight ? 7 : 0)}" text-anchor="middle" font-family="Georgia, serif" font-size="13" fill="#222222">${room.name}</text>\n`
    if (room.ceilingHeight) {
      labelsSVG += `<text x="${cx}" y="${cy + 10}" text-anchor="middle" font-family="Georgia, serif" font-size="10" fill="#999999" font-style="italic">H: ${room.ceilingHeight} m</text>\n`
    }
  })

  // Branding
  const brandY = H - BRAND_HEIGHT + 30
  const brandingSVG = `
    <text x="${MARGIN}" y="${brandY + 10}" font-family="Georgia, serif" font-size="18" font-weight="bold" fill="#1a1a1a">vania.</text>
    <text x="${MARGIN}" y="${brandY + 22}" font-family="Arial, sans-serif" font-size="8" fill="#aaaaaa" letter-spacing="3">GRAPHICS</text>
    <text x="${W / 2}" y="${brandY + 12}" text-anchor="middle" font-family="Georgia, serif" font-size="22" fill="#1a1a1a">${address}</text>
    <text x="${W / 2}" y="${brandY + 28}" text-anchor="middle" font-family="Arial, sans-serif" font-size="10" fill="#aaaaaa">Vejledende Mål Uden Ansvar</text>
    <g transform="translate(${W - MARGIN - 20}, ${brandY + 10})">
      <circle cx="0" cy="0" r="18" fill="none" stroke="#1a1a1a" stroke-width="1.2"/>
      <polygon points="0,-13 3.5,2 0,0 -3.5,2" fill="#1a1a1a"/>
      <text x="0" y="30" text-anchor="middle" font-family="Arial" font-size="11" font-weight="bold" fill="#1a1a1a">N</text>
    </g>
  `

  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;">
  <rect width="100%" height="100%" fill="#ffffff"/>
  ${dimsSVG}
  ${roomsSVG}
  ${cabinetsSVG}
  ${fixturesSVG}
  ${windowsSVG}
  ${doorsSVG}
  ${labelsSVG}
  ${brandingSVG}
</svg>`
}
