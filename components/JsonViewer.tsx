import React, { useState } from 'react';
import { ChevronRight, ChevronDown, Copy } from 'lucide-react';

interface JsonViewerProps {
  data: any;
  label?: string;
  initialExpanded?: boolean;
}

const JsonViewer: React.FC<JsonViewerProps> = ({ data, label, initialExpanded = false }) => {
  const [expanded, setExpanded] = useState(initialExpanded);
  const [copied, setCopied] = useState(false);

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

  if (!isObject) {
    const isString = typeof data === 'string';
    const isNumber = typeof data === 'number';
    const isBool = typeof data === 'boolean';
    
    return (
      <div className="flex items-start font-mono text-xs ml-4">
        {label && <span className="text-purple-300 mr-1">{label}:</span>}
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
    <div className="font-mono text-xs ml-2 select-text">
      <div 
        className={`flex items-center gap-1 cursor-pointer hover:bg-gray-800/50 rounded p-0.5 ${isEmpty ? 'cursor-default' : ''}`}
        onClick={toggle}
      >
        {isObject && !isEmpty ? (
          expanded ? <ChevronDown size={12} className="text-gray-500" /> : <ChevronRight size={12} className="text-gray-500" />
        ) : <div className="w-3" />}
        
        {label && <span className="text-purple-300">{label}:</span>}
        
        <span className="text-gray-400">
          {isArray ? '[' : '{'}
          {!expanded && !isEmpty && <span className="mx-1 text-gray-600">...</span>}
          {isEmpty && (isArray ? ']' : '}')}
        </span>
        
        {!isEmpty && !expanded && (
           <span className="text-gray-600 ml-1">
             {isArray ? `${data.length} items` : `${Object.keys(data).length} keys`}
           </span>
        )}

        <button onClick={handleCopy} className="ml-auto opacity-0 group-hover:opacity-100 hover:text-white text-gray-600">
            {copied ? <span className="text-[10px] text-green-500">Copied</span> : <Copy size={10} />}
        </button>
      </div>

      {expanded && !isEmpty && (
        <div className="border-l border-gray-700 ml-1.5 pl-2">
           {isArray ? (
               data.map((item: any, idx: number) => (
                   <JsonViewer key={idx} data={item} label={String(idx)} />
               ))
           ) : (
               Object.entries(data).map(([key, value]) => (
                   <JsonViewer key={key} data={value} label={key} />
               ))
           )}
           <div className="ml-2 text-gray-400">{isArray ? ']' : '}'}</div>
        </div>
      )}
    </div>
  );
};

export default JsonViewer;
