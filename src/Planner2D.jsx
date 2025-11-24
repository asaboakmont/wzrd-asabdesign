// src/Planner2D.jsx
import React, { useRef, useEffect, useState } from 'react'
import { Stage, Layer, Rect, Text, Group } from 'react-konva'

const mmToPx = mm => mm * 0.5       // 2 mm = 1 px
const grid = 20                     // snap grid in px
const clamp = (v, min, max) => Math.max(min, Math.min(max, v))

// simple AABB overlap
const rectsOverlap = (a, b) =>
  a.x < b.x + b.w &&
  a.x + a.w > b.x &&
  a.y < b.y + b.h &&
  a.y + a.h > b.y

export default function Planner2D({ room, items, onChange, selected, setSelected }) {
  const stageRef = useRef(null)
  const containerRef = useRef(null)
  const [layout, setLayout] = useState({
    scale: 1,
    stageWidth: 800,
    stageHeight: 400,
  })

  const getItem = uid => items.find(it => it.uid === uid)

  const hasCollision = (uid, x, y) => {
    const item = getItem(uid)
    if (!item) return false

    const w = mmToPx(item.width)
    const h = mmToPx(item.depth)
    const rectA = { x, y, w, h }

    return items.some(other => {
      if (other.uid === uid) return false
      const rectB = {
        x: other.x ?? 0,
        y: other.y ?? 0,
        w: mmToPx(other.width),
        h: mmToPx(other.depth),
      }
      return rectsOverlap(rectA, rectB)
    })
  }

  // Dragging: snap to grid + keep inside room + avoid overlap
  const handleDragMove = (e, uid) => {
    const node = e.target
    const item = getItem(uid)
    if (!item) return

    // subtract offset (floor starts at 20,20)
    let x = node.x() - 20
    let y = node.y() - 20

    // snap to grid
    x = Math.round(x / grid) * grid
    y = Math.round(y / grid) * grid

    const maxX = mmToPx(room.width) - mmToPx(item.width)
    const maxY = mmToPx(room.depth) - mmToPx(item.depth)

    x = clamp(x, 0, maxX)
    y = clamp(y, 0, maxY)

    // collision check
    if (hasCollision(uid, x, y)) {
      const prevX = item.x ?? 0
      const prevY = item.y ?? 0
      node.position({ x: 20 + prevX, y: 20 + prevY })
      return
    }

    node.position({ x: 20 + x, y: 20 + y })

    if (onChange) {
      onChange(prev =>
        prev.map(it =>
          it.uid === uid ? { ...it, x, y } : it
        )
      )
    }
  }

  // Keep items inside room when room size changes
  useEffect(() => {
    if (!onChange) return
    onChange(prev =>
      prev.map(it => {
        const maxX = mmToPx(room.width) - mmToPx(it.width)
        const maxY = mmToPx(room.depth) - mmToPx(it.depth)
        return {
          ...it,
          x: clamp(it.x ?? 0, 0, maxX),
          y: clamp(it.y ?? 0, 0, maxY),
        }
      })
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room.width, room.depth])

  // Responsive layout: fit BOTH width and height of container
  useEffect(() => {
    const updateLayout = () => {
      const container = containerRef.current
      if (!container) return

      const containerWidth = container.clientWidth || 800
      const containerHeight = container.clientHeight || 320

      const contentWidth = mmToPx(room.width) + 40
      const contentHeight = mmToPx(room.depth) + 40

      // scale down to fit width & height, never scale up > 1
      const scale = Math.min(
        1,
        containerWidth / contentWidth,
        containerHeight / contentHeight
      )

      setLayout({
        scale,
        stageWidth: containerWidth,
        stageHeight: containerHeight,
      })
    }

    updateLayout()
    window.addEventListener('resize', updateLayout)
    return () => window.removeEventListener('resize', updateLayout)
  }, [room.width, room.depth])

  const { scale, stageWidth, stageHeight } = layout

  return (
    <div className="canvas-wrap" ref={containerRef}>
      <Stage
        ref={stageRef}
        width={stageWidth}
        height={stageHeight}
        scaleX={scale}
        scaleY={scale}
      >
        <Layer>
          {/* floor */}
          <Rect
            x={20}
            y={20}
            width={mmToPx(room.width)}
            height={mmToPx(room.depth)}
            stroke="#333"
            fill="#fafafa"
          />

          {/* grid */}
          {Array.from({ length: Math.ceil(mmToPx(room.width) / grid) }).map((_, i) => (
            <Rect
              key={`v-${i}`}
              x={20 + i * grid}
              y={20}
              width={1}
              height={mmToPx(room.depth)}
              fill="#eee"
            />
          ))}
          {Array.from({ length: Math.ceil(mmToPx(room.depth) / grid) }).map((_, i) => (
            <Rect
              key={`h-${i}`}
              x={20}
              y={20 + i * grid}
              width={mmToPx(room.width)}
              height={1}
              fill="#eee"
            />
          ))}

          {/* items / cabinets */}
          {items.map(it => {
            const isSelected = selected === it.uid
            const x = it.x ?? 0
            const y = it.y ?? 0

            return (
              <Group
                key={it.uid}
                x={20 + x}
                y={20 + y}
                draggable
                onDragMove={e => handleDragMove(e, it.uid)}
                onClick={() => setSelected && setSelected(it.uid)}
                onTap={() => setSelected && setSelected(it.uid)}
              >
                <Rect
                  width={mmToPx(it.width)}
                  height={mmToPx(it.depth)}
                  fill={isSelected ? '#cde6ff' : '#ddd'}
                  stroke={isSelected ? '#1976d2' : '#777'}
                  cornerRadius={3}
                />
                <Text text={it.title} fontSize={12} x={4} y={4} />
                <Text
                  text={`${it.width}x${it.depth}`}
                  fontSize={10}
                  x={4}
                  y={18}
                />
              </Group>
            )
          })}

          {/* room dimensions */}
          <Text
            text={`${room.width} mm`}
            x={20}
            y={mmToPx(room.depth) + 24}
          />
          <Text
            text={`${room.depth} mm`}
            x={mmToPx(room.width) + 28}
            y={20}
            rotation={90}
          />
        </Layer>
      </Stage>
    </div>
  )
}
