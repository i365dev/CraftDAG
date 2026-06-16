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
  includeFloor?: boolean;
  includeCeiling?: boolean;
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

export type ComponentWall = "front" | "back" | "left" | "right";

export interface ComponentGrid {
  unitBlocks?: 1 | 2;
}

export type ComponentPlanSizeTier = "small" | "medium" | "large" | "monumental";

export interface ComponentPlanPolicy {
  sizeTier?: ComponentPlanSizeTier;
}

export interface ComponentSize {
  width: number;
  height: number;
  length: number;
}

export interface ComponentAnchor {
  x: number;
  y: number;
  z: number;
}

export interface AnchoredComponentPlacement {
  anchor: ComponentAnchor;
  size: ComponentSize;
}

export interface WallAttachmentPlacement {
  target: string;
  wall: ComponentWall;
  offset: number;
  y: number;
  width?: number;
  height?: number;
}

export interface CoverPlacement {
  over: string;
  overhang?: number;
  direction?: "x" | "z";
}

export interface RepeatPlacement {
  source: string;
  axis: "x" | "y" | "z";
  count: number;
  step: number;
}

export interface InstancePlacement {
  assembly: string;
  anchor: ComponentAnchor;
}

export interface ComponentInput {
  ref: string;
}

export type StructuralSupportPolicy =
  | "must_connect_to_ground"
  | "must_connect_to_input"
  | "may_float"
  | "decorative";

export interface ComponentStructuralIntent {
  supportPolicy?: StructuralSupportPolicy;
  supportRoots?: string[];
  maxCantilever?: number;
}

export interface BaseComponentNode<T extends string, P, O = Record<string, never>> {
  id: string;
  type: T;
  role?: string;
  inputs?: ComponentInput[];
  placement: P;
  materials?: Record<string, string>;
  options?: O;
  structural?: ComponentStructuralIntent;
}

export type FoundationComponent = BaseComponentNode<"Foundation", AnchoredComponentPlacement>;
export type PlatformComponent = BaseComponentNode<"Platform", AnchoredComponentPlacement>;
export type BeamComponent = BaseComponentNode<"Beam", AnchoredComponentPlacement>;

export interface RoomShellOptions {
  includeFloor?: boolean;
  includeCeiling?: boolean;
}
export type RoomShellComponent = BaseComponentNode<"RoomShell", AnchoredComponentPlacement, RoomShellOptions>;

export type CompartmentComponent = BaseComponentNode<"Compartment", AnchoredComponentPlacement, RoomShellOptions>;

export interface CorridorOptions {
  axis?: "x" | "z";
  includeFloor?: boolean;
  includeCeiling?: boolean;
  includeWalls?: boolean;
}
export type CorridorComponent = BaseComponentNode<"Corridor", AnchoredComponentPlacement, CorridorOptions>;

export interface TaperedVolumeOptions {
  axis?: "x" | "z";
  startInset?: number;
  endInset?: number;
}
export type TaperedVolumeComponent = BaseComponentNode<"TaperedVolume", AnchoredComponentPlacement, TaperedVolumeOptions>;

export interface SteppedTierOptions {
  axis?: "x" | "z" | "both";
  levels?: number;
  stepHeight?: number;
  insetPerLevel?: number;
}
export type SteppedTierComponent = BaseComponentNode<"SteppedTier", AnchoredComponentPlacement, SteppedTierOptions>;

export interface VerticalSetbackVolumeOptions {
  axis?: "x" | "z" | "both";
  levels?: number;
  levelHeight?: number;
  setbackPerLevel?: number;
}
export type VerticalSetbackVolumeComponent = BaseComponentNode<"VerticalSetbackVolume", AnchoredComponentPlacement, VerticalSetbackVolumeOptions>;

export interface RailingRunOptions {
  axis?: "x" | "z";
  postSpacing?: number;
  includePosts?: boolean;
  includeTopRail?: boolean;
  includeMidRail?: boolean;
}
export type RailingRunComponent = BaseComponentNode<"RailingRun", AnchoredComponentPlacement, RailingRunOptions>;

export interface ArcadeRunOptions {
  axis?: "x" | "z";
  bayCount?: number;
  pierWidth?: number;
  archHeight?: number;
}
export type ArcadeRunComponent = BaseComponentNode<"ArcadeRun", AnchoredComponentPlacement, ArcadeRunOptions>;

