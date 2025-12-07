
import React, { useState, useMemo, useEffect } from 'react';
import { allToolDefinitions, toolImplementations } from '../tools';
import { Type } from "@google/genai";
import { FuncProp, ToolDefinition } from '../types/ai';
import { useProjectStore } from '../store/projectStore';
import { Play, ClipboardCopy, CheckCircle2 } from 'lucide-react';
import JsonViewer from './JsonViewer';

const TestToolPage: React.FC = () => {
  const { activeProject } = useProjectStore();
  const harEntries = activeProject?.harEntries || [];

  const [selectedToolName, setSelectedToolName] = useState<string>(allToolDefinitions[0]?.name || '');
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [toolOutput, setToolOutput] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);

  const selectedTool: ToolDefinition | undefined = useMemo(
    () => allToolDefinitions.find(tool => tool.name === selectedToolName),
    [selectedToolName]
  );

  const dynamicOptions = useMemo(() => {
    const options: Record<string, Array<{ label: string; value: string | number }>> = {};
    if (harEntries.length > 0) {
      options.harEntryIndices = harEntries.map(entry => ({
        label: `${entry._index}: ${entry.request.method} ${new URL(entry.request.url).pathname.split('/').pop() || entry.request.url}`,
        value: entry._index
      }));
    }
    return options;
  }, [harEntries]);

  useEffect(() => {
    if (selectedTool) {
      const initialData: Record<string, any> = {};
      Object.entries(selectedTool.parameters.properties).forEach(([key, prop]) => {
        initialData[key] = prop.default ?? ''; 
      });
      setFormData(initialData);
      setToolOutput(null);
      setError(null);
    }
  }, [selectedTool]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    let processedValue: any = value;

    const prop = selectedTool?.parameters.properties[name] as FuncProp;
    if (prop) {
      if (prop.type === Type.NUMBER) {
        processedValue = parseFloat(value);
      } else if (prop.type === Type.BOOLEAN) {
        processedValue = value === 'true';
      }
    }
    
    setFormData(prev => ({ ...prev, [name]: processedValue }));
  };

  const handleRunTool = async () => {
    if (!selectedTool || !toolImplementations[selectedTool.name]) {
      setError("Selected tool not found or not implemented.");
      return;
    }

    setError(null);
    setToolOutput(null);

    try {
      const result = await toolImplementations[selectedTool.name](harEntries, formData);
      setToolOutput(result);
    } catch (err: any) {
      setError(`Error running tool: ${err.message}`);
      console.error("Tool execution error:", err);
    }
  };

  const handleCopyOutput = () => {
    if (toolOutput) {
      navigator.clipboard.writeText(JSON.stringify(toolOutput, null, 2));
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    }
  };

  const renderFormInput = (propName: string, prop: Omit<FuncProp, 'name' | 'role'>) => {
    const commonProps = {
      id: propName,
      name: propName,
      value: formData[propName] ?? '',
      onChange: handleInputChange,
      className: "w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500",
      placeholder: prop.description,
      required: !prop.optional,
    };

    if (prop.dataSource && dynamicOptions[prop.dataSource]) {
      return (
        <select {...commonProps}>
          <option value="" disabled>{prop.title || propName}</option>
          {dynamicOptions[prop.dataSource].map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      );
    }

    if (prop.options && prop.options.length > 0) {
      return (
        <select {...commonProps}>
          {prop.options.map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      );
    }

    switch (prop.type) {
      case Type.STRING:
        if (propName === 'code') {
          return (
            <textarea
              {...commonProps}
              rows={10}
              className="w-full bg-[#1e1e1e] border border-gray-600 rounded p-3 font-mono text-green-400 text-xs focus:outline-none focus:border-blue-500 resize-y"
              spellCheck={false}
            />
          );
        }
        return <input type="text" {...commonProps} />;
      case Type.NUMBER:
        return <input type="number" {...commonProps} min={prop.min} max={prop.max} step={prop.step} />;
      case Type.BOOLEAN:
        return (
          <select {...commonProps}>
            <option value="true">True</option>
            <option value="false">False</option>
          </select>
        );
      case Type.OBJECT:
      case Type.ARRAY:
        return (
          <textarea
            {...commonProps}
            rows={5}
            className="w-full bg-gray-700 border border-gray-600 rounded p-3 font-mono text-white text-xs focus:outline-none focus:border-blue-500 resize-y"
            placeholder={`Enter JSON for ${prop.title || propName}`}
          />
        );
      default:
        return <input type="text" {...commonProps} />;
    }
  };

  if (!selectedToolName && allToolDefinitions.length > 0) {
    setSelectedToolName(allToolDefinitions[0].name);
  }

  return (
    <div className="flex flex-col h-full w-full bg-gray-900 text-white">
      <div className="p-4 border-b border-gray-700 bg-gray-800 flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-200">Tool Tester</h2>
        <select
          value={selectedToolName}
          onChange={(e) => setSelectedToolName(e.target.value)}
          className="bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
        >
          {allToolDefinitions.map(tool => (
            <option key={tool.name} value={tool.name}>
              {tool.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        <div className="w-full md:w-1/2 p-4 border-r border-gray-700 overflow-y-auto">
          {selectedTool ? (
            <form className="space-y-4">
              <p className="text-gray-400 text-sm mb-4">{selectedTool.description}</p>
              {Object.entries(selectedTool.parameters.properties).map(([key, prop]) => (
                <div key={key} className="flex flex-col">
                  <label htmlFor={key} className="text-sm font-medium text-gray-300 mb-1">
                    {prop.title || key} {prop.optional ? '(Optional)' : ''}
                  </label>
                  {renderFormInput(key, prop)}
                  {prop.description && <p className="text-xs text-gray-500 mt-1">{prop.description}</p>}
                </div>
              ))}
              <button
                type="button"
                onClick={handleRunTool}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded text-white font-medium transition-colors"
                disabled={harEntries.length === 0}
              >
                <Play size={16} /> Run Tool
              </button>
              {harEntries.length === 0 && (
                  <p className="text-sm text-red-400 mt-2">Upload HAR entries to test tools.</p>
              )}
            </form>
          ) : (
            <p className="text-gray-400">No tool selected or defined.</p>
          )}
        </div>

        <div className="w-full md:w-1/2 p-4 flex flex-col bg-gray-800 overflow-hidden">
          <div className="flex items-center justify-between border-b border-gray-700 pb-3 mb-3">
            <h3 className="text-lg font-semibold text-gray-200">Tool Output</h3>
            <button
              onClick={handleCopyOutput}
              disabled={!toolOutput}
              className="flex items-center gap-1 px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs transition-colors disabled:opacity-50"
            >
              {isCopied ? <CheckCircle2 size={14} className="text-green-400" /> : <ClipboardCopy size={14} />}
              {isCopied ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <div className="flex-1 bg-gray-900 rounded p-3 overflow-auto font-mono text-xs border border-gray-700">
            {error ? (
              <pre className="text-red-400 whitespace-pre-wrap">{error}</pre>
            ) : toolOutput ? (
              <JsonViewer data={toolOutput} initialExpanded={true} />
            ) : (
              <p className="text-gray-500">Run a tool to see output here.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TestToolPage;
