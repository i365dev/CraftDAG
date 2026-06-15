import { Diagnostic } from "./errors.js";
import { compileComponentPlan, validateComponentPlan } from "./componentPlan.js";
import {
  ComponentAssemblyDefinition,
  ComponentNode,
  ComponentPlanDocument,
  ComponentStructuralIntent,
  StructuralSupportPolicy,
  Vec3,
  VoxelBlock,
  VoxelPlan,
} from "./types.js";

export interface SupportAnalysisBounds {
  min: Vec3;
  max: Vec3;
}

export interface SupportDiagnostic extends Diagnostic {
  stage: "support-analysis";
  count: number;
  bounds: SupportAnalysisBounds;
  supportPolicy: StructuralSupportPolicy;
}

export interface SupportAnalysisOptions {
  groundY?: number;
  includeAllowed?: boolean;
  rootSourceNodeIdPrefixes?: string[];
  ignoredSourceNodeIdPrefixes?: string[];
  ignoredBlockNames?: string[];
  maxDiagnosticsPerCode?: number;
}

export interface SupportAnalysisResult {
  diagnostics: SupportDiagnostic[];
  totalBlocks: number;
  verticalUnsupportedBlocks: number;
  disconnectedBlocks: number;
}

interface SourceStructuralEntry {
  prefix: string;
  componentId: string;
  structural: Required<Pick<ComponentStructuralIntent, "supportPolicy">> & ComponentStructuralIntent;
}

interface SourceGroup {
  sourceNodeId: string;
  blocks: VoxelBlock[];
  bounds: SupportAnalysisBounds;
}

interface InternalSupportAnalysisOptions extends SupportAnalysisOptions {
  sourceStructural?: SourceStructuralEntry[];
}

export function analyzeComponentPlanSupport(
  doc: unknown,
  options: SupportAnalysisOptions = {}
): SupportAnalysisResult {
  const plan = validateComponentPlan(doc);
  return analyzeVoxelSupportInternal(compileComponentPlan(plan), {
    ...options,
    sourceStructural: collectSourceStructuralEntries(plan),
  });
}

export function analyzeVoxelSupport(
  voxelPlan: VoxelPlan,
  options: SupportAnalysisOptions = {}
): SupportAnalysisResult {
  return analyzeVoxelSupportInternal(voxelPlan, options);
}

function analyzeVoxelSupportInternal(
  voxelPlan: VoxelPlan,
  options: InternalSupportAnalysisOptions = {}
): SupportAnalysisResult {
  const groundY = options.groundY ?? 0;
  const ignoredBlockNames = new Set(options.ignoredBlockNames ?? ["minecraft:air", "air"]);
  const blocks = voxelPlan.blocks.filter((block) => !ignoredBlockNames.has(block.block.name));
  const blockMap = new Map(blocks.map((block) => [posKey(block.pos), block]));
  const connected = connectedToRoots(blocks, blockMap, groundY, options.rootSourceNodeIdPrefixes ?? []);
  const verticalUnsupported = blocks.filter((block) => {
    if (block.pos[1] <= groundY) {
      return false;
    }
    return !blockMap.has(posKey([block.pos[0], block.pos[1] - 1, block.pos[2]]));
  });
  const disconnected = blocks.filter((block) => !connected.has(posKey(block.pos)));
  const diagnostics = [
    ...groupsToDiagnostics(
      groupBySource(disconnected, options.ignoredSourceNodeIdPrefixes ?? []),
      "DISCONNECTED_COMPONENT",
      "Blocks are not connected to the configured support roots.",
      "Connect this component to a foundation, input support, or mark it as may_float/decorative if intentional.",
      options
    ),
    ...groupsToDiagnostics(
      groupBySource(verticalUnsupported.filter((block) => connected.has(posKey(block.pos))), options.ignoredSourceNodeIdPrefixes ?? []),
      "NOT_VERTICALLY_SUPPORTED_BUT_CONNECTED",
      "Blocks have air directly below but are still connected through adjacent blocks.",
      "This may be acceptable for rails, roofs, bridges, or spans. Add structural intent if it is intentional.",
      options
    ),
  ];

  return {
    diagnostics: limitDiagnostics(diagnostics, options.maxDiagnosticsPerCode ?? 20),
    totalBlocks: blocks.length,
    verticalUnsupportedBlocks: verticalUnsupported.length,
    disconnectedBlocks: disconnected.length,
  };
}

