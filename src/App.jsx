import React, { useState } from 'react'
import Planner2D from './Planner2D'
import ThreeDView from './ThreeDView'
import catalog from './catalog'

export default function App() {
  const [room, setRoom] = useState({ width: 1200, depth: 800 })
  const [items, setItems] = useState([]) // placed cabinets
  const [selected, setSelected] = useState(null)

  return (
    <div className="app">
      <header>
        <h1>Kitchen Planner ASAB DESIGN 0.0.2— React (Konva) + Three.js</h1>
      </header>
      <main>
        <aside className="sidebar">
          <h3>Catalog</h3>
          {catalog.map(c => (
            <button
              key={c.id}
              onClick={() => {
                const id = `${c.id}-${Date.now()}`
                setItems([...items, { ...c, uid: id, x: 20, y: 20 }])
              }}
            >
              {c.title} — {c.width}mm
            </button>
          ))}

          <hr />

          <div>
            <label>Room width (mm):</label>
            <input
              type="number"
              value={room.width}
              onChange={e =>
                setRoom({ ...room, width: Number(e.target.value) || 0 })
              }
            />
          </div>
          <div>
            <label>Room depth (mm):</label>
            <input
              type="number"
              value={room.depth}
              onChange={e =>
                setRoom({ ...room, depth: Number(e.target.value) || 0 })
              }
            />
          </div>

          <hr />

          <button
            onClick={() => {
              const dataStr =
                'data:text/json;charset=utf-8,' +
                encodeURIComponent(JSON.stringify({ room, items }, null, 2))
              const a = document.createElement('a')
              a.href = dataStr
              a.download = 'plan.json'
              a.click()
            }}
          >
            Export JSON
          </button>
        </aside>

        <section className="canvas-area">
          <Planner2D
            room={room}
            items={items}
            onChange={setItems}
            selected={selected}
            setSelected={setSelected}
          />
        </section>

        <section className="three-area">
          <ThreeDView room={room} items={items} onChange={setItems} />
        </section>
      </main>
    </div>
  )
}
