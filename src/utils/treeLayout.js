const NODE_WIDTH = 180
const NODE_HEIGHT = 80
const H_GAP = 60
const V_GAP = 120

export function buildTreeLayout(members) {
  if (!members.length) return { nodes: [], edges: [] }

  const byId = Object.fromEntries(members.map(m => [m.id, m]))
  const nodes = []
  const edges = []

  // Group by generation: find roots (no parent), then BFS down
  const roots = members.filter(m => !m.parent_member_id)
  const visited = new Set()
  const generations = []

  let currentGen = roots.map(m => m.id)
  while (currentGen.length) {
    generations.push(currentGen)
    currentGen.forEach(id => visited.add(id))
    const nextGen = []
    for (const id of currentGen) {
      const children = members.filter(m => m.parent_member_id === id && !visited.has(m.id))
      const member = byId[id]
      if (member?.spouse_member_id) {
        const spouseChildren = members.filter(
          m => m.parent_member_id === member.spouse_member_id && !visited.has(m.id)
        )
        children.push(...spouseChildren)
      }
      children.forEach(c => {
        if (!visited.has(c.id)) nextGen.push(c.id)
      })
    }
    currentGen = [...new Set(nextGen)]
  }

  // Add unvisited members (orphans) to last generation
  const orphans = members.filter(m => !visited.has(m.id)).map(m => m.id)
  if (orphans.length) generations.push(orphans)

  // Position nodes
  let y = 0
  for (const gen of generations) {
    const placed = new Set()
    const units = []

    for (const id of gen) {
      if (placed.has(id)) continue
      placed.add(id)
      const member = byId[id]
      if (member?.spouse_member_id && gen.includes(member.spouse_member_id) && !placed.has(member.spouse_member_id)) {
        placed.add(member.spouse_member_id)
        units.push([id, member.spouse_member_id])
      } else {
        units.push([id])
      }
    }

    let totalWidth = 0
    for (const unit of units) {
      totalWidth += unit.length * NODE_WIDTH + (unit.length - 1) * 20
    }
    totalWidth += (units.length - 1) * H_GAP

    let x = -totalWidth / 2
    for (const unit of units) {
      for (let i = 0; i < unit.length; i++) {
        const m = byId[unit[i]]
        nodes.push({
          id: m.id,
          type: 'memberNode',
          position: { x, y },
          data: { member: m, docCount: m.documents?.length || 0 },
        })

        if (i === 1) {
          edges.push({
            id: `spouse-${unit[0]}-${unit[1]}`,
            source: unit[0],
            target: unit[1],
            type: 'straight',
            style: { stroke: '#f59e0b', strokeDasharray: '5,5' },
          })
        }

        x += NODE_WIDTH + 20
      }
      x += H_GAP
    }

    y += NODE_HEIGHT + V_GAP
  }

  // Parent-child edges
  for (const m of members) {
    if (m.parent_member_id && byId[m.parent_member_id]) {
      edges.push({
        id: `parent-${m.parent_member_id}-${m.id}`,
        source: m.parent_member_id,
        target: m.id,
        type: 'smoothstep',
        style: { stroke: '#6b7280' },
      })
    }
  }

  return { nodes, edges }
}
