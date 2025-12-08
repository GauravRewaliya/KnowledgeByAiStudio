
import React, { useEffect, useRef, useState, useMemo } from 'react';
import { 
  select, 
  forceSimulation, 
  forceLink, 
  forceManyBody, 
  forceCenter, 
  forceCollide, 
  zoom as d3Zoom, 
  drag as d3Drag 
} from 'd3';
import { ExtractedEntity } from '../types';
import { useProjectStore } from '../store/projectStore';
import { ZoomIn, ZoomOut, RefreshCw, Filter } from 'lucide-react';

interface KnowledgeGraphProps {
  onNodeClick?: (node: ExtractedEntity) => void;
}

const KnowledgeGraph: React.FC<KnowledgeGraphProps> = ({ onNodeClick }) => {
  const { activeProject } = useProjectStore();
  const rawData = activeProject?.knowledgeData || { nodes: [], links: [] };

  const svgRef = useRef<SVGSVGElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [selectedLabel, setSelectedLabel] = useState<string | null>(null);

  // --- Filtering Logic ---
  // If a label is selected, show nodes of that label AND any nodes connected to them.
  const filteredData = useMemo(() => {
    if (!selectedLabel) return rawData;

    const targetNodeIds = new Set(
        rawData.nodes.filter(n => n.type === selectedLabel).map(n => n.id)
    );

    // Find links connected to these nodes
    const relevantLinks = rawData.links.filter(l => 
        targetNodeIds.has(l.source) || targetNodeIds.has(l.target)
    );

    // Add neighbors to the set of nodes to show
    relevantLinks.forEach(l => {
        targetNodeIds.add(l.source);
        targetNodeIds.add(l.target);
    });

    const nodes = rawData.nodes.filter(n => targetNodeIds.has(n.id));
    // Filter links to only those where both source/target are in the node set
    // Note: D3 force layout modifies link objects, so we must be careful with IDs vs Objects if re-running.
    // Here we just use the raw IDs from store, D3 will objectify them.
    const validNodeIds = new Set(nodes.map(n => n.id));
    const links = rawData.links.filter(l => validNodeIds.has(l.source) && validNodeIds.has(l.target));

    return { nodes, links };
  }, [rawData, selectedLabel]);

  // Extract unique labels for legend
  const labels = useMemo(() => {
      const set = new Set(rawData.nodes.map(n => n.type));
      return Array.from(set);
  }, [rawData]);

  useEffect(() => {
    if (!filteredData.nodes.length && !selectedLabel) {
        // Clear if empty
        const svg = select(svgRef.current);
        svg.selectAll("*").remove();
        return;
    }
    
    if (!svgRef.current || !wrapperRef.current) return;

    const width = wrapperRef.current.clientWidth;
    const height = wrapperRef.current.clientHeight;

    const svg = select(svgRef.current);
    svg.selectAll("*").remove(); 

    // Deep copy for D3 mutation
    const nodes = filteredData.nodes.map(d => ({ ...d }));
    const links = filteredData.links.map(d => ({ ...d }));

    const simulation = forceSimulation(nodes as any)
      .force("link", forceLink(links).id((d: any) => d.id).distance(100))
      .force("charge", forceManyBody().strength(-200))
      .force("center", forceCenter(width / 2, height / 2))
      .force("collide", forceCollide(30));

    const g = svg.append("g");
    const zoom = d3Zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
        setZoomLevel(event.transform.k);
      });

    svg.call(zoom);

    const link = g.append("g")
      .attr("stroke", "#4b5563")
      .attr("stroke-opacity", 0.6)
      .selectAll("line")
      .data(links)
      .join("line")
      .attr("stroke-width", 1.5);

    const node = g.append("g")
      .attr("stroke", "#fff")
      .attr("stroke-width", 1.5)
      .selectAll("circle")
      .data(nodes)
      .join("circle")
      .attr("r", 8)
      .attr("fill", (d: any) => getColorForType(d.type))
      .call(d3Drag<any, any>()
        .on("start", dragstarted)
        .on("drag", dragged)
        .on("end", dragended));

    const text = g.append("g")
        .selectAll("text")
        .data(nodes)
        .join("text")
        .text((d: any) => d.label)
        .attr("x", 12)
        .attr("y", 4)
        .attr("fill", "#cbd5e1") 
        .attr("font-size", "10px")
        .attr("pointer-events", "none");

    node.on("click", (event, d: any) => {
        if (onNodeClick) onNodeClick(d as ExtractedEntity);
    });

    simulation.on("tick", () => {
      link
        .attr("x1", (d: any) => d.source.x)
        .attr("y1", (d: any) => d.source.y)
        .attr("x2", (d: any) => d.target.x)
        .attr("y2", (d: any) => d.target.y);

      node
        .attr("cx", (d: any) => d.x)
        .attr("cy", (d: any) => d.y);
        
      text
        .attr("x", (d: any) => d.x + 10)
        .attr("y", (d: any) => d.y + 3);
    });

    function dragstarted(event: any) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      event.subject.fx = event.subject.x;
      event.subject.fy = event.subject.y;
    }

    function dragged(event: any) {
      event.subject.fx = event.x;
      event.subject.fy = event.y;
    }

    function dragended(event: any) {
      if (!event.active) simulation.alphaTarget(0);
      event.subject.fx = null;
      event.subject.fy = null;
    }
    
    return () => {
      simulation.stop();
    };
  }, [filteredData, wrapperRef.current?.clientWidth, wrapperRef.current?.clientHeight]);

  const getColorForType = (type: string) => {
      switch (type) {
          case 'Project': return '#3b82f6';
          case 'Exam': return '#10b981';
          case 'Paper': return '#f59e0b';
          case 'Question': return '#ef4444';
          default: return '#6b7280';
      }
  };

  return (
    <div ref={wrapperRef} className="w-full h-full relative bg-gray-900 overflow-hidden">
        <svg ref={svgRef} className="w-full h-full cursor-move"></svg>
        
        {/* Controls */}
        <div className="absolute bottom-4 right-4 flex flex-col gap-2 bg-gray-800 p-2 rounded shadow-lg">
             <div className="text-xs text-center text-gray-400 mb-1">{Math.round(zoomLevel * 100)}%</div>
             <button className="p-1 hover:bg-gray-700 rounded"><ZoomIn size={16} /></button>
             <button className="p-1 hover:bg-gray-700 rounded"><ZoomOut size={16} /></button>
             <button className="p-1 hover:bg-gray-700 rounded"><RefreshCw size={16} /></button>
        </div>
        
        {/* Interactive Legend */}
        <div className="absolute top-4 left-4 bg-gray-800/80 backdrop-blur p-3 rounded border border-gray-700 shadow-xl max-h-[80%] overflow-y-auto">
            <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-bold text-gray-300 uppercase tracking-wider">Legend</h4>
                {selectedLabel && (
                    <button 
                        onClick={() => setSelectedLabel(null)}
                        className="text-[10px] text-red-400 hover:text-red-300 flex items-center gap-1"
                    >
                        <Filter size={10} /> Clear
                    </button>
                )}
            </div>
            <div className="flex flex-col gap-1.5">
                {labels.map(label => (
                    <div 
                        key={label} 
                        onClick={() => setSelectedLabel(selectedLabel === label ? null : label)}
                        className={`
                            flex items-center gap-2 cursor-pointer p-1 rounded transition-colors
                            ${selectedLabel === label ? 'bg-gray-700 ring-1 ring-blue-500' : 'hover:bg-gray-700/50'}
                            ${selectedLabel && selectedLabel !== label ? 'opacity-50' : 'opacity-100'}
                        `}
                    >
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: getColorForType(label) }}></div>
                        <span className="text-xs text-gray-300 font-medium">{label}</span>
                        <span className="text-[10px] text-gray-500 ml-auto">
                            {rawData.nodes.filter(n => n.type === label).length}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    </div>
  );
};

export default KnowledgeGraph;
