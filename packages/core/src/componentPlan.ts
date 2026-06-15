import { z } from "zod";
import { CompileError, Diagnostic, GraphError, ValidationError } from "./errors.js";
import { compileDocument } from "./compiler/compileDocument.js";
import {
  AssemblyComponentNode,
  ComponentAssemblyDefinition,
  ComponentNode,
  ComponentPlanDocument,
  ComponentPlanSection,
  ComponentSize,
  ComponentPlanSizeTier,
  CraftDagDocument,
  CraftDagNode,
  Vec3,
  VoxelPlan,
  WallAttachmentPlacement,
} from "./types.js";

const PositiveIntSchema = z.number().int().positive();
const NonNegativeIntSchema = z.number().int().nonnegative();

const ComponentSizeSchema = z.object({
  width: PositiveIntSchema,
  height: PositiveIntSchema,
  length: PositiveIntSchema,
}).strict();

const ComponentAnchorSchema = z.object({
  x: NonNegativeIntSchema,
  y: NonNegativeIntSchema,
  z: NonNegativeIntSchema,
}).strict();

const ComponentInputSchema = z.object({
  ref: z.string().min(1),
}).strict();

const MaterialsSchema = z.record(z.string(), z.string().min(1)).optional();

const AnchoredPlacementSchema = z.object({
  anchor: ComponentAnchorSchema,
  size: ComponentSizeSchema,
}).strict();

const WallAttachmentPlacementSchema = z.object({
  target: z.string().min(1),
  wall: z.enum(["front", "back", "left", "right"]),
  offset: NonNegativeIntSchema,
  y: NonNegativeIntSchema,
  width: PositiveIntSchema.optional(),
  height: PositiveIntSchema.optional(),
}).strict();

const CoverPlacementSchema = z.object({
  over: z.string().min(1),
  overhang: NonNegativeIntSchema.optional(),
  direction: z.enum(["x", "z"]).optional(),
}).strict();

const RepeatPlacementSchema = z.object({
  source: z.string().min(1),
  axis: z.enum(["x", "y", "z"]),
  count: z.number().int().min(2),
  step: PositiveIntSchema,
}).strict();

const FoundationComponentSchema = z.object({
  id: z.string().min(1),
  type: z.literal("Foundation"),
  role: z.string().min(1).optional(),
  inputs: z.array(ComponentInputSchema).optional(),
  placement: AnchoredPlacementSchema,
  materials: MaterialsSchema,
}).strict();

const PlatformComponentSchema = z.object({
  id: z.string().min(1),
  type: z.literal("Platform"),
  role: z.string().min(1).optional(),
  inputs: z.array(ComponentInputSchema).optional(),
  placement: AnchoredPlacementSchema,
  materials: MaterialsSchema,
}).strict();

const BeamComponentSchema = z.object({
  id: z.string().min(1),
  type: z.literal("Beam"),
  role: z.string().min(1).optional(),
  inputs: z.array(ComponentInputSchema).optional(),
  placement: AnchoredPlacementSchema,
  materials: MaterialsSchema,
}).strict();

const RoomShellComponentSchema = z.object({
  id: z.string().min(1),
  type: z.literal("RoomShell"),
  role: z.string().min(1).optional(),
  inputs: z.array(ComponentInputSchema).optional(),
  placement: AnchoredPlacementSchema,
  materials: MaterialsSchema,
  options: z.object({
    includeFloor: z.boolean().optional(),
    includeCeiling: z.boolean().optional(),
  }).strict().optional(),
}).strict();

const CompartmentComponentSchema = z.object({
  id: z.string().min(1),
  type: z.literal("Compartment"),
  role: z.string().min(1).optional(),
  inputs: z.array(ComponentInputSchema).optional(),
  placement: AnchoredPlacementSchema,
  materials: MaterialsSchema,
  options: z.object({
    includeFloor: z.boolean().optional(),
    includeCeiling: z.boolean().optional(),
  }).strict().optional(),
}).strict();

const CorridorComponentSchema = z.object({
  id: z.string().min(1),
  type: z.literal("Corridor"),
  role: z.string().min(1).optional(),
  inputs: z.array(ComponentInputSchema).optional(),
  placement: AnchoredPlacementSchema,
  materials: MaterialsSchema,
  options: z.object({
    axis: z.enum(["x", "z"]).optional(),
    includeFloor: z.boolean().optional(),
    includeCeiling: z.boolean().optional(),
    includeWalls: z.boolean().optional(),
  }).strict().optional(),
}).strict();

const DoorComponentSchema = z.object({
  id: z.string().min(1),
  type: z.literal("Door"),
  role: z.string().min(1).optional(),
  inputs: z.array(ComponentInputSchema).optional(),
  placement: WallAttachmentPlacementSchema,
  materials: MaterialsSchema,
}).strict();

const WindowComponentSchema = z.object({
  id: z.string().min(1),
  type: z.literal("Window"),
  role: z.string().min(1).optional(),
  inputs: z.array(ComponentInputSchema).optional(),
  placement: WallAttachmentPlacementSchema,
  materials: MaterialsSchema,
}).strict();

const OpeningComponentSchema = z.object({
  id: z.string().min(1),
  type: z.literal("Opening"),
  role: z.string().min(1).optional(),
  inputs: z.array(ComponentInputSchema).optional(),
  placement: WallAttachmentPlacementSchema,
  materials: MaterialsSchema,
}).strict();

const PortalComponentSchema = z.object({
  id: z.string().min(1),
  type: z.literal("Portal"),
  role: z.string().min(1).optional(),
  inputs: z.array(ComponentInputSchema).optional(),
  placement: WallAttachmentPlacementSchema,
  materials: MaterialsSchema,
}).strict();

const GableRoofComponentSchema = z.object({
  id: z.string().min(1),
  type: z.literal("GableRoof"),
  role: z.string().min(1).optional(),
  inputs: z.array(ComponentInputSchema).optional(),
  placement: CoverPlacementSchema,
  materials: MaterialsSchema,
}).strict();

const FlatRoofComponentSchema = z.object({
  id: z.string().min(1),
  type: z.literal("FlatRoof"),
  role: z.string().min(1).optional(),
  inputs: z.array(ComponentInputSchema).optional(),
  placement: CoverPlacementSchema,
  materials: MaterialsSchema,
}).strict();

const SupportPostComponentSchema = z.object({
  id: z.string().min(1),
  type: z.literal("SupportPost"),
  role: z.string().min(1).optional(),
  inputs: z.array(ComponentInputSchema).optional(),
  placement: AnchoredPlacementSchema,
  materials: MaterialsSchema,
}).strict();

const RepeatComponentSchema = z.object({
  id: z.string().min(1),
  type: z.literal("Repeat"),
  role: z.string().min(1).optional(),
  inputs: z.array(ComponentInputSchema).optional(),
  placement: RepeatPlacementSchema,
}).strict();

const InstancePlacementSchema = z.object({
  assembly: z.string().min(1),
  anchor: ComponentAnchorSchema,
}).strict();

const InstanceComponentSchema = z.object({
  id: z.string().min(1),
  type: z.literal("Instance"),
  role: z.string().min(1).optional(),
  inputs: z.array(ComponentInputSchema).optional(),
  placement: InstancePlacementSchema,
}).strict();

const AssemblyComponentNodeSchema = z.discriminatedUnion("type", [
  FoundationComponentSchema,
  PlatformComponentSchema,
  BeamComponentSchema,
  RoomShellComponentSchema,
  CompartmentComponentSchema,
  CorridorComponentSchema,
  DoorComponentSchema,
  WindowComponentSchema,
  OpeningComponentSchema,
  PortalComponentSchema,
  GableRoofComponentSchema,
  FlatRoofComponentSchema,
  SupportPostComponentSchema,
  RepeatComponentSchema,
]);

const ComponentNodeSchema = z.discriminatedUnion("type", [
  FoundationComponentSchema,
  PlatformComponentSchema,
  BeamComponentSchema,
  RoomShellComponentSchema,
  CompartmentComponentSchema,
  CorridorComponentSchema,
  DoorComponentSchema,
  WindowComponentSchema,
  OpeningComponentSchema,
  PortalComponentSchema,
  GableRoofComponentSchema,
  FlatRoofComponentSchema,
  SupportPostComponentSchema,
  RepeatComponentSchema,
  InstanceComponentSchema,
]);

const ComponentAssemblyDefinitionSchema = z.object({
  id: z.string().min(1),
  bounds: ComponentSizeSchema,
  components: z.array(AssemblyComponentNodeSchema),
}).strict();

const ComponentPlanSectionSchema = z.object({
  id: z.string().min(1),
  origin: ComponentAnchorSchema,
  bounds: ComponentSizeSchema,
  assemblies: z.array(ComponentAssemblyDefinitionSchema).optional(),
  components: z.array(ComponentNodeSchema),
}).strict();

