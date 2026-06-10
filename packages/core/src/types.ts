export type Vec3 = [number, number, number];

export interface BlockState {
  name: string;
  properties?: Record<string, string>;
}

export interface NodeInput {
  ref: string;
}

export interface BaseNode<T extends string, P> {
  id: string;
  type: T;
  inputs?: NodeInput[];
  params: P;
}

export interface SolidBoxParams {
  from: Vec3;
  to: Vec3;
  block: string;
}
export type SolidBoxNode = BaseNode<"SolidBox", SolidBoxParams>;

export interface HollowBoxParams {
  from: Vec3;
  to: Vec3;
  block: string;
}
export type HollowBoxNode = BaseNode<"HollowBox", HollowBoxParams>;

export interface WallParams {
  from: Vec3;
  to: Vec3;
  block: string;
}
export type WallNode = BaseNode<"Wall", WallParams>;

export interface FloorParams {
  from: Vec3;
  to: Vec3;
  block: string;
}
export type FloorNode = BaseNode<"Floor", FloorParams>;

export interface ColumnParams {
  from: Vec3;
  to: Vec3;
  block: string;
}
export type ColumnNode = BaseNode<"Column", ColumnParams>;

export interface DoorwayParams {
  from: Vec3;
  to: Vec3;
  block?: string; // Optional block to place, or air by default
}
export type DoorwayNode = BaseNode<"Doorway", DoorwayParams>;

export interface WindowParams {
  from: Vec3;
  to: Vec3;
  block?: string; // Optional block to fill, e.g. glass/glass pane
}
export type WindowNode = BaseNode<"Window", WindowParams>;

export interface GableRoofParams {
  from: Vec3;
  to: Vec3;
  block: string;
  direction?: "x" | "z"; // axis of the roof ridge
}
export type GableRoofNode = BaseNode<"GableRoof", GableRoofParams>;

export type CraftDagNode =
  | SolidBoxNode
  | HollowBoxNode
  | WallNode
  | FloorNode
  | ColumnNode
  | DoorwayNode
  | WindowNode
  | GableRoofNode;

export interface CraftDagDocument {
  version: "0.1";
  name: string;
  size: Vec3;
  palette?: Record<string, string>;
  nodes: CraftDagNode[];
}

export interface VoxelBlock {
  pos: Vec3;
  block: BlockState;
  sourceNodeId?: string;
}

export interface VoxelPlan {
  version: "0.1";
  name: string;
  size: Vec3;
  origin: Vec3;
  blocks: VoxelBlock[];
}

