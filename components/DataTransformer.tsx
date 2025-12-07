import React, { useState, useEffect } from 'react';
import { HarEntry, ExtractedEntity } from '../types';
import { Play, Save, AlertCircle } from 'lucide-react';

interface DataTransformerProps {
  selectedEntry: HarEntry | null;
  onExtract: (entities: ExtractedEntity[]) => void;
}

const DEFAULT_TRANSFORMER = `// Write JS code to extract data from the HAR entry
// The 'entry' variable is available.
// Return an ARRAY of objects: { id, type, label, data: {...} }

const responseBody = entry.response.content.text;
if (!responseBody) return [];

try {
  const json = JSON.parse(responseBody);
  
  // Example: Detect if this is a project list
  if (json.data && Array.isArray(json.data.projects)) {
    return json.data.projects.map(p => ({
        id: p.id,
        type: 'Project',
        label: p.name,
        data: p
    }));
  }
  
  // Return generic if unknown
  return [{
      id: entry.request.url,
      type: 'GenericResponse',
      label: 'Response Data',
      data: json
  }];

} catch (e) {
  return [];
}
`;

const DataTransformer: React.FC<DataTransformerProps> = ({ selectedEntry, onExtract }) => {
  const [code, setCode] = useState(DEFAULT_TRANSFORMER);
  const [preview, setPreview] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  const runTransformation = () => {
    if (!selectedEntry) return;

    try {
      setError(null);
      // eslint-disable-next-line no-new-func
      const transformFn = new Function('entry', code);
      const result = transformFn(selectedEntry);
      
      if (!Array.isArray(result)) {
        throw new Error("Transformer must return an array.");
      }
      setPreview(result);
    } catch (err: any) {
      setError(err.message);
      setPreview([]);
    }
  };

  const handleApply = () => {
      if (preview.length > 0) {
          onExtract(preview);
      }
  };

  useEffect(() => {
      if (selectedEntry) {
          runTransformation();
      }
  }, [selectedEntry]);

  return (
    <div className="flex flex-col h-full bg-gray-900 text-white">
      <div className="bg-gray-800 p-2 border-b border-gray-700 flex justify-between items-center">
        <h3 className="text-sm font-semibold text-gray-300">Transformation Logic (JavaScript)</h3>
        <div className="flex gap-2">
            <button 
                onClick={runTransformation}
                className="flex items-center gap-1 px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs transition-colors"
            >
                <Play size={14} /> Test
            </button>
            <button 
                onClick={handleApply}
                disabled={preview.length === 0}
                className="flex items-center gap-1 px-3 py-1 bg-blue-600 hover:bg-blue-500 rounded text-xs transition-colors disabled:opacity-50"
            >
                <Save size={14} /> Add to Graph
            </button>
        </div>
      </div>
      
      <div className="flex-1 flex flex-col md:flex-row">
        {/* Code Editor */}
        <div className="w-full md:w-1/2 border-r border-gray-700 p-0">
            <textarea
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="w-full h-full bg-[#1e1e1e] text-green-400 font-mono text-xs p-4 focus:outline-none resize-none"
                spellCheck={false}
            />
        </div>

        {/* Preview Panel */}
        <div className="w-full md:w-1/2 flex flex-col bg-[#0d1117]">
             <div className="p-2 border-b border-gray-800 bg-gray-900 text-xs text-gray-500 uppercase">
                Output Preview
             </div>
             <div className="flex-1 overflow-auto p-4 font-mono text-xs">
                {error ? (
                    <div className="text-red-400 flex items-center gap-2">
                        <AlertCircle size={16} />
                        {error}
                    </div>
                ) : (
                    <pre className="text-yellow-300 whitespace-pre-wrap">
                        {JSON.stringify(preview, null, 2)}
                    </pre>
                )}
             </div>
        </div>
      </div>
    </div>
  );
};

export default DataTransformer;
