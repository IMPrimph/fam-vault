import { useState, useMemo, useEffect } from 'react'
import { ReactFlow, Background, Controls, useNodesState, useEdgesState } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import MemberNode from './MemberNode'
import { buildTreeLayout } from '../utils/treeLayout'

const nodeTypes = { memberNode: MemberNode }

export default function FamilyTree({ members }) {
  const [fullscreen, setFullscreen] = useState(false)

  const { nodes: layoutNodes, edges: layoutEdges } = useMemo(
    () => buildTreeLayout(members),
    [members]
  )

  const [nodes, setNodes, onNodesChange] = useNodesState(layoutNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(layoutEdges)

  useEffect(() => {
    setNodes(layoutNodes)
    setEdges(layoutEdges)
  }, [layoutNodes, layoutEdges])

  // Close fullscreen on Escape
  useEffect(() => {
    if (!fullscreen) return
    function handleKey(e) { if (e.key === 'Escape') setFullscreen(false) }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [fullscreen])

  const containerClass = fullscreen
    ? 'fixed inset-0 z-50 bg-surface'
    : 'w-full h-80 md:h-[420px]'

  return (
    <div className={containerClass}>
      {fullscreen && (
        <button
          onClick={() => setFullscreen(false)}
          className="absolute top-3 right-3 z-10 px-3 py-1.5 bg-surface-card border border-stone-200 rounded-lg text-xs font-medium text-text-secondary hover:bg-surface-hover transition-colors shadow-sm"
        >
          Exit Fullscreen
        </button>
      )}
      {!fullscreen && (
        <button
          onClick={() => setFullscreen(true)}
          aria-label="Fullscreen"
          className="absolute top-3 right-3 z-10 p-1.5 bg-surface-card/80 backdrop-blur border border-stone-200/60 rounded-lg text-text-muted hover:text-text-secondary transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" /></svg>
        </button>
      )}
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView
        minZoom={0.2}
        maxZoom={2}
      >
        <Background color="#e7e5e4" gap={24} size={1} />
        <Controls className="!rounded-xl !border-stone-200 !shadow-lg !shadow-stone-200/50" />
      </ReactFlow>
    </div>
  )
}