const ComponentPlanSchema = z.object({
  version: z.literal("0.1"),
  name: z.string().min(1),
  grid: z.object({
    unitBlocks: z.union([z.literal(1), z.literal(2)]).optional(),
  }).strict().optional(),
  policy: z.object({
    sizeTier: z.enum(["small", "medium", "large", "monumental"]).optional(),
  }).strict().optional(),
  bounds: ComponentSizeSchema,
  palette: z.record(z.string(), z.string().min(1)),
  assemblies: z.array(ComponentAssemblyDefinitionSchema).optional(),
  components: z.array(ComponentNodeSchema).optional(),
  sections: z.array(ComponentPlanSectionSchema).optional(),
}).strict();

type AnchoredComponent = Extract<ComponentNode, { placement: { anchor: unknown; size: unknown } }>;
type RepeatableComponent = Extract<ComponentNode, {
  type: "Foundation" | "Platform" | "Beam" | "RoomShell" | "Compartment" | "Corridor" | "SupportPost";
}>;
type ComponentScope = "ComponentPlan" | `Assembly "${string}"` | `Section "${string}"`;

interface ComponentBudget {
  maxBounds: ComponentSize;
  maxComponents: number;
  maxEstimatedBlocks: number;
}

const COMPONENT_BUDGETS: Record<ComponentPlanSizeTier, ComponentBudget> = {
  small: {
    maxBounds: { width: 32, height: 32, length: 32 },
    maxComponents: 64,
    maxEstimatedBlocks: 32 * 32 * 32,
  },
  medium: {
    maxBounds: { width: 64, height: 48, length: 64 },
    maxComponents: 256,
    maxEstimatedBlocks: 64 * 48 * 64,
  },
  large: {
    maxBounds: { width: 96, height: 64, length: 96 },
    maxComponents: 512,
    maxEstimatedBlocks: 96 * 64 * 96,
  },
  monumental: {
    maxBounds: { width: 256, height: 96, length: 256 },
    maxComponents: 2048,
    maxEstimatedBlocks: 256 * 96 * 256,
  },
};

interface ComponentValidationIssue extends Diagnostic {
  stage: "component-validation";
}

/**
 * Validates a ComponentPlan document and its semantic component graph.
 */
export function validateComponentPlan(doc: unknown): ComponentPlanDocument {
  const result = ComponentPlanSchema.safeParse(doc);
  if (!result.success) {
    const details: ComponentValidationIssue[] = result.error.errors.map((err) => ({
      severity: "error",
      stage: "component-validation",
      code: "SCHEMA_VALIDATION_FAILED",
      path: err.path.join("."),
      message: err.message,
      repairHint: "Update the ComponentPlan JSON to match the v0.1 schema.",
    }));
    throw new ValidationError("ComponentPlan schema validation failed", details);
  }

  const parsed = result.data as ComponentPlanDocument;
  if ((parsed.components ?? []).length === 0 && (parsed.sections ?? []).length === 0) {
    throw componentValidationError({
      code: "EMPTY_COMPONENT_PLAN",
      message: "ComponentPlan must define at least one root component or section.",
      repairHint: "Add components for a flat plan, or add sections for a sectioned plan.",
    });
  }

  const componentMap = new Map<string, ComponentNode>();
  const assemblyMap = new Map<string, ComponentAssemblyDefinition>();
  const sectionMap = new Map<string, ComponentPlanSection>();

  for (const assembly of parsed.assemblies ?? []) {
    if (assemblyMap.has(assembly.id)) {
      throw componentValidationError({
        code: "DUPLICATE_ASSEMBLY_ID",
        componentId: assembly.id,
        message: `Duplicate assembly ID found: "${assembly.id}".`,
        repairHint: "Rename one assembly and update any Instance references to it.",
      });
    }
    assemblyMap.set(assembly.id, assembly);
  }

  for (const component of parsed.components ?? []) {
    if (componentMap.has(component.id)) {
      throw componentValidationError({
        code: "DUPLICATE_COMPONENT_ID",
        componentId: component.id,
        message: `Duplicate component ID found: "${component.id}".`,
        repairHint: "Rename one component and update any references to it.",
      });
    }
    componentMap.set(component.id, component);
  }

  for (const section of parsed.sections ?? []) {
    if (sectionMap.has(section.id)) {
      throw componentValidationError({
        code: "DUPLICATE_SECTION_ID",
        componentId: section.id,
        sectionId: section.id,
        message: `Duplicate section ID found: "${section.id}".`,
        repairHint: "Rename one section and update any section-specific references.",
      });
    }
    validateSectionBounds(parsed.bounds, section);
    sectionMap.set(section.id, section);
  }

  for (const assembly of parsed.assemblies ?? []) {
    try {
      const localComponentMap = buildComponentMap(assembly.components, `Assembly "${assembly.id}"`);
      validateComponentSet(parsed, assembly.components, assembly.bounds, localComponentMap, `Assembly "${assembly.id}"`);
    } catch (error) {
      throw withDiagnosticContext(error, { assemblyId: assembly.id });
    }
  }

  validateComponentSet(parsed, parsed.components ?? [], parsed.bounds, componentMap, "ComponentPlan", assemblyMap);

  for (const section of parsed.sections ?? []) {
    let sectionAssemblyMap: Map<string, ComponentAssemblyDefinition>;
    let sectionComponentMap: Map<string, ComponentNode>;

    try {
      sectionAssemblyMap = buildSectionAssemblyMap(assemblyMap, section);
      sectionComponentMap = buildComponentMap(section.components, `Section "${section.id}"`);
    } catch (error) {
      throw withDiagnosticContext(error, { sectionId: section.id });
    }

    for (const assembly of section.assemblies ?? []) {
      try {
        const localComponentMap = buildComponentMap(assembly.components, `Assembly "${assembly.id}"`);
        validateComponentSet(parsed, assembly.components, assembly.bounds, localComponentMap, `Assembly "${assembly.id}"`);
      } catch (error) {
        throw withDiagnosticContext(error, { sectionId: section.id, assemblyId: assembly.id });
      }
    }

    try {
      validateComponentSet(
        parsed,
        section.components,
        section.bounds,
        sectionComponentMap,
        `Section "${section.id}"`,
        sectionAssemblyMap
      );
    } catch (error) {
      throw withDiagnosticContext(error, { sectionId: section.id });
    }
  }

  validateBudgetPolicy(parsed, componentMap, assemblyMap);

  return parsed;
}

function buildSectionAssemblyMap(
  rootAssemblyMap: Map<string, ComponentAssemblyDefinition>,
  section: ComponentPlanSection
): Map<string, ComponentAssemblyDefinition> {
  const assemblyMap = new Map(rootAssemblyMap);

  for (const assembly of section.assemblies ?? []) {
    if (assemblyMap.has(assembly.id)) {
      throw componentValidationError({
        code: "DUPLICATE_ASSEMBLY_ID",
        componentId: assembly.id,
        message: `Section "${section.id}" defines duplicate assembly ID "${assembly.id}".`,
        repairHint: "Rename the section assembly or reuse the root assembly instead of redefining it.",
      });
    }
    assemblyMap.set(assembly.id, assembly);
  }

  return assemblyMap;
}

function withDiagnosticContext(
  error: unknown,
  context: Pick<Diagnostic, "sectionId" | "assemblyId" | "instanceId">
): Error {
  if (
    error instanceof ValidationError ||
    error instanceof GraphError ||
    error instanceof CompileError
  ) {
    const details = addDiagnosticContext(error.details, context);

    let contextualError: Error;
    if (error instanceof GraphError) {
      contextualError = new GraphError(error.message, details);
    } else if (error instanceof CompileError) {
      contextualError = new CompileError(error.message, details);
    } else {
      contextualError = new ValidationError(error.message, details);
    }
    contextualError.stack = error.stack;
    return contextualError;
  }

  return error instanceof Error ? error : new Error(String(error));
}

function addDiagnosticContext(
  details: unknown,
  context: Pick<Diagnostic, "sectionId" | "assemblyId" | "instanceId">
): unknown {
  if (Array.isArray(details)) {
    return details.map((detail) => addDiagnosticContext(detail, context));
  }

  if (typeof details === "object" && details !== null) {
    return { ...details, ...missingDiagnosticContext(details, context) };
  }

  return details;
}

