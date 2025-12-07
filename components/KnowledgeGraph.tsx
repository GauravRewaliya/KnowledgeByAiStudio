import React, { useEffect, useRef, useState } from 'react';
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
import { ZoomIn, ZoomOut, RefreshCw } from 'lucide-react';

interface KnowledgeGraphProps {
  onNodeClick?: (node: ExtractedEntity) => void;
}

const KnowledgeGraph: React.FC<KnowledgeGraphProps> = ({ onNodeClick }) => {
  const { activeProject } = useProjectStore();
  const data = activeProject?.knowledgeData || { nodes: [], links: [] };

  const svgRef = useRef<SVGSVGElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [zoomLevel, setZoomLevel] = useState(1);

  useEffect(() => {
    if (!data.nodes.length || !svgRef.current || !wrapperRef.current) return;

    const width = wrapperRef.current.clientWidth;
    const height = wrapperRef.current.clientHeight;

    const svg = select(svgRef.current);
    svg.selectAll("*").remove(); // Clear previous

    const nodes = data.nodes.map(d => ({ ...d }));
    const links = data.links.map(d => ({ ...d }));

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
      .attr("fill", (d: any) => {
          if (d.type === 'Project') return '#3b82f6';
          if (d.type === 'Exam') return '#10b981';
          if (d.type === 'Paper') return '#f59e0b';
          if (d.type === 'Question') return '#ef4444';
          return '#6b7280';
      })
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
  }, [data]);

  return (
    <div ref={wrapperRef} className="w-full h-full relative bg-gray-900 overflow-hidden">
        <svg ref={svgRef} className="w-full h-full cursor-move"></svg>
        <div className="absolute bottom-4 right-4 flex flex-col gap-2 bg-gray-800 p-2 rounded shadow-lg">
             <div className="text-xs text-center text-gray-400 mb-1">{Math.round(zoomLevel * 100)}%</div>
             <button className="p-1 hover:bg-gray-700 rounded"><ZoomIn size={16} /></button>
             <button className="p-1 hover:bg-gray-700 rounded"><ZoomOut size={16} /></button>
             <button className="p-1 hover:bg-gray-700 rounded"><RefreshCw size={16} /></button>
        </div>
        
        <div className="absolute top-4 left-4 bg-gray-800/80 backdrop-blur p-3 rounded border border-gray-700">
            <h4 className="text-xs font-bold text-gray-300 mb-2 uppercase tracking-wider">Legend</h4>
            <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-blue-500"></div><span className="text-xs text-gray-400">Project</span></div>
                <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-green-500"></div><span className="text-xs text-gray-400">Exam</span></div>
                <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-yellow-500"></div><span className="text-xs text-gray-400">Paper</span></div>
                <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-red-500"></div><span className="text-xs text-gray-400">Question</span></div>
                <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-gray-500"></div><span className="text-xs text-gray-400">Other</span></div>
            </div>
        </div>
    </div>
  );
};

export default KnowledgeGraph;