import { useMemo, useEffect } from 'react'
import { ReactFlow, Background, Controls, useNodesState, useEdgesState } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import MemberNode from './MemberNode'
import { buildTreeLayout } from '../utils/treeLayout'

const nodeTypes = { memberNode: MemberNode }

export default function FamilyTree({ members }) {
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

  return (
    <div className="w-full h-80 md:h-[420px]">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView
        minZoom={0.3}
        maxZoom={2}
      >
        <Background color="#e7e5e4" gap={24} size={1} />
        <Controls className="!rounded-xl !border-stone-200 !shadow-lg !shadow-stone-200/50" />
      </ReactFlow>
    </div>
  )
}