function missingDiagnosticContext(
  detail: unknown,
  context: Pick<Diagnostic, "sectionId" | "assemblyId" | "instanceId">
): Pick<Diagnostic, "sectionId" | "assemblyId" | "instanceId"> {
  if (typeof detail !== "object" || detail === null) {
    return context;
  }

  const current = detail as Partial<Diagnostic>;
  return {
    sectionId: current.sectionId ?? context.sectionId,
    assemblyId: current.assemblyId ?? context.assemblyId,
    instanceId: current.instanceId ?? context.instanceId,
  };
}

function buildComponentMap(
  components: readonly (ComponentNode | AssemblyComponentNode)[],
  scope: ComponentScope
): Map<string, ComponentNode> {
  const componentMap = new Map<string, ComponentNode>();
  for (const component of components) {
    if (componentMap.has(component.id)) {
      throw componentValidationError({
        code: "DUPLICATE_COMPONENT_ID",
        componentId: component.id,
        message: `${scope} has duplicate component ID "${component.id}".`,
        repairHint: "Rename one component and update any references to it.",
      });
    }
    componentMap.set(component.id, component);
  }

  return componentMap;
}

function validateComponentSet(
  plan: ComponentPlanDocument,
  components: readonly ComponentNode[],
  bounds: ComponentSize,
  componentMap: Map<string, ComponentNode>,
  scope: ComponentScope,
  assemblyMap = new Map<string, ComponentAssemblyDefinition>()
): void {
  for (const component of components) {
    for (const input of component.inputs ?? []) {
      const inputTarget = componentMap.get(input.ref);
      if (!inputTarget) {
        throw unknownRefError(component, `inputs ref "${input.ref}"`, input.ref, componentMap);
      }
      if (inputTarget.type === "Repeat" || inputTarget.type === "Instance") {
        throw componentValidationError({
          code: "INVALID_NON_PHYSICAL_REFERENCE",
          componentId: component.id,
          message: `Component "${component.id}" cannot reference non-physical component "${input.ref}".`,
          repairHint: "Reference a concrete component instead of Repeat or Instance.",
        });
      }
    }

    if (isAttachmentComponent(component)) {
      if (!componentMap.has(component.placement.target)) {
        throw unknownRefError(component, `target "${component.placement.target}"`, component.placement.target, componentMap);
      }
    }

    if (isCoverComponent(component) && !componentMap.has(component.placement.over)) {
      throw unknownRefError(component, `over "${component.placement.over}"`, component.placement.over, componentMap);
    }

    if (component.type === "Repeat" && !componentMap.has(component.placement.source)) {
      throw unknownRefError(component, `source "${component.placement.source}"`, component.placement.source, componentMap);
    }

    if (component.type === "Instance") {
      const assembly = assemblyMap.get(component.placement.assembly);
      if (!assembly) {
        throw componentValidationError({
          code: "UNKNOWN_ASSEMBLY_REF",
          componentId: component.id,
          instanceId: component.id,
          message: `Instance "${component.id}" references unknown assembly "${component.placement.assembly}".`,
          availableRefs: [...assemblyMap.keys()],
          repairHint: "Change placement.assembly to an existing assembly ID or define that assembly.",
        });
      } else {
        validateInstanceBounds(bounds, component, assembly);
      }
    }

    if (isAnchoredComponent(component)) {
      validateAnchoredBounds(bounds, component);
    }

    validateInteriorLayoutComponent(component);
    validateComponentMaterials(plan, component);
  }

  validateComponentGraph(components);
  validateAttachments(components, componentMap);
  validateCovers(components, bounds, plan.grid?.unitBlocks ?? 1, componentMap);
  validateRepeats(components, bounds, componentMap);
}

/**
 * Expands a validated ComponentPlan into low-level CraftDAG primitives.
 */
export function expandComponentPlan(doc: unknown): CraftDagDocument {
  const plan = validateComponentPlan(doc);
  const unit = plan.grid?.unitBlocks ?? 1;
  const componentMap = new Map((plan.components ?? []).map((component) => [component.id, component]));
  const assemblyMap = new Map((plan.assemblies ?? []).map((assembly) => [assembly.id, assembly]));
  const craftDagNodes: CraftDagNode[] = [];

  for (const component of plan.components ?? []) {
    craftDagNodes.push(...expandComponentToNodes(component, componentMap, plan.bounds, unit, assemblyMap));
  }

  for (const section of plan.sections ?? []) {
    craftDagNodes.push(...expandSectionToNodes(section, assemblyMap, unit));
  }

  return {
    version: "0.1",
    name: plan.name,
    size: [plan.bounds.width * unit, plan.bounds.height * unit, plan.bounds.length * unit],
    palette: plan.palette,
    nodes: craftDagNodes,
  };
}

function expandSectionToNodes(
  section: ComponentPlanSection,
  rootAssemblyMap: Map<string, ComponentAssemblyDefinition>,
  unit: 1 | 2
): CraftDagNode[] {
  const sectionComponentMap = buildComponentMap(section.components, `Section "${section.id}"`);
  const sectionAssemblyMap = buildSectionAssemblyMap(rootAssemblyMap, section);
  const shift: Vec3 = [
    section.origin.x * unit,
    section.origin.y * unit,
    section.origin.z * unit,
  ];
  const shiftedNodes: CraftDagNode[] = [];

  for (const component of section.components) {
    const localNodes = expandComponentToNodes(component, sectionComponentMap, section.bounds, unit, sectionAssemblyMap);
    for (const localNode of localNodes) {
      shiftedNodes.push(namespaceAndShiftNode(localNode, section.id, shift, []));
    }
  }

  return shiftedNodes;
}

function expandComponentToNodes(
  component: ComponentNode,
  componentMap: Map<string, ComponentNode>,
  bounds: ComponentSize,
  unit: 1 | 2,
  assemblyMap = new Map<string, ComponentAssemblyDefinition>()
): CraftDagNode[] {
  switch (component.type) {
    case "Foundation":
      return [{
        id: nodeId(component.id, "solid"),
        type: "SolidBox",
        inputs: expandInputs(component, componentMap),
        params: {
          ...scaledBox(component.placement, unit),
          block: material(component, "main", "foundation"),
        },
      }];
    case "Platform":
      return [{
        id: nodeId(component.id, "platform"),
        type: "SolidBox",
        inputs: expandInputs(component, componentMap),
        params: {
          ...scaledBox(component.placement, unit),
          block: material(component, "main", "floor"),
        },
      }];
    case "Beam":
      return [{
        id: nodeId(component.id, "beam"),
        type: "SolidBox",
        inputs: expandInputs(component, componentMap),
        params: {
          ...scaledBox(component.placement, unit),
          block: material(component, "main", "trim"),
        },
      }];
    case "RoomShell":
      return [{
        id: nodeId(component.id, "shell"),
        type: "HollowBox",
        inputs: expandInputs(component, componentMap),
        params: {
          ...scaledBox(component.placement, unit),
          block: material(component, "wall", "wall"),
          includeFloor: component.options?.includeFloor,
          includeCeiling: component.options?.includeCeiling,
        },
      }];
    case "Compartment":
      return [{
        id: nodeId(component.id, "shell"),
        type: "HollowBox",
        inputs: expandInputs(component, componentMap),
        params: {
          ...scaledBox(component.placement, unit),
          block: material(component, "wall", "wall"),
          includeFloor: component.options?.includeFloor,
          includeCeiling: component.options?.includeCeiling,
        },
      }];
    case "Corridor":
      return expandCorridor(component, componentMap, unit);
    case "Door":
      return [{
        id: nodeId(component.id, "opening"),
        type: "Doorway",
        inputs: expandInputs(component, componentMap),
        params: {
          ...scaledAttachmentBox(component.placement, componentMap, unit, 1, 2),
          block: material(component, "door", "door"),
        },
      }];
    case "Window":
      return [{
        id: nodeId(component.id, "opening"),
        type: "Window",
        inputs: expandInputs(component, componentMap),
        params: {
          ...scaledAttachmentBox(component.placement, componentMap, unit, 1, 1),
          block: material(component, "glass", "glass"),
        },
      }];
    case "Opening":
      return [{
        id: nodeId(component.id, "opening"),
        type: "Doorway",
        inputs: expandInputs(component, componentMap),
        params: {
          ...scaledAttachmentBox(component.placement, componentMap, unit, 1, 2),
          block: component.materials?.fill,
        },
      }];
    case "Portal":
      return [{
        id: nodeId(component.id, "portal"),
        type: "Window",
        inputs: expandInputs(component, componentMap),
        params: {
          ...scaledAttachmentBox(component.placement, componentMap, unit, 2, 3),
          block: material(component, "surface", "portal"),
        },
      }];
    case "GableRoof":
      return [{
        id: nodeId(component.id, "gable"),
        type: "GableRoof",
        inputs: expandInputs(component, componentMap),
        params: {
          ...scaledRoofBox(component, componentMap, bounds, unit),
          block: material(component, "roof", "roof"),
          direction: component.placement.direction,
        },
      }];
    case "FlatRoof":
      return [{
        id: nodeId(component.id, "flat_roof"),
        type: "SolidBox",
        inputs: expandInputs(component, componentMap),
        params: {
          ...scaledFlatRoofBox(component, componentMap, bounds, unit),
          block: material(component, "roof", "roof"),
        },
      }];
    case "SupportPost":
      return [{
        id: nodeId(component.id, "post"),
        type: "SolidBox",
        inputs: expandInputs(component, componentMap),
        params: {
          ...scaledBox(component.placement, unit),
          block: material(component, "main", "trim"),
        },
      }];
    case "Repeat":
      return expandRepeat(component, componentMap, unit);
    case "Instance":
      return expandInstance(component, componentMap, assemblyMap, unit);
    default: {
      const _exhaustiveCheck: never = component;
      throw new ValidationError(`Unhandled component type: ${(_exhaustiveCheck as any).type}`);
    }
  }
}

