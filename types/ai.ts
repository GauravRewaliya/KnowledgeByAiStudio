import { Type } from "@google/genai";

export interface FuncProp {
  name: string;
  type: Type; // Corresponds to GoogleGenAI's Type enum
  title?: string;
  description?: string;
  default?: string | number | boolean | Record<string, any> | Array<any>;
  optional?: boolean;
  role?: "arg" | "config"; // 'arg' for direct argument, 'config' for model config (not used in current tools)
  
  // Extra properties for UI hints
  min?: number;
  max?: number;
  step?: number;
  options?: Array<{ label: string; value: string | number }>;
  dataSource?: string; // e.g., 'harEntryIndices' to fetch dynamic options from HAR data
  
  // For Array types
  items?: { type: Type };
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: Type.OBJECT;
    properties: { [key: string]: Omit<FuncProp, 'name' | 'role'> };
    required?: string[];
  };
}

// Function signature for actual tool implementations
export type ToolFunction<Args extends Record<string, any>, ReturnType> = (
  harEntries: any[], 
  args: Args
) => ReturnType;