export function defaultStructuralIntentForComponent(component: ComponentNode): Required<Pick<ComponentStructuralIntent, "supportPolicy">> & ComponentStructuralIntent {
  if (component.structural?.supportPolicy) {
    return { ...component.structural, supportPolicy: component.structural.supportPolicy };
  }

  switch (component.type) {
    case "Foundation":
      return { ...component.structural, supportPolicy: "must_connect_to_ground" };
    case "Door":
    case "Window":
    case "Opening":
    case "Portal":
    case "RailingRun":
      return { ...component.structural, supportPolicy: "decorative" };
    case "Instance":
    case "Repeat":
      return { ...component.structural, supportPolicy: "must_connect_to_input" };
    default:
      return { ...component.structural, supportPolicy: "must_connect_to_input" };
  }
}

function collectSourceStructuralEntries(plan: ComponentPlanDocument): SourceStructuralEntry[] {
  const entries: SourceStructuralEntry[] = [];
  const rootAssemblies = new Map((plan.assemblies ?? []).map((assembly) => [assembly.id, assembly]));

  for (const component of plan.components ?? []) {
    collectComponentEntry(entries, component, component.id);
    collectInstanceEntries(entries, component, rootAssemblies, component.id);
  }

  for (const section of plan.sections ?? []) {
    const sectionAssemblies = new Map(rootAssemblies);
    for (const assembly of section.assemblies ?? []) {
      sectionAssemblies.set(assembly.id, assembly);
    }

    for (const component of section.components) {
      const prefix = `${section.id}__${component.id}`;
      collectComponentEntry(entries, component, prefix);
      collectInstanceEntries(entries, component, sectionAssemblies, prefix);
    }
  }

  return entries.sort((a, b) => b.prefix.length - a.prefix.length);
}

function collectInstanceEntries(
  entries: SourceStructuralEntry[],
  component: ComponentNode,
  assemblyMap: Map<string, ComponentAssemblyDefinition>,
  prefix: string
): void {
  if (component.type !== "Instance") {
    return;
  }
  const assembly = assemblyMap.get(component.placement.assembly);
  if (!assembly) {
    return;
  }
  const instanceStructural = component.structural?.supportPolicy
    ? defaultStructuralIntentForComponent(component)
    : undefined;
  for (const assemblyComponent of assembly.components) {
    collectComponentEntry(entries, assemblyComponent, `${prefix}__${assemblyComponent.id}`, instanceStructural);
  }
}

function collectComponentEntry(
  entries: SourceStructuralEntry[],
  component: ComponentNode,
  prefix: string,
  inheritedStructural?: SourceStructuralEntry["structural"]
): void {
  entries.push({
    prefix,
    componentId: component.id,
    structural: component.structural?.supportPolicy
      ? defaultStructuralIntentForComponent(component)
      : inheritedStructural ?? defaultStructuralIntentForComponent(component),
  });
}

function connectedToRoots(
  blocks: VoxelBlock[],
  blockMap: Map<string, VoxelBlock>,
  groundY: number,
  rootSourceNodeIdPrefixes: string[]
): Set<string> {
  const connected = new Set<string>();
  const queue: Vec3[] = [];

  for (const block of blocks) {
    if (
      block.pos[1] <= groundY ||
      rootSourceNodeIdPrefixes.some((prefix) => block.sourceNodeId?.startsWith(prefix))
    ) {
      const key = posKey(block.pos);
      connected.add(key);
      queue.push(block.pos);
    }
  }

  for (let index = 0; index < queue.length; index++) {
    const pos = queue[index];
    for (const neighbor of neighbors(pos)) {
      const key = posKey(neighbor);
      if (!connected.has(key) && blockMap.has(key)) {
        connected.add(key);
        queue.push(neighbor);
      }
    }
  }

  return connected;
}