export function compileComponentPlan(doc: unknown): VoxelPlan {
  return compileDocument(expandComponentPlan(doc));
}

function componentValidationError(issue: Omit<ComponentValidationIssue, "stage" | "severity"> & {
  severity?: ComponentValidationIssue["severity"];
}): ValidationError {
  return new ValidationError(issue.message, [{ stage: "component-validation", ...issue, severity: issue.severity ?? "error" }]);
}

function expandCorridor(
  component: Extract<ComponentNode, { type: "Corridor" }>,
  componentMap: Map<string, ComponentNode>,
  unit: 1 | 2,
  inputOverride?: { ref: string }[]
): CraftDagNode[] {
  const nodes: CraftDagNode[] = [];
  const inputs = inputOverride ?? expandInputs(component, componentMap);
  const { anchor, size } = component.placement;
  const axis = corridorAxis(component);
  const includeFloor = component.options?.includeFloor ?? true;
  const includeCeiling = component.options?.includeCeiling ?? true;
  const includeWalls = component.options?.includeWalls ?? true;

  if (includeFloor) {
    nodes.push({
      id: nodeId(component.id, "floor"),
      type: "SolidBox",
      inputs,
      params: {
        ...scaledBox({ anchor, size: { width: size.width, height: 1, length: size.length } }, unit),
        block: material(component, "floor", "floor"),
      },
    });
  }

  const derivedInputs = includeFloor ? [{ ref: nodeId(component.id, "floor") }] : inputs;

  if (includeWalls) {
    const wallPlacements = axis === "z"
      ? [
        { part: "left_wall", anchor: { x: anchor.x, y: anchor.y, z: anchor.z }, size: { width: 1, height: size.height, length: size.length } },
        { part: "right_wall", anchor: { x: anchor.x + size.width - 1, y: anchor.y, z: anchor.z }, size: { width: 1, height: size.height, length: size.length } },
      ]
      : [
        { part: "left_wall", anchor: { x: anchor.x, y: anchor.y, z: anchor.z }, size: { width: size.width, height: size.height, length: 1 } },
        { part: "right_wall", anchor: { x: anchor.x, y: anchor.y, z: anchor.z + size.length - 1 }, size: { width: size.width, height: size.height, length: 1 } },
      ];

    for (const wall of wallPlacements) {
      nodes.push({
        id: nodeId(component.id, wall.part),
        type: "SolidBox",
        inputs: derivedInputs,
        params: {
          ...scaledBox({ anchor: wall.anchor, size: wall.size }, unit),
          block: material(component, "wall", "wall"),
        },
      });
    }
  }

  if (includeCeiling) {
    nodes.push({
      id: nodeId(component.id, "ceiling"),
      type: "SolidBox",
      inputs: derivedInputs,
      params: {
        ...scaledBox({
          anchor: { x: anchor.x, y: anchor.y + size.height - 1, z: anchor.z },
          size: { width: size.width, height: 1, length: size.length },
        }, unit),
        block: material(component, "ceiling", "floor"),
      },
    });
  }

  return nodes;
}

function unknownRefError(
  component: ComponentNode,
  field: string,
  ref: string,
  componentMap: Map<string, ComponentNode>
): ValidationError {
  return componentValidationError({
    code: "UNKNOWN_COMPONENT_REF",
    componentId: component.id,
    message: `Component "${component.id}" references unknown component ${field}.`,
    availableRefs: [...componentMap.keys()],
    repairHint: `Change the reference "${ref}" to an existing component ID or define that component.`,
  });
}

function validateAnchoredBounds(bounds: ComponentSize, component: AnchoredComponent): void {
  const { anchor, size } = component.placement;
  const isWithinBounds =
    anchor.x + size.width <= bounds.width &&
    anchor.y + size.height <= bounds.height &&
    anchor.z + size.length <= bounds.length;

  if (!isWithinBounds) {
    throw componentValidationError({
      code: "COMPONENT_OUT_OF_BOUNDS",
      componentId: component.id,
      message: `Component "${component.id}" placement exceeds ComponentPlan bounds.`,
      repairHint: "Move the component anchor, reduce its size, or increase the plan bounds.",
    });
  }
}

function validateInstanceBounds(
  bounds: ComponentSize,
  component: Extract<ComponentNode, { type: "Instance" }>,
  assembly: ComponentAssemblyDefinition
): void {
  const { anchor } = component.placement;
  const isWithinBounds =
    anchor.x + assembly.bounds.width <= bounds.width &&
    anchor.y + assembly.bounds.height <= bounds.height &&
    anchor.z + assembly.bounds.length <= bounds.length;

  if (!isWithinBounds) {
    throw componentValidationError({
      code: "INSTANCE_OUT_OF_BOUNDS",
      componentId: component.id,
      instanceId: component.id,
      assemblyId: assembly.id,
      message: `Instance "${component.id}" placement exceeds ComponentPlan bounds.`,
      repairHint: `Move the instance anchor, reduce assembly "${assembly.id}" bounds, or increase plan bounds.`,
    });
  }
}

function validateInteriorLayoutComponent(component: ComponentNode): void {
  if (component.type !== "Corridor") {
    return;
  }

  const { size } = component.placement;
  const axis = corridorAxis(component);
  const crossAxisSize = axis === "z" ? size.width : size.length;
  const includeFloor = component.options?.includeFloor ?? true;
  const includeWalls = component.options?.includeWalls ?? true;
  const includeCeiling = component.options?.includeCeiling ?? true;

  if (!includeFloor && !includeWalls && !includeCeiling) {
    throw componentValidationError({
      code: "EMPTY_CORRIDOR",
      componentId: component.id,
      message: `Corridor "${component.id}" must emit at least one physical part.`,
      repairHint: "Enable includeFloor, includeWalls, or includeCeiling.",
    });
  }

  if (size.height < 2 || crossAxisSize < 3) {
    throw componentValidationError({
      code: "INVALID_CORRIDOR_SIZE",
      componentId: component.id,
      message: `Corridor "${component.id}" must leave at least one walkable cell between its side walls.`,
      repairHint: "Use height >= 2 and width >= 3 for z-axis corridors, or length >= 3 for x-axis corridors.",
    });
  }
}

function validateSectionBounds(bounds: ComponentSize, section: ComponentPlanSection): void {
  const { origin } = section;
  const isWithinBounds =
    origin.x + section.bounds.width <= bounds.width &&
    origin.y + section.bounds.height <= bounds.height &&
    origin.z + section.bounds.length <= bounds.length;

  if (!isWithinBounds) {
    throw componentValidationError({
      code: "SECTION_OUT_OF_BOUNDS",
      componentId: section.id,
      sectionId: section.id,
      message: `Section "${section.id}" placement exceeds ComponentPlan bounds.`,
      repairHint: "Move the section origin, reduce section bounds, or increase global plan bounds.",
    });
  }
}

function validateComponentGraph(components: readonly ComponentNode[]): void {
  const inDegree = new Map<string, number>();
  const adj = new Map<string, string[]>();

  for (const component of components) {
    inDegree.set(component.id, 0);
    adj.set(component.id, []);
  }

  for (const component of components) {
    const refs = new Set((component.inputs ?? []).map((input) => input.ref));
    if (isAttachmentComponent(component)) {
      refs.add(component.placement.target);
    }
    if (isCoverComponent(component)) {
      refs.add(component.placement.over);
    }
    if (component.type === "Repeat") {
      refs.add(component.placement.source);
    }

    for (const ref of refs) {
      adj.get(ref)?.push(component.id);
      inDegree.set(component.id, (inDegree.get(component.id) ?? 0) + 1);
    }
  }

  const queue = [...inDegree.entries()].filter(([, degree]) => degree === 0).map(([id]) => id);
  const sorted: string[] = [];

  while (queue.length > 0) {
    const id = queue.shift()!;
    sorted.push(id);
    for (const neighbor of adj.get(id) ?? []) {
      const nextDegree = (inDegree.get(neighbor) ?? 0) - 1;
      inDegree.set(neighbor, nextDegree);
      if (nextDegree === 0) {
        queue.push(neighbor);
      }
    }
  }

  if (sorted.length !== components.length) {
    const cycleComponentIds = [...inDegree.entries()]
      .filter(([, degree]) => degree > 0)
      .map(([id]) => id);
    throw new GraphError(
      `ComponentPlan dependency cycle detected among components: ${cycleComponentIds.join(", ")}`,
      [{
        severity: "error",
        stage: "component-validation",
        code: "COMPONENT_DEPENDENCY_CYCLE",
        message: `ComponentPlan dependency cycle detected among components: ${cycleComponentIds.join(", ")}`,
        availableRefs: components.map((component) => component.id),
        repairHint: "Remove or redirect one semantic dependency so the component graph is acyclic.",
      }]
    );
  }
}

function validateAttachments(components: readonly ComponentNode[], componentMap: Map<string, ComponentNode>): void {
  for (const component of components) {
    if (!isAttachmentComponent(component)) {
      continue;
    }

    const target = componentMap.get(component.placement.target);
    if (!target || !isAnchoredComponent(target)) {
      throw componentValidationError({
        code: "INVALID_ATTACHMENT_TARGET",
        componentId: component.id,
        message: `Component "${component.id}" must attach to an anchored component target.`,
        repairHint: "Attach doors, windows, openings, and portals to a RoomShell or another anchored component.",
      });
    }

    const lengthAlongWall = component.placement.wall === "front" || component.placement.wall === "back"
      ? target.placement.size.width
      : target.placement.size.length;
    const width = component.placement.width ?? defaultAttachmentWidth(component.type);
    const height = component.placement.height ?? defaultAttachmentHeight(component.type);

    const isWithinWall =
      component.placement.offset + width <= lengthAlongWall &&
      component.placement.y + height <= target.placement.size.height;

    if (!isWithinWall) {
      throw componentValidationError({
        code: "ATTACHMENT_OUT_OF_BOUNDS",
        componentId: component.id,
        message: `Component "${component.id}" placement exceeds target wall bounds.`,
        repairHint: "Reduce offset/size or attach the component to a larger target wall.",
      });
    }
  }
}

function validateCovers(
  components: readonly ComponentNode[],
  bounds: ComponentSize,
  unit: 1 | 2,
  componentMap: Map<string, ComponentNode>
): void {
  for (const component of components) {
    if (!isCoverComponent(component)) {
      continue;
    }

    const target = componentMap.get(component.placement.over);
    if (!target || !isAnchoredComponent(target)) {
      throw componentValidationError({
        code: "INVALID_COVER_TARGET",
        componentId: component.id,
        message: `${component.type} "${component.id}" must cover an anchored component.`,
        repairHint: "Set placement.over to a RoomShell or another anchored component.",
      });
    }

    const geometry = component.type === "GableRoof"
      ? roofGeometry(component, target, bounds, unit)
      : flatRoofGeometry(component, target, bounds, unit);

    if (geometry.baseY >= bounds.height) {
      throw componentValidationError({
        code: "COVER_OUT_OF_BOUNDS",
        componentId: component.id,
        message: `${component.type} "${component.id}" starts outside ComponentPlan height bounds.`,
        repairHint: "Increase bounds.height or lower the covered component.",
      });
    }

    if (geometry.scaledMaxY > bounds.height * unit) {
      const requiredHeight = Math.ceil(geometry.scaledMaxY / unit);
      throw componentValidationError({
        code: component.type === "GableRoof" ? "ROOF_HEIGHT_OUT_OF_BOUNDS" : "COVER_OUT_OF_BOUNDS",
        componentId: component.id,
        message: `${component.type} "${component.id}" exceeds ComponentPlan height bounds.`,
        repairHint: `Increase bounds.height to at least ${requiredHeight}, reduce the covered span, reduce overhang, or lower the covered component.`,
      });
    }
  }
}

function validateBudgetPolicy(
  plan: ComponentPlanDocument,
  componentMap: Map<string, ComponentNode>,
  assemblyMap: Map<string, ComponentAssemblyDefinition>
): void {
  const tier = plan.policy?.sizeTier ?? "small";
  const budget = COMPONENT_BUDGETS[tier];
  const unit = plan.grid?.unitBlocks ?? 1;

  if (
    plan.bounds.width > budget.maxBounds.width ||
    plan.bounds.height > budget.maxBounds.height ||
    plan.bounds.length > budget.maxBounds.length
  ) {
    throw componentValidationError({
      code: "PLAN_BOUNDS_OVER_BUDGET",
      message: `ComponentPlan bounds exceed the ${tier} size tier budget.`,
      repairHint: `Reduce bounds to at most ${budget.maxBounds.width}x${budget.maxBounds.height}x${budget.maxBounds.length}, choose a larger sizeTier, or split the build into sections.`,
    });
  }

  const rootComponents = plan.components ?? [];
  const authoredComponents = rootComponents.length + (plan.assemblies ?? [])
    .reduce((total, assembly) => total + assembly.components.length, 0);
  let totalAuthoredComponents = authoredComponents;
  let expandedComponents = estimateExpandedComponentCount(rootComponents, componentMap, assemblyMap);

  for (const section of plan.sections ?? []) {
    const sectionAssemblyMap = buildSectionAssemblyMap(assemblyMap, section);
    const sectionComponentMap = buildComponentMap(section.components, `Section "${section.id}"`);
    totalAuthoredComponents += section.components.length + (section.assemblies ?? [])
      .reduce((total, assembly) => total + assembly.components.length, 0);
    expandedComponents += estimateExpandedComponentCount(section.components, sectionComponentMap, sectionAssemblyMap);
  }

  const budgetedComponents = Math.max(totalAuthoredComponents, expandedComponents);

  if (budgetedComponents > budget.maxComponents) {
    throw componentValidationError({
      code: "PLAN_COMPONENTS_OVER_BUDGET",
      message: `ComponentPlan has ${totalAuthoredComponents} authored components and ${expandedComponents} estimated expanded components, exceeding the ${tier} size tier budget of ${budget.maxComponents}.`,
      repairHint: "Reduce repeated detail, combine simple volumes, choose a larger sizeTier, or split the build into sections.",
    });
  }

  const estimatedBlocks = estimateExpandedBlocks(plan, componentMap, assemblyMap, unit);
  if (estimatedBlocks > budget.maxEstimatedBlocks) {
    throw componentValidationError({
      code: "PLAN_ESTIMATED_BLOCKS_OVER_BUDGET",
      message: `ComponentPlan estimated expanded block count ${estimatedBlocks} exceeds the ${tier} size tier budget of ${budget.maxEstimatedBlocks}.`,
      repairHint: "Shrink large volumes, reduce repeated components, choose a larger sizeTier, or split the build into sections.",
    });
  }
}

function estimateExpandedBlocks(
  plan: ComponentPlanDocument,
  componentMap: Map<string, ComponentNode>,
  assemblyMap: Map<string, ComponentAssemblyDefinition>,
  unit: 1 | 2
): number {
  let total = 0;
  for (const component of plan.components ?? []) {
    total += estimateComponentBlocks(component, componentMap, assemblyMap, plan.bounds, unit);
  }

  for (const section of plan.sections ?? []) {
    const sectionAssemblyMap = buildSectionAssemblyMap(assemblyMap, section);
    const sectionComponentMap = buildComponentMap(section.components, `Section "${section.id}"`);
    for (const component of section.components) {
      total += estimateComponentBlocks(component, sectionComponentMap, sectionAssemblyMap, section.bounds, unit);
    }
  }

  return total;
}

function estimateExpandedComponentCount(
  components: readonly ComponentNode[],
  componentMap: Map<string, ComponentNode>,
  assemblyMap: Map<string, ComponentAssemblyDefinition>
): number {
  let total = 0;
  for (const component of components) {
    if (component.type === "Instance") {
      const assembly = assemblyMap.get(component.placement.assembly);
      if (assembly) {
        const localComponentMap = buildComponentMap(assembly.components, `Assembly "${assembly.id}"`);
        total += estimateExpandedComponentCount(assembly.components, localComponentMap, assemblyMap);
      }
      continue;
    }
    if (component.type === "Repeat") {
      total += component.placement.count - 1;
      continue;
    }
    total += 1;
  }

  return Math.max(total, componentMap.size);
}

