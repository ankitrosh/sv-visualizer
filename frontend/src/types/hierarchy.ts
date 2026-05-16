export type Direction = 'input' | 'output' | 'inout';

export interface Port {
  direction: Direction;
  name: string;
  width?: string;
}

export interface Connection {
  port: string;
  signal: string;
}

export interface HierarchyNode {
  name: string;
  instance_name: string;
  file: string | null;
  ports: Port[];
  connections: Connection[];
  children: HierarchyNode[];
  circular?: boolean;
}

export interface HierarchyFile {
  hierarchy: HierarchyNode;
  file_tree?: unknown;
}