function groupsToDiagnostics(
  groups: SourceGroup[],
  code: "DISCONNECTED_COMPONENT" | "NOT_VERTICALLY_SUPPORTED_BUT_CONNECTED",
  message: string,
  repairHint: string,
  options: InternalSupportAnalysisOptions
): SupportDiagnostic[] {
  const diagnostics: SupportDiagnostic[] = [];
  for (const group of groups) {
    const structural = structuralForSource(group.sourceNodeId, options.sourceStructural ?? []);
    if ((structural.supportPolicy === "decorative" || structural.supportPolicy === "may_float") && !options.includeAllowed) {
      continue;
    }

    const allowed = structural.supportPolicy === "decorative" || structural.supportPolicy === "may_float";
    diagnostics.push({
      severity: "warning",
      stage: "support-analysis",
      code: allowed ? `ALLOWED_${code}` : code,
      message: allowed ? `${message} This is allowed by structural intent.` : message,
      sourceNodeId: group.sourceNodeId,
      componentId: structural.componentId,
      count: group.blocks.length,
      bounds: group.bounds,
      supportPolicy: structural.supportPolicy,
      repairHint: allowed ? "No repair needed unless the visual result is unintended." : repairHint,
    });
  }
  return diagnostics;
}

function structuralForSource(
  sourceNodeId: string,
  entries: SourceStructuralEntry[]
): SourceStructuralEntry["structural"] & { componentId?: string } {
  const entry = entries.find((candidate) => sourceNodeId === candidate.prefix || sourceNodeId.startsWith(`${candidate.prefix}__`));
  if (!entry) {
    return { supportPolicy: "must_connect_to_input" };
  }
  return { ...entry.structural, componentId: entry.componentId };
}

function groupBySource(blocks: VoxelBlock[], ignoredSourceNodeIdPrefixes: string[]): SourceGroup[] {
  const groups = new Map<string, SourceGroup>();
  for (const block of blocks) {
    const sourceNodeId = block.sourceNodeId ?? "unknown";
    if (ignoredSourceNodeIdPrefixes.some((prefix) => sourceNodeId.startsWith(prefix))) {
      continue;
    }
    const group = groups.get(sourceNodeId) ?? {
      sourceNodeId,
      blocks: [],
      bounds: { min: [...block.pos] as Vec3, max: [...block.pos] as Vec3 },
    };
    group.blocks.push(block);
    for (let index = 0; index < 3; index++) {
      group.bounds.min[index] = Math.min(group.bounds.min[index], block.pos[index]);
      group.bounds.max[index] = Math.max(group.bounds.max[index], block.pos[index]);
    }
    groups.set(sourceNodeId, group);
  }
  return [...groups.values()].sort((a, b) => b.blocks.length - a.blocks.length);
}

function limitDiagnostics(diagnostics: SupportDiagnostic[], maxPerCode: number): SupportDiagnostic[] {
  const counts = new Map<string, number>();
  return diagnostics.filter((diagnostic) => {
    const count = counts.get(diagnostic.code) ?? 0;
    counts.set(diagnostic.code, count + 1);
    return count < maxPerCode;
  });
}

function neighbors(pos: Vec3): Vec3[] {
  const [x, y, z] = pos;
  return [
    [x + 1, y, z],
    [x - 1, y, z],
    [x, y + 1, z],
    [x, y - 1, z],
    [x, y, z + 1],
    [x, y, z - 1],
  ];
}

function posKey(pos: Vec3): string {
  return `${pos[0]},${pos[1]},${pos[2]}`;
}
