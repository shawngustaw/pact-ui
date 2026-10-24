import { useSearchParams } from 'next/navigation';
import Link from '@/components/link';
import { useEffect, useMemo, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  MarkerType,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Search, ArrowUpRight, Box, Network } from 'lucide-react';
import { useDirectory } from '@/lib/domain/queries';
import { applicationStatus } from '@/lib/domain/models';
import { Loading, ErrorState, Empty } from './ui/feedback';
export function Dependencies() {
  const { apps, relationships, contracts } = useDirectory(),
    [search, setSearch] = useState(''),
    [selected, setSelected] = useState(''),
    [direction, setDirection] = useState('both');
  const searchParams = useSearchParams();
  useEffect(() => {
    setSelected(searchParams.get('focus') || '');
  }, [searchParams]);
  const computed = useMemo(() => {
    const all = apps.data || [],
      relations = relationships.data || [],
      highlight = new Set<string>();
    if (selected) {
      highlight.add(selected);
      const queue = [selected];
      while (queue.length) {
        const name = queue.shift();
        for (const r of relations) {
          const next =
            direction === 'upstream'
              ? r.consumer.name === name
                ? r.provider.name
                : undefined
              : direction === 'downstream'
                ? r.provider.name === name
                  ? r.consumer.name
                  : undefined
                : r.consumer.name === name
                  ? r.provider.name
                  : r.provider.name === name
                    ? r.consumer.name
                    : undefined;
          if (next && !highlight.has(next)) {
            highlight.add(next);
            queue.push(next);
          }
        }
      }
    }
    const names = new Set(
      all.filter((a) => a.name.toLowerCase().includes(search.toLowerCase())).map((a) => a.name),
    );
    const levels = new Map(all.map((a) => [a.name, 0])),
      indegree = new Map(all.map((a) => [a.name, 0]));
    relations.forEach((r) =>
      indegree.set(r.provider.name, (indegree.get(r.provider.name) || 0) + 1),
    );
    const queue = [...indegree].filter(([, count]) => count === 0).map(([name]) => name);
    while (queue.length) {
      const name = queue.shift()!;
      for (const r of relations.filter((r) => r.consumer.name === name)) {
        levels.set(
          r.provider.name,
          Math.max(levels.get(r.provider.name) || 0, (levels.get(name) || 0) + 1),
        );
        const count = (indegree.get(r.provider.name) || 1) - 1;
        indegree.set(r.provider.name, count);
        if (!count) queue.push(r.provider.name);
      }
    }
    const columns = new Map<number, number>();
    const nodes: Node[] = all
      .filter((a) => names.has(a.name))
      .map((a) => {
        const level = Math.min(levels.get(a.name) || 0, 8),
          row = columns.get(level) || 0;
        columns.set(level, row + 1);
        const status = contracts.data ? applicationStatus(a.name, contracts.data) : 'unknown';
        return {
          id: a.name,
          position: { x: level * 310, y: row * 132 },
          sourcePosition: 'right' as Node['sourcePosition'],
          targetPosition: 'left' as Node['targetPosition'],
          ariaLabel: a.name,
          className: `graph-node ${selected === a.name ? 'graph-selected' : ''} ${selected && !highlight.has(a.name) ? 'graph-dimmed' : ''}`,
          data: {
            label: (
              <div className="graph-node-label">
                <span>
                  <Box size={16} />
                  <strong>{a.name}</strong>
                  <Link
                    href={`/applications/${encodeURIComponent(a.name)}`}
                    aria-label={`Open ${a.name}`}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <ArrowUpRight size={13} />
                  </Link>
                </span>
                <small>
                  <i
                    className={`dot ${status === 'failed' ? 'failed' : status === 'verified' ? 'success' : 'unknown'}`}
                  />
                  {status} · {a.mainBranch || 'branch not set'}
                </small>
              </div>
            ),
          },
        };
      });
    const edges: Edge[] = relations
      .filter((r) => names.has(r.consumer.name) && names.has(r.provider.name))
      .map((r, i) => ({
        id: String(i),
        source: r.consumer.name,
        target: r.provider.name,
        markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 },
        style: {
          stroke:
            selected && highlight.has(r.consumer.name) && highlight.has(r.provider.name)
              ? 'var(--accent)'
              : 'var(--graph-edge)',
          strokeWidth: 1.5,
          opacity:
            selected && (!highlight.has(r.consumer.name) || !highlight.has(r.provider.name))
              ? 0.15
              : 1,
        },
      }));
    return { nodes, edges };
  }, [apps.data, relationships.data, contracts.data, search, selected, direction]);
  const [nodes, setNodes, onNodesChange] = useNodesState(computed.nodes),
    [edges, setEdges, onEdgesChange] = useEdgesState(computed.edges);
  useEffect(() => {
    setNodes(computed.nodes);
    setEdges(computed.edges);
  }, [computed, setNodes, setEdges]);
  if (apps.isPending || relationships.isPending)
    return <Loading label="Building dependency graph…" />;
  if (apps.error || relationships.error)
    return (
      <ErrorState
        error={apps.error || relationships.error}
        retry={() => {
          void apps.refetch();
          void relationships.refetch();
        }}
      />
    );
  return (
    <div className="page graph-page">
      <div className="page-heading">
        <div>
          <h1>Dependency graph</h1>
          <p>
            Follow the contracts that connect your applications. Arrows point from consumer to
            provider.
          </p>
        </div>
        <span className="subtle-label">
          {apps.data?.length} applications · {relationships.data?.length} relationships
        </span>
      </div>
      <div className="graph-panel">
        <div className="table-toolbar">
          <label className="search-field">
            <Search size={14} />
            <input
              aria-label="Search dependency graph"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Find an application…"
            />
          </label>
          <div className="toolbar-controls">
            <select
              className="select"
              aria-label="Focus application"
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
            >
              <option value="">All applications</option>
              {apps.data?.map((a) => (
                <option key={a.name}>{a.name}</option>
              ))}
            </select>
            <select
              className="select"
              aria-label="Highlight dependency direction"
              value={direction}
              onChange={(e) => setDirection(e.target.value)}
            >
              <option value="both">All connections</option>
              <option value="upstream">Providers · upstream</option>
              <option value="downstream">Consumers · downstream</option>
            </select>
          </div>
        </div>
        <div className="graph-canvas" aria-label="Interactive dependency graph">
          {nodes.length ? (
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onNodeClick={(_, node) => setSelected(selected === node.id ? '' : node.id)}
              fitView
              minZoom={0.25}
              maxZoom={1.8}
              fitViewOptions={{ padding: 0.15 }}
              nodesConnectable={false}
              edgesReconnectable={false}
              deleteKeyCode={null}
              proOptions={{ hideAttribution: true }}
            >
              <Background color="var(--border)" gap={24} size={1} />
              <Controls showInteractive={false} />
              <MiniMap nodeColor="var(--graph-minimap)" maskColor="var(--graph-mask)" />
            </ReactFlow>
          ) : (
            <Empty title="No matching applications" />
          )}
        </div>
        <div className="table-footer">
          <span>
            <Network size={12} />
            Select an application to highlight its dependencies
          </span>
          <span>Scroll to zoom · Drag to pan</span>
        </div>
      </div>
    </div>
  );
}