function estimateComponentBlocks(
  component: ComponentNode,
  componentMap: Map<string, ComponentNode>,
  assemblyMap: Map<string, ComponentAssemblyDefinition>,
  bounds: ComponentSize,
  unit: 1 | 2
): number {
  switch (component.type) {
    case "Foundation":
    case "Platform":
    case "Beam":
    case "SupportPost":
      return componentVolume(component.placement.size) * unit * unit * unit;
    case "RoomShell": {
      const size = component.placement.size;
      const W = size.width * unit;
      const H = size.height * unit;
      const L = size.length * unit;

      const includeFloor = component.options?.includeFloor ?? true;
      const includeCeiling = component.options?.includeCeiling ?? true;

      const innerW = Math.max(0, W - 2);
      const innerL = Math.max(0, L - 2);

      let ySubtract = 0;
      if (includeFloor) ySubtract += 1;
      if (includeCeiling) ySubtract += 1;
      const innerH = Math.max(0, H - ySubtract);

      const innerVolume = innerW * innerH * innerL;
      const totalVolume = W * H * L;
      return totalVolume - innerVolume;
    }
    case "Compartment": {
      const size = component.placement.size;
      const W = size.width * unit;
      const H = size.height * unit;
      const L = size.length * unit;

      const includeFloor = component.options?.includeFloor ?? true;
      const includeCeiling = component.options?.includeCeiling ?? true;

      const innerW = Math.max(0, W - 2);
      const innerL = Math.max(0, L - 2);

      let ySubtract = 0;
      if (includeFloor) ySubtract += 1;
      if (includeCeiling) ySubtract += 1;
      const innerH = Math.max(0, H - ySubtract);

      const innerVolume = innerW * innerH * innerL;
      const totalVolume = W * H * L;
      return totalVolume - innerVolume;
    }
    case "Corridor":
      return estimateCorridorBlocks(component, unit);
    case "Door":
    case "Window":
    case "Opening":
    case "Portal": {
      const width = component.placement.width ?? defaultAttachmentWidth(component.type);
      const height = component.placement.height ?? defaultAttachmentHeight(component.type);
      return width * height * unit * unit;
    }
    case "GableRoof": {
      const target = componentMap.get(component.placement.over);
      if (!target || !isAnchoredComponent(target)) {
        return 0;
      }
      const geometry = roofGeometry(component, target, bounds, unit);
      const width = geometry.maxX - geometry.minX;
      const length = geometry.maxZ - geometry.minZ;
      const scaledHeight = geometry.scaledMaxY - geometry.baseY * unit;
      return width * unit * length * unit * scaledHeight;
    }
    case "FlatRoof": {
      const target = componentMap.get(component.placement.over);
      if (!target || !isAnchoredComponent(target)) {
        return 0;
      }
      const geometry = flatRoofGeometry(component, target, bounds, unit);
      const width = geometry.maxX - geometry.minX;
      const length = geometry.maxZ - geometry.minZ;
      const scaledHeight = geometry.scaledMaxY - geometry.baseY * unit;
      return width * unit * length * unit * scaledHeight;
    }
    case "Repeat": {
      const source = componentMap.get(component.placement.source);
      if (!source) {
        return 0;
      }
      const singleVolume = estimateComponentBlocks(source, componentMap, assemblyMap, bounds, unit);
      return singleVolume * (component.placement.count - 1);
    }
    case "Instance": {
      const assembly = assemblyMap.get(component.placement.assembly);
      if (!assembly) {
        return 0;
      }
      const localComponentMap = buildComponentMap(assembly.components, `Assembly "${assembly.id}"`);
      let total = 0;
      for (const localComponent of assembly.components) {
        total += estimateComponentBlocks(localComponent, localComponentMap, new Map(), assembly.bounds, unit);
      }
      return total;
    }
    default: {
      const _exhaustiveCheck: never = component;
      throw new ValidationError(`Unhandled component type: ${(_exhaustiveCheck as any).type}`);
    }
  }
}

function componentVolume(size: ComponentSize): number {
  return size.width * size.height * size.length;
}

function corridorAxis(component: Extract<ComponentNode, { type: "Corridor" }>): "x" | "z" {
  return component.options?.axis ?? (component.placement.size.width >= component.placement.size.length ? "x" : "z");
}

function estimateCorridorBlocks(component: Extract<ComponentNode, { type: "Corridor" }>, unit: 1 | 2): number {
  const { size } = component.placement;
  const W = size.width * unit;
  const H = size.height * unit;
  const L = size.length * unit;
  const axis = corridorAxis(component);
  let total = 0;

  if (component.options?.includeFloor ?? true) {
    total += W * L * unit;
  }

  if (component.options?.includeWalls ?? true) {
    total += axis === "z" ? 2 * H * L * unit : 2 * W * H * unit;
  }

  if (component.options?.includeCeiling ?? true) {
    total += W * L * unit;
  }

  return total;
}

function validateRepeats(
  components: readonly ComponentNode[],
  bounds: ComponentSize,
  componentMap: Map<string, ComponentNode>
): void {
  for (const component of components) {
    if (component.type !== "Repeat") {
      continue;
    }

    const source = componentMap.get(component.placement.source);
    if (!source || !isRepeatableComponent(source)) {
      throw componentValidationError({
        code: "INVALID_REPEAT_SOURCE",
        componentId: component.id,
        message: `Repeat "${component.id}" must reference an anchored repeatable source component.`,
        repairHint: "Repeat a Foundation, Platform, Beam, RoomShell, Compartment, Corridor, or SupportPost component.",
      });
    }

    for (let index = 1; index < component.placement.count; index += 1) {
      const shifted = shiftAnchoredPlacement(source.placement, component.placement.axis, component.placement.step * index);
      const clone = { ...source, id: `${component.id}__${source.id}_${index}`, placement: shifted };

      const { anchor, size } = clone.placement;
      const isWithinBounds =
        anchor.x + size.width <= bounds.width &&
        anchor.y + size.height <= bounds.height &&
        anchor.z + size.length <= bounds.length;

      if (!isWithinBounds) {
        throw componentValidationError({
          code: "COMPONENT_OUT_OF_BOUNDS",
          componentId: component.id,
          message: `Repeat "${component.id}" clone ${index} (${clone.id}) placement exceeds ComponentPlan bounds.`,
          repairHint: `Reduce Repeat count, reduce step size, or increase plan bounds to fit all ${component.placement.count} repetitions.`,
        });
      }
    }
  }
}
function validateComponentMaterials(plan: ComponentPlanDocument, component: ComponentNode): void {
  for (const value of Object.values(component.materials ?? {})) {
    if (!isKnownBlockRef(plan, value)) {
      throw componentValidationError({
        code: "UNKNOWN_MATERIAL_REF",
        componentId: component.id,
        message: `Component "${component.id}" references unknown material "${value}".`,
        repairHint: "Use a palette key from ComponentPlan.palette or a minecraft: block identifier.",
      });
    }
  }

  for (const fallback of requiredFallbackMaterials(component)) {
    if (!component.materials?.[fallback.role] && !isKnownBlockRef(plan, fallback.value)) {
      throw componentValidationError({
        code: "UNKNOWN_MATERIAL_REF",
        componentId: component.id,
        message: `Component "${component.id}" requires palette key "${fallback.value}" when materials.${fallback.role} is omitted.`,
        repairHint: `Add palette.${fallback.value}, set materials.${fallback.role}, or use a minecraft: block identifier.`,
      });
    }
  }
}

function requiredFallbackMaterials(component: ComponentNode): { role: string; value: string }[] {
  switch (component.type) {
    case "Foundation":
      return [{ role: "main", value: "foundation" }];
    case "Platform":
      return [{ role: "main", value: "floor" }];
    case "Beam":
      return [{ role: "main", value: "trim" }];
    case "RoomShell":
    case "Compartment":
      return [{ role: "wall", value: "wall" }];
    case "Corridor": {
      const fallbacks: { role: string; value: string }[] = [];
      if (component.options?.includeFloor ?? true) {
        fallbacks.push({ role: "floor", value: "floor" });
      }
      if (component.options?.includeWalls ?? true) {
        fallbacks.push({ role: "wall", value: "wall" });
      }
      if (component.options?.includeCeiling ?? true) {
        fallbacks.push({ role: "ceiling", value: "floor" });
      }
      return fallbacks;
    }
    case "Door":
      return [{ role: "door", value: "door" }];
    case "Window":
      return [{ role: "glass", value: "glass" }];
    case "Opening":
      return [];
    case "Portal":
      return [{ role: "surface", value: "portal" }];
    case "GableRoof":
      return [{ role: "roof", value: "roof" }];
    case "FlatRoof":
      return [{ role: "roof", value: "roof" }];
    case "SupportPost":
      return [{ role: "main", value: "trim" }];
    case "Repeat":
    case "Instance":
      return [];
    default: {
      const _exhaustiveCheck: never = component;
      throw new ValidationError(`Unhandled component type: ${(_exhaustiveCheck as any).type}`);
    }
  }
}

