export interface Placement {
  deviceId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  locked: boolean;
  status: 'candidate' | 'reviewed' | 'approved';
}

export interface LayoutViewIssue {
  code: string;
  entityId?: string;
  severity: 'error' | 'warn';
  message: string;
}

export interface ArtifactRef {
  format: 'dxf' | 'svg';
  bytes: number;
  href: string;
}

export interface PanelLayoutAdapter {
  loadProject(eir: unknown): Promise<void>;
  getPlacements(): Promise<Placement[]>;
  applyPlacements(input: Placement[]): Promise<void>;
  lockDevice(deviceId: string, locked: boolean): Promise<void>;
  validateView(): Promise<LayoutViewIssue[]>;
  export(format: 'dxf' | 'svg'): Promise<ArtifactRef>;
}
