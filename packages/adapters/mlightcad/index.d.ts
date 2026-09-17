export interface Bounds { minX: number; minY: number; maxX: number; maxY: number; width: number; height: number; }
export interface CadAssetRef { assetId: string; fileName?: string; }
export interface LayerInfo { name: string; entity_count: number; visible: boolean; }
export interface EntityInfo { id?: string; type?: string; layer?: string; bounds?: Bounds; }
export interface CadViewerAdapter {
  open(asset: CadAssetRef): Promise<void>;
  fit(): Promise<void>;
  zoomTo(factor: number): Promise<void>;
  getBounds(): Promise<Bounds | null>;
  getLayers(): Promise<LayerInfo[]>;
  getSelection(): Promise<EntityInfo[]>;
  selectEntity(id: string): Promise<void>;
}