function isKnownBlockRef(plan: ComponentPlanDocument, value: string): boolean {
  return value.startsWith("minecraft:") || Object.prototype.hasOwnProperty.call(plan.palette, value);
}

function expandInputs(component: ComponentNode, componentMap: Map<string, ComponentNode>) {
  const refs = new Set((component.inputs ?? []).map((input) => input.ref));

  if (isAttachmentComponent(component)) {
    refs.add(component.placement.target);
  }

  if (isCoverComponent(component)) {
    refs.add(component.placement.over);
  }

  if (component.type === "Repeat") {
    refs.add(component.placement.source);
  }

  return [...refs].map((ref) => ({
    ref: nodeId(ref, outputPart(componentMap.get(ref)!)),
  }));
}

function nodeId(componentId: string, partName: string): string {
  return `${componentId}__${partName}`;
}

function outputPart(component: ComponentNode): string {
  switch (component.type) {
    case "Foundation":
      return "solid";
    case "Platform":
      return "platform";
    case "Beam":
      return "beam";
    case "RoomShell":
      return "shell";
    case "Compartment":
      return "shell";
    case "Corridor":
      return corridorOutputPart(component);
    case "Door":
    case "Window":
    case "Opening":
      return "opening";
    case "Portal":
      return "portal";
    case "GableRoof":
      return "gable";
    case "FlatRoof":
      return "flat_roof";
    case "SupportPost":
      return "post";
    case "Repeat":
      return "repeat";
    case "Instance":
      return "instance";
    default: {
      const _exhaustiveCheck: never = component;
      throw new ValidationError(`Unhandled component type: ${(_exhaustiveCheck as any).type}`);
    }
  }
}

function corridorOutputPart(component: Extract<ComponentNode, { type: "Corridor" }>): string {
  if (component.options?.includeFloor ?? true) {
    return "floor";
  }
  if (component.options?.includeWalls ?? true) {
    return "left_wall";
  }
  if (component.options?.includeCeiling ?? true) {
    return "ceiling";
  }
  return "floor";
}

function expandRepeat(
  component: Extract<ComponentNode, { type: "Repeat" }>,
  componentMap: Map<string, ComponentNode>,
  unit: 1 | 2
): CraftDagNode[] {
  const source = componentMap.get(component.placement.source);
  if (!source || !isRepeatableComponent(source)) {
    throw componentValidationError({
      code: "INVALID_REPEAT_SOURCE",
      componentId: component.id,
      message: `Repeat "${component.id}" must reference an anchored repeatable source component.`,
      repairHint: "Repeat a Foundation, Platform, Beam, RoomShell, Compartment, Corridor, or SupportPost component.",
    });
  }

  const nodes: CraftDagNode[] = [];
  for (let index = 1; index < component.placement.count; index += 1) {
    const repeatedId = `${component.id}__${source.id}_${index}`;
    const shifted = {
      ...source,
      id: repeatedId,
      placement: shiftAnchoredPlacement(source.placement, component.placement.axis, component.placement.step * index),
    } as RepeatableComponent;

    nodes.push(...expandRepeatableComponent(shifted, source, component, componentMap, unit));
  }

  return nodes;
}

function expandRepeatableComponent(
  repeated: RepeatableComponent,
  source: RepeatableComponent,
  repeatComponent: Extract<ComponentNode, { type: "Repeat" }>,
  componentMap: Map<string, ComponentNode>,
  unit: 1 | 2
): CraftDagNode[] {
  const inputsMap = new Map<string, { ref: string }>();
  for (const input of expandInputs(source, componentMap)) {
    inputsMap.set(input.ref, input);
  }
  for (const input of expandInputs(repeatComponent, componentMap)) {
    inputsMap.set(input.ref, input);
  }
  const inputs = [...inputsMap.values()];

  switch (repeated.type) {
    case "Foundation":
      return [{
        id: nodeId(repeated.id, "solid"),
        type: "SolidBox",
        inputs,
        params: {
          ...scaledBox(repeated.placement, unit),
          block: material(source, "main", "foundation"),
        },
      }];
    case "Platform":
      return [{
        id: nodeId(repeated.id, "platform"),
        type: "SolidBox",
        inputs,
        params: {
          ...scaledBox(repeated.placement, unit),
          block: material(source, "main", "floor"),
        },
      }];
    case "Beam":
      return [{
        id: nodeId(repeated.id, "beam"),
        type: "SolidBox",
        inputs,
        params: {
          ...scaledBox(repeated.placement, unit),
          block: material(source, "main", "trim"),
        },
      }];
    case "RoomShell":
      return [{
        id: nodeId(repeated.id, "shell"),
        type: "HollowBox",
        inputs,
        params: {
          ...scaledBox(repeated.placement, unit),
          block: material(source, "wall", "wall"),
          includeFloor: source.options?.includeFloor,
          includeCeiling: source.options?.includeCeiling,
        },
      }];
    case "Compartment":
      return [{
        id: nodeId(repeated.id, "shell"),
        type: "HollowBox",
        inputs,
        params: {
          ...scaledBox(repeated.placement, unit),
          block: material(source, "wall", "wall"),
          includeFloor: source.options?.includeFloor,
          includeCeiling: source.options?.includeCeiling,
        },
      }];
    case "Corridor":
      return expandCorridor({ ...repeated, materials: source.materials, options: source.options }, componentMap, unit, inputs);
    case "SupportPost":
      return [{
        id: nodeId(repeated.id, "post"),
        type: "SolidBox",
        inputs,
        params: {
          ...scaledBox(repeated.placement, unit),
          block: material(source, "main", "trim"),
        },
      }];
    default: {
      const _exhaustiveCheck: never = repeated;
      throw new ValidationError(`Unhandled repeatable component type: ${(_exhaustiveCheck as any).type}`);
    }
  }
}

function expandInstance(
  component: Extract<ComponentNode, { type: "Instance" }>,
  componentMap: Map<string, ComponentNode>,
  assemblyMap: Map<string, ComponentAssemblyDefinition>,
  unit: 1 | 2
): CraftDagNode[] {
  const assembly = assemblyMap.get(component.placement.assembly);
  if (!assembly) {
    throw componentValidationError({
      code: "UNKNOWN_ASSEMBLY_REF",
      componentId: component.id,
      instanceId: component.id,
      message: `Instance "${component.id}" references unknown assembly "${component.placement.assembly}".`,
      repairHint: "Change placement.assembly to an existing assembly ID or define that assembly.",
    });
  }

  const localComponentMap = buildComponentMap(assembly.components, `Assembly "${assembly.id}"`);
  const shiftedNodes: CraftDagNode[] = [];
  const externalInputs = expandInputs(component, componentMap);
  const shift: Vec3 = [
    component.placement.anchor.x * unit,
    component.placement.anchor.y * unit,
    component.placement.anchor.z * unit,
  ];

  for (const localComponent of assembly.components) {
    let localNodes: CraftDagNode[];
    try {
      localNodes = expandComponentToNodes(localComponent, localComponentMap, assembly.bounds, unit);
    } catch (error) {
      throw withDiagnosticContext(error, { assemblyId: assembly.id, instanceId: component.id });
    }
    for (const localNode of localNodes) {
      shiftedNodes.push(namespaceAndShiftNode(localNode, component.id, shift, externalInputs));
    }
  }

  return shiftedNodes;
}

function namespaceAndShiftNode(
  node: CraftDagNode,
  instanceId: string,
  shift: Vec3,
  externalInputs: { ref: string }[]
): CraftDagNode {
  const inputsMap = new Map<string, { ref: string }>();
  for (const input of node.inputs ?? []) {
    inputsMap.set(`${instanceId}__${input.ref}`, { ref: `${instanceId}__${input.ref}` });
  }
  for (const input of externalInputs) {
    inputsMap.set(input.ref, input);
  }

  const base = {
    ...node,
    id: `${instanceId}__${node.id}`,
    inputs: [...inputsMap.values()],
  };

  switch (node.type) {
    case "SolidBox":
    case "HollowBox":
    case "Wall":
    case "Floor":
    case "Column":
    case "Doorway":
    case "Window":
      return {
        ...base,
        type: node.type,
        params: {
          ...node.params,
          from: addVec3(node.params.from, shift),
          to: addVec3(node.params.to, shift),
        },
      } as CraftDagNode;
    case "GableRoof":
      return {
        ...base,
        type: "GableRoof",
        params: {
          ...node.params,
          from: addVec3(node.params.from, shift),
          to: addVec3(node.params.to, shift),
        },
      };
    default: {
      const _exhaustiveCheck: never = node;
      throw new ValidationError(`Unhandled CraftDAG node type: ${(_exhaustiveCheck as any).type}`);
    }
  }
}