export interface SupportBracketOptions {
  axis?: "x" | "z";
  direction?: "positive" | "negative";
  spacing?: number;
  includeTopBeam?: boolean;
}
export type SupportBracketComponent = BaseComponentNode<"SupportBracket", AnchoredComponentPlacement, SupportBracketOptions>;

export interface TreeCanopyOptions {
  trunkHeight?: number;
  trunkWidth?: number;
  canopyStyle?: "rounded" | "tiered" | "weeping" | "flat";
}
export type TreeCanopyComponent = BaseComponentNode<"TreeCanopy", AnchoredComponentPlacement, TreeCanopyOptions>;

export interface OrganicPatchOptions {
  roughness?: number;
  includeBorder?: boolean;
}
export type OrganicPatchComponent = BaseComponentNode<"OrganicPatch", AnchoredComponentPlacement, OrganicPatchOptions>;

export interface PathWaypoint {
  x: number;
  z: number;
}

export interface PathRunOptions {
  style?: "continuous" | "stepping_stones" | "gravel";
  width?: number;
  stepSpacing?: number;
  waypoints?: PathWaypoint[];
}
export type PathRunComponent = BaseComponentNode<"PathRun", AnchoredComponentPlacement, PathRunOptions>;

export interface RockClusterOptions {
  count?: number;
  heightVariation?: number;
  roughness?: number;
}
export type RockClusterComponent = BaseComponentNode<"RockCluster", AnchoredComponentPlacement, RockClusterOptions>;

export interface StairRunOptions {
  axis?: "x" | "z";
  direction?: "positive" | "negative";
  style?: "solid";
  includeSideRails?: boolean;
}
export type StairRunComponent = BaseComponentNode<"StairRun", AnchoredComponentPlacement, StairRunOptions>;

export type DoorComponent = BaseComponentNode<"Door", WallAttachmentPlacement>;
export type WindowComponent = BaseComponentNode<"Window", WallAttachmentPlacement>;
export type OpeningComponent = BaseComponentNode<"Opening", WallAttachmentPlacement>;
export type PortalComponent = BaseComponentNode<"Portal", WallAttachmentPlacement>;
export type GableRoofComponent = BaseComponentNode<"GableRoof", CoverPlacement>;
export type FlatRoofComponent = BaseComponentNode<"FlatRoof", CoverPlacement>;
export type SupportPostComponent = BaseComponentNode<"SupportPost", AnchoredComponentPlacement>;
export type RepeatComponent = BaseComponentNode<"Repeat", RepeatPlacement>;
export type InstanceComponent = BaseComponentNode<"Instance", InstancePlacement>;

export type AssemblyComponentNode =
  | FoundationComponent
  | PlatformComponent
  | BeamComponent
  | RoomShellComponent
  | CompartmentComponent
  | CorridorComponent
  | TaperedVolumeComponent
  | SteppedTierComponent
  | VerticalSetbackVolumeComponent
  | RailingRunComponent
  | ArcadeRunComponent
  | SupportBracketComponent
  | TreeCanopyComponent
  | OrganicPatchComponent
  | PathRunComponent
  | RockClusterComponent
  | StairRunComponent
  | DoorComponent
  | WindowComponent
  | OpeningComponent
  | PortalComponent
  | GableRoofComponent
  | FlatRoofComponent
  | SupportPostComponent
  | RepeatComponent;

export type ComponentNode =
  | AssemblyComponentNode
  | InstanceComponent;

export interface ComponentAssemblyDefinition {
  id: string;
  bounds: ComponentSize;
  components: AssemblyComponentNode[];
}

export interface ComponentPlanSection {
  id: string;
  origin: ComponentAnchor;
  bounds: ComponentSize;
  assemblies?: ComponentAssemblyDefinition[];
  components: ComponentNode[];
}

export interface ComponentPlanDocument {
  version: "0.1";
  name: string;
  grid?: ComponentGrid;
  policy?: ComponentPlanPolicy;
  bounds: ComponentSize;
  palette: Record<string, string>;
  assemblies?: ComponentAssemblyDefinition[];
  components?: ComponentNode[];
  sections?: ComponentPlanSection[];
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
