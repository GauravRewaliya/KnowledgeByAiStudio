
import React, { useState, useRef, useEffect } from 'react';
import { ChevronRight, ChevronDown, Copy } from 'lucide-react';

interface JsonViewerProps {
  data: any;
  label?: string;
  initialExpanded?: boolean;
  isRoot?: boolean; // New prop to identify the root of the tree
}

const JsonViewer: React.FC<JsonViewerProps> = ({ data, label, initialExpanded = false, isRoot = false }) => {
  const [expanded, setExpanded] = useState(initialExpanded);
  const [copied, setCopied] = useState(false);
  const rowRef = useRef<HTMLDivElement>(null);

  const isObject = data !== null && typeof data === 'object';
  const isArray = Array.isArray(data);
  const isEmpty = isObject && Object.keys(data).length === 0;

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(JSON.stringify(data, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const toggle = () => {
    if (isObject && !isEmpty) setExpanded(!expanded);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Only handle navigation keys
    if (!['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight', 'Enter', ' '].includes(e.key)) {
        return;
    }

    e.preventDefault();
    e.stopPropagation();

    const currentRow = e.currentTarget as HTMLElement;

    // Enter/Space: Toggle
    if (e.key === 'Enter' || e.key === ' ') {
        toggle();
        return;
    }

    // Helper to get all focusable rows in the DOM (that are visible)
    const getVisibleRows = () => {
        // We query the document for all json-nav items. 
        // Since collapsed items are removed from DOM, this returns exactly what is visible.
        // We convert to array to use indexOf.
        return Array.from(document.querySelectorAll('[data-json-nav]')) as HTMLElement[];
    };

    if (e.key === 'ArrowDown') {
        const rows = getVisibleRows();
        const idx = rows.indexOf(currentRow);
        if (idx !== -1 && idx < rows.length - 1) {
            rows[idx + 1].focus();
        }
    }

    if (e.key === 'ArrowUp') {
        const rows = getVisibleRows();
        const idx = rows.indexOf(currentRow);
        if (idx > 0) {
            rows[idx - 1].focus();
        }
    }

    if (e.key === 'ArrowRight') {
        if (isObject && !isEmpty && !expanded) {
            // Expand
            setExpanded(true);
        } else {
            // Go to next item (which will be the first child if we just expanded, or next sibling)
            // We use setTimeout to allow React to render the children before we try to focus one
            if (isObject && !isEmpty && expanded) {
                // Already expanded, move focus to first child immediately
                const rows = getVisibleRows();
                const idx = rows.indexOf(currentRow);
                if (idx !== -1 && idx < rows.length - 1) {
                    rows[idx + 1].focus();
                }
            } else {
                // It's a leaf, just move down
                const rows = getVisibleRows();
                const idx = rows.indexOf(currentRow);
                if (idx !== -1 && idx < rows.length - 1) {
                    rows[idx + 1].focus();
                }
            }
        }
    }

    if (e.key === 'ArrowLeft') {
        if (isObject && !isEmpty && expanded) {
            // Collapse
            setExpanded(false);
            // Focus remains on this row, which is correct
        } else {
            // Move to parent
            // The DOM structure is: 
            // <div data-json-nav> (Current) </div>
            // ...
            // The Parent is the previous sibling of the .pl-2 container that wraps this item.
            // Simplified approach: Find the closest parent container, then find the toggle above it.
            
            // Logic: Scan backwards in the visible rows list until we find one with lower indentation 
            // or simply use DOM traversal.
            
            const parentContainer = currentRow.parentElement?.closest('.json-tree-children');
            if (parentContainer) {
                 // The sibling immediately before the container is the parent row
                 const parentRow = parentContainer.previousElementSibling as HTMLElement;
                 if (parentRow && parentRow.hasAttribute('data-json-nav')) {
                     parentRow.focus();
                 }
            }
        }
    }
  };

  if (!isObject) {
    const isString = typeof data === 'string';
    const isNumber = typeof data === 'number';
    const isBool = typeof data === 'boolean';
    
    return (
      <div 
        ref={rowRef}
        data-json-nav="true"
        tabIndex={0}
        onKeyDown={handleKeyDown}
        className="flex items-start font-mono text-xs ml-4 py-0.5 px-1 rounded hover:bg-gray-800/50 focus:bg-blue-900/30 focus:ring-1 focus:ring-blue-500/50 focus:outline-none cursor-text transition-colors"
      >
        {label && <span className="text-purple-300 mr-1 select-none">{label}:</span>}
        <span className={`
          ${isString ? 'text-green-300' : ''}
          ${isNumber ? 'text-blue-300' : ''}
          ${isBool ? 'text-yellow-300' : ''}
          ${data === null ? 'text-gray-500' : ''}
          break-all
        `}>
          {isString ? `"${data}"` : String(data)}
        </span>
      </div>
    );
  }

  return (
    <div className="font-mono text-xs select-text">
      <div 
        ref={rowRef}
        data-json-nav="true"
        tabIndex={0}
        onKeyDown={handleKeyDown}
        className={`
            flex items-center gap-1 cursor-pointer rounded p-0.5 ml-2 transition-colors
            hover:bg-gray-800/50 
            focus:bg-blue-900/30 focus:ring-1 focus:ring-blue-500/50 focus:outline-none
            ${isEmpty ? 'cursor-default' : ''}
        `}
        onClick={(e) => { e.stopPropagation(); toggle(); }}
      >
        {isObject && !isEmpty ? (
          expanded ? <ChevronDown size={12} className="text-gray-500" /> : <ChevronRight size={12} className="text-gray-500" />
        ) : <div className="w-3" />}
        
        {label && <span className="text-purple-300 select-none">{label}:</span>}
        
        <span className="text-gray-400">
          {isArray ? '[' : '{'}
          {!expanded && !isEmpty && <span className="mx-1 text-gray-600">...</span>}
          {isEmpty && (isArray ? ']' : '}')}
        </span>
        
        {!isEmpty && !expanded && (
           <span className="text-gray-600 ml-1 select-none">
             {isArray ? `${data.length} items` : `${Object.keys(data).length} keys`}
           </span>
        )}

        <button onClick={handleCopy} className="ml-auto opacity-0 group-hover:opacity-100 hover:text-white text-gray-600 focus:opacity-100">
            {copied ? <span className="text-[10px] text-green-500">Copied</span> : <Copy size={10} />}
        </button>
      </div>

      {expanded && !isEmpty && (
        <div className="json-tree-children border-l border-gray-700 ml-3.5 pl-1">
           {isArray ? (
               data.map((item: any, idx: number) => (
                   <JsonViewer key={idx} data={item} label={String(idx)} />
               ))
           ) : (
               Object.entries(data).map(([key, value]) => (
                   <JsonViewer key={key} data={value} label={key} />
               ))
           )}
           <div className="ml-2 text-gray-400 select-none">{isArray ? ']' : '}'}</div>
        </div>
      )}
    </div>
  );
};

export default JsonViewer;