function addVec3(a: Vec3, b: Vec3): Vec3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function material(component: ComponentNode, role: string, fallback: string): string {
  return component.materials?.[role] ?? fallback;
}

function shiftAnchoredPlacement(
  placement: RepeatableComponent["placement"],
  axis: "x" | "y" | "z",
  distance: number
): RepeatableComponent["placement"] {
  return {
    ...placement,
    anchor: {
      ...placement.anchor,
      [axis]: placement.anchor[axis] + distance,
    },
  };
}

function scaledBox(
  placement: { anchor: { x: number; y: number; z: number }; size: ComponentSize },
  unit: 1 | 2
): { from: Vec3; to: Vec3 } {
  return {
    from: [placement.anchor.x * unit, placement.anchor.y * unit, placement.anchor.z * unit],
    to: [
      (placement.anchor.x + placement.size.width) * unit - 1,
      (placement.anchor.y + placement.size.height) * unit - 1,
      (placement.anchor.z + placement.size.length) * unit - 1,
    ],
  };
}

function scaledAttachmentBox(
  placement: WallAttachmentPlacement,
  componentMap: Map<string, ComponentNode>,
  unit: 1 | 2,
  defaultWidth: number,
  defaultHeight: number
): { from: Vec3; to: Vec3 } {
  const target = componentMap.get(placement.target);
  if (!target || !isAnchoredComponent(target)) {
    throw componentValidationError({
      code: "INVALID_ATTACHMENT_TARGET",
      componentId: placement.target,
      message: `Attachment target "${placement.target}" is not anchored.`,
      repairHint: "Use a RoomShell or another anchored component as the target.",
    });
  }

  const width = placement.width ?? defaultWidth;
  const height = placement.height ?? defaultHeight;
  const yFrom = (target.placement.anchor.y + placement.y) * unit;
  const yTo = (target.placement.anchor.y + placement.y + height) * unit - 1;

  if (placement.wall === "front" || placement.wall === "back") {
    const xFrom = (target.placement.anchor.x + placement.offset) * unit;
    const xTo = (target.placement.anchor.x + placement.offset + width) * unit - 1;
    const z = (placement.wall === "front"
      ? target.placement.anchor.z
      : target.placement.anchor.z + target.placement.size.length) * unit - (placement.wall === "back" ? 1 : 0);
    return {
      from: [xFrom, yFrom, z],
      to: [xTo, yTo, z],
    };
  }

  const zFrom = (target.placement.anchor.z + placement.offset) * unit;
  const zTo = (target.placement.anchor.z + placement.offset + width) * unit - 1;
  const x = (placement.wall === "left"
    ? target.placement.anchor.x
    : target.placement.anchor.x + target.placement.size.width) * unit - (placement.wall === "right" ? 1 : 0);

  return {
    from: [x, yFrom, zFrom],
    to: [x, yTo, zTo],
  };
}

function scaledRoofBox(
  component: Extract<ComponentNode, { type: "GableRoof" }>,
  componentMap: Map<string, ComponentNode>,
  bounds: ComponentSize,
  unit: 1 | 2
): { from: Vec3; to: Vec3 } {
  const target = componentMap.get(component.placement.over);
  if (!target || !isAnchoredComponent(target)) {
    throw componentValidationError({
      code: "INVALID_COVER_TARGET",
      componentId: component.id,
      message: `GableRoof "${component.id}" must cover an anchored component.`,
      repairHint: "Set placement.over to a RoomShell or another anchored component.",
    });
  }

  const geometry = roofGeometry(component, target, bounds, unit);

  return {
    from: [geometry.minX * unit, geometry.baseY * unit, geometry.minZ * unit],
    to: [geometry.maxX * unit - 1, geometry.scaledMaxY - 1, geometry.maxZ * unit - 1],
  };
}

function scaledFlatRoofBox(
  component: Extract<ComponentNode, { type: "FlatRoof" }>,
  componentMap: Map<string, ComponentNode>,
  bounds: ComponentSize,
  unit: 1 | 2
): { from: Vec3; to: Vec3 } {
  const target = componentMap.get(component.placement.over);
  if (!target || !isAnchoredComponent(target)) {
    throw componentValidationError({
      code: "INVALID_COVER_TARGET",
      componentId: component.id,
      message: `FlatRoof "${component.id}" must cover an anchored component.`,
      repairHint: "Set placement.over to a RoomShell or another anchored component.",
    });
  }

  const geometry = flatRoofGeometry(component, target, bounds, unit);

  return {
    from: [geometry.minX * unit, geometry.baseY * unit, geometry.minZ * unit],
    to: [geometry.maxX * unit - 1, geometry.scaledMaxY - 1, geometry.maxZ * unit - 1],
  };
}

function roofGeometry(
  component: Extract<ComponentNode, { type: "GableRoof" }>,
  target: AnchoredComponent,
  bounds: ComponentSize,
  unit: 1 | 2
) {
  const cover = coverGeometry(component, target, bounds);
  const slopeSpan = component.placement.direction === "z" ? cover.maxX - cover.minX : cover.maxZ - cover.minZ;
  const scaledSlopeSpan = slopeSpan * unit;
  const scaledRoofHeight = Math.max(1, Math.ceil(scaledSlopeSpan / 2));
  const scaledMaxY = cover.baseY * unit + scaledRoofHeight;

  return { ...cover, scaledMaxY };
}

function flatRoofGeometry(
  component: Extract<ComponentNode, { type: "FlatRoof" }>,
  target: AnchoredComponent,
  bounds: ComponentSize,
  unit: 1 | 2
) {
  const cover = coverGeometry(component, target, bounds);
  const scaledMaxY = (cover.baseY + 1) * unit;

  return { ...cover, scaledMaxY };
}

function coverGeometry(
  component: Extract<ComponentNode, { type: "GableRoof" | "FlatRoof" }>,
  target: AnchoredComponent,
  bounds: ComponentSize
) {
  const requestedOverhang = component.placement.overhang ?? 0;
  const maxSymmetricOverhang = Math.min(
    requestedOverhang,
    target.placement.anchor.x,
    target.placement.anchor.z,
    bounds.width - (target.placement.anchor.x + target.placement.size.width),
    bounds.length - (target.placement.anchor.z + target.placement.size.length)
  );
  const overhang = Math.max(0, maxSymmetricOverhang);
  const minX = target.placement.anchor.x - overhang;
  const minZ = target.placement.anchor.z - overhang;
  const maxX = target.placement.anchor.x + target.placement.size.width + overhang;
  const maxZ = target.placement.anchor.z + target.placement.size.length + overhang;
  const baseY = target.placement.anchor.y + target.placement.size.height;

  return { minX, minZ, maxX, maxZ, baseY };
}

function isAnchoredComponent(component: ComponentNode): component is AnchoredComponent {
  return "anchor" in component.placement && "size" in component.placement;
}

function isCoverComponent(
  component: ComponentNode
): component is Extract<ComponentNode, { type: "GableRoof" | "FlatRoof" }> {
  return component.type === "GableRoof" || component.type === "FlatRoof";
}

function isAttachmentComponent(
  component: ComponentNode
): component is Extract<ComponentNode, { type: "Door" | "Window" | "Opening" | "Portal" }> {
  return component.type === "Door" || component.type === "Window" || component.type === "Opening" || component.type === "Portal";
}

function defaultAttachmentWidth(componentType: "Door" | "Window" | "Opening" | "Portal"): number {
  switch (componentType) {
    case "Door":
    case "Window":
    case "Opening":
      return 1;
    case "Portal":
      return 2;
    default: {
      const _exhaustiveCheck: never = componentType;
      throw new ValidationError(`Unhandled attachment component type: ${_exhaustiveCheck}`);
    }
  }
}

function defaultAttachmentHeight(componentType: "Door" | "Window" | "Opening" | "Portal"): number {
  switch (componentType) {
    case "Door":
    case "Opening":
      return 2;
    case "Window":
      return 1;
    case "Portal":
      return 3;
    default: {
      const _exhaustiveCheck: never = componentType;
      throw new ValidationError(`Unhandled attachment component type: ${_exhaustiveCheck}`);
    }
  }
}

function isRepeatableComponent(component: ComponentNode): component is RepeatableComponent {
  return (
    component.type === "Foundation" ||
    component.type === "Platform" ||
    component.type === "Beam" ||
    component.type === "RoomShell" ||
    component.type === "Compartment" ||
    component.type === "Corridor" ||
    component.type === "SupportPost"
  );
}
