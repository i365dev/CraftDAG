import { z } from "zod";
import { GraphError, ValidationError } from "./errors.js";
import { compileDocument } from "./compiler/compileDocument.js";
import {
  ComponentNode,
  ComponentPlanDocument,
  ComponentSize,
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

const FoundationComponentSchema = z.object({
  id: z.string().min(1),
  type: z.literal("Foundation"),
  inputs: z.array(ComponentInputSchema).optional(),
  placement: AnchoredPlacementSchema,
  materials: MaterialsSchema,
}).strict();

const PlatformComponentSchema = z.object({
  id: z.string().min(1),
  type: z.literal("Platform"),
  inputs: z.array(ComponentInputSchema).optional(),
  placement: AnchoredPlacementSchema,
  materials: MaterialsSchema,
}).strict();

const BeamComponentSchema = z.object({
  id: z.string().min(1),
  type: z.literal("Beam"),
  inputs: z.array(ComponentInputSchema).optional(),
  placement: AnchoredPlacementSchema,
  materials: MaterialsSchema,
}).strict();

const RoomShellComponentSchema = z.object({
  id: z.string().min(1),
  type: z.literal("RoomShell"),
  inputs: z.array(ComponentInputSchema).optional(),
  placement: AnchoredPlacementSchema,
  materials: MaterialsSchema,
  options: z.object({
    includeFloor: z.boolean().optional(),
    includeCeiling: z.boolean().optional(),
  }).strict().optional(),
}).strict();

const DoorComponentSchema = z.object({
  id: z.string().min(1),
  type: z.literal("Door"),
  inputs: z.array(ComponentInputSchema).optional(),
  placement: WallAttachmentPlacementSchema,
  materials: MaterialsSchema,
}).strict();

const WindowComponentSchema = z.object({
  id: z.string().min(1),
  type: z.literal("Window"),
  inputs: z.array(ComponentInputSchema).optional(),
  placement: WallAttachmentPlacementSchema,
  materials: MaterialsSchema,
}).strict();

const OpeningComponentSchema = z.object({
  id: z.string().min(1),
  type: z.literal("Opening"),
  inputs: z.array(ComponentInputSchema).optional(),
  placement: WallAttachmentPlacementSchema,
  materials: MaterialsSchema,
}).strict();

const PortalComponentSchema = z.object({
  id: z.string().min(1),
  type: z.literal("Portal"),
  inputs: z.array(ComponentInputSchema).optional(),
  placement: WallAttachmentPlacementSchema,
  materials: MaterialsSchema,
}).strict();

const GableRoofComponentSchema = z.object({
  id: z.string().min(1),
  type: z.literal("GableRoof"),
  inputs: z.array(ComponentInputSchema).optional(),
  placement: CoverPlacementSchema,
  materials: MaterialsSchema,
}).strict();

const FlatRoofComponentSchema = z.object({
  id: z.string().min(1),
  type: z.literal("FlatRoof"),
  inputs: z.array(ComponentInputSchema).optional(),
  placement: CoverPlacementSchema,
  materials: MaterialsSchema,
}).strict();

const SupportPostComponentSchema = z.object({
  id: z.string().min(1),
  type: z.literal("SupportPost"),
  inputs: z.array(ComponentInputSchema).optional(),
  placement: AnchoredPlacementSchema,
  materials: MaterialsSchema,
}).strict();

const ComponentNodeSchema = z.discriminatedUnion("type", [
  FoundationComponentSchema,
  PlatformComponentSchema,
  BeamComponentSchema,
  RoomShellComponentSchema,
  DoorComponentSchema,
  WindowComponentSchema,
  OpeningComponentSchema,
  PortalComponentSchema,
  GableRoofComponentSchema,
  FlatRoofComponentSchema,
  SupportPostComponentSchema,
]);

const ComponentPlanSchema = z.object({
  version: z.literal("0.1"),
  name: z.string().min(1),
  grid: z.object({
    unitBlocks: z.union([z.literal(1), z.literal(2)]).optional(),
  }).strict().optional(),
  bounds: ComponentSizeSchema,
  palette: z.record(z.string(), z.string().min(1)),
  components: z.array(ComponentNodeSchema),
}).strict();

type AnchoredComponent = Extract<ComponentNode, { placement: { anchor: unknown; size: unknown } }>;

interface ComponentValidationIssue {
  stage: "component-validation";
  code: string;
  componentId?: string;
  path?: string;
  message: string;
  availableRefs?: string[];
  repairHint?: string;
}

/**
 * Validates a ComponentPlan document and its semantic component graph.
 */
export function validateComponentPlan(doc: unknown): ComponentPlanDocument {
  const result = ComponentPlanSchema.safeParse(doc);
  if (!result.success) {
    const details: ComponentValidationIssue[] = result.error.errors.map((err) => ({
      stage: "component-validation",
      code: "SCHEMA_VALIDATION_FAILED",
      path: err.path.join("."),
      message: err.message,
      repairHint: "Update the ComponentPlan JSON to match the v0.1 schema.",
    }));
    throw new ValidationError("ComponentPlan schema validation failed", details);
  }

  const parsed = result.data as ComponentPlanDocument;
  const componentMap = new Map<string, ComponentNode>();

  for (const component of parsed.components) {
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

  for (const component of parsed.components) {
    for (const input of component.inputs ?? []) {
      if (!componentMap.has(input.ref)) {
        throw unknownRefError(component, `inputs ref "${input.ref}"`, input.ref, componentMap);
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

    if (isAnchoredComponent(component)) {
      validateAnchoredBounds(parsed.bounds, component);
    }

    validateComponentMaterials(parsed, component);
  }

  validateComponentGraph(parsed);
  validateAttachments(parsed, componentMap);
  validateCovers(parsed, componentMap);

  return parsed;
}

/**
 * Expands a validated ComponentPlan into low-level CraftDAG primitives.
 */
export function expandComponentPlan(doc: unknown): CraftDagDocument {
  const plan = validateComponentPlan(doc);
  const unit = plan.grid?.unitBlocks ?? 1;
  const componentMap = new Map(plan.components.map((component) => [component.id, component]));
  const craftDagNodes: CraftDagNode[] = [];

  for (const component of plan.components) {
    switch (component.type) {
      case "Foundation":
        craftDagNodes.push({
          id: nodeId(component.id, "solid"),
          type: "SolidBox",
          inputs: expandInputs(component, componentMap),
          params: {
            ...scaledBox(component.placement, unit),
            block: material(component, "main", "foundation"),
          },
        });
        break;
      case "Platform":
        craftDagNodes.push({
          id: nodeId(component.id, "platform"),
          type: "SolidBox",
          inputs: expandInputs(component, componentMap),
          params: {
            ...scaledBox(component.placement, unit),
            block: material(component, "main", "floor"),
          },
        });
        break;
      case "Beam":
        craftDagNodes.push({
          id: nodeId(component.id, "beam"),
          type: "SolidBox",
          inputs: expandInputs(component, componentMap),
          params: {
            ...scaledBox(component.placement, unit),
            block: material(component, "main", "trim"),
          },
        });
        break;
      case "RoomShell":
        craftDagNodes.push({
          id: nodeId(component.id, "shell"),
          type: "HollowBox",
          inputs: expandInputs(component, componentMap),
          params: {
            ...scaledBox(component.placement, unit),
            block: material(component, "wall", "wall"),
            includeFloor: component.options?.includeFloor,
            includeCeiling: component.options?.includeCeiling,
          },
        });
        break;
      case "Door":
        craftDagNodes.push({
          id: nodeId(component.id, "opening"),
          type: "Doorway",
          inputs: expandInputs(component, componentMap),
          params: {
            ...scaledAttachmentBox(component.placement, componentMap, unit, 1, 2),
            block: material(component, "door", "door"),
          },
        });
        break;
      case "Window":
        craftDagNodes.push({
          id: nodeId(component.id, "opening"),
          type: "Window",
          inputs: expandInputs(component, componentMap),
          params: {
            ...scaledAttachmentBox(component.placement, componentMap, unit, 1, 1),
            block: material(component, "glass", "glass"),
          },
        });
        break;
      case "Opening":
        craftDagNodes.push({
          id: nodeId(component.id, "opening"),
          type: "Doorway",
          inputs: expandInputs(component, componentMap),
          params: {
            ...scaledAttachmentBox(component.placement, componentMap, unit, 1, 2),
            block: component.materials?.fill,
          },
        });
        break;
      case "Portal":
        craftDagNodes.push({
          id: nodeId(component.id, "portal"),
          type: "Window",
          inputs: expandInputs(component, componentMap),
          params: {
            ...scaledAttachmentBox(component.placement, componentMap, unit, 2, 3),
            block: material(component, "surface", "portal"),
          },
        });
        break;
      case "GableRoof":
        craftDagNodes.push({
          id: nodeId(component.id, "gable"),
          type: "GableRoof",
          inputs: expandInputs(component, componentMap),
          params: {
            ...scaledRoofBox(component, componentMap, plan.bounds, unit),
            block: material(component, "roof", "roof"),
            direction: component.placement.direction,
          },
        });
        break;
      case "FlatRoof":
        craftDagNodes.push({
          id: nodeId(component.id, "flat_roof"),
          type: "SolidBox",
          inputs: expandInputs(component, componentMap),
          params: {
            ...scaledFlatRoofBox(component, componentMap, plan.bounds, unit),
            block: material(component, "roof", "roof"),
          },
        });
        break;
      case "SupportPost":
        craftDagNodes.push({
          id: nodeId(component.id, "post"),
          type: "SolidBox",
          inputs: expandInputs(component, componentMap),
          params: {
            ...scaledBox(component.placement, unit),
            block: material(component, "main", "trim"),
          },
        });
        break;
      default: {
        const _exhaustiveCheck: never = component;
        throw new ValidationError(`Unhandled component type: ${(_exhaustiveCheck as any).type}`);
      }
    }
  }

  return {
    version: "0.1",
    name: plan.name,
    size: [plan.bounds.width * unit, plan.bounds.height * unit, plan.bounds.length * unit],
    palette: plan.palette,
    nodes: craftDagNodes,
  };
}

export function compileComponentPlan(doc: unknown): VoxelPlan {
  return compileDocument(expandComponentPlan(doc));
}

function componentValidationError(issue: Omit<ComponentValidationIssue, "stage">): ValidationError {
  return new ValidationError(issue.message, [{ stage: "component-validation", ...issue }]);
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

function validateComponentGraph(plan: ComponentPlanDocument): void {
  const inDegree = new Map<string, number>();
  const adj = new Map<string, string[]>();

  for (const component of plan.components) {
    inDegree.set(component.id, 0);
    adj.set(component.id, []);
  }

  for (const component of plan.components) {
    const refs = new Set((component.inputs ?? []).map((input) => input.ref));
    if (isAttachmentComponent(component)) {
      refs.add(component.placement.target);
    }
    if (isCoverComponent(component)) {
      refs.add(component.placement.over);
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

  if (sorted.length !== plan.components.length) {
    const cycleComponentIds = [...inDegree.entries()]
      .filter(([, degree]) => degree > 0)
      .map(([id]) => id);
    throw new GraphError(
      `ComponentPlan dependency cycle detected among components: ${cycleComponentIds.join(", ")}`,
      [{
        stage: "component-validation",
        code: "COMPONENT_DEPENDENCY_CYCLE",
        availableRefs: plan.components.map((component) => component.id),
        repairHint: "Remove or redirect one semantic dependency so the component graph is acyclic.",
      }]
    );
  }
}

function validateAttachments(plan: ComponentPlanDocument, componentMap: Map<string, ComponentNode>): void {
  for (const component of plan.components) {
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

function validateCovers(plan: ComponentPlanDocument, componentMap: Map<string, ComponentNode>): void {
  const unit = plan.grid?.unitBlocks ?? 1;

  for (const component of plan.components) {
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
      ? roofGeometry(component, target, plan.bounds, unit)
      : flatRoofGeometry(component, target, plan.bounds, unit);

    if (geometry.baseY >= plan.bounds.height) {
      throw componentValidationError({
        code: "COVER_OUT_OF_BOUNDS",
        componentId: component.id,
        message: `${component.type} "${component.id}" starts outside ComponentPlan height bounds.`,
        repairHint: "Increase bounds.height or lower the covered component.",
      });
    }

    if (geometry.scaledMaxY > plan.bounds.height * unit) {
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

  const fallback = requiredFallbackMaterial(component);
  if (fallback && !component.materials?.[fallback.role] && !isKnownBlockRef(plan, fallback.value)) {
    throw componentValidationError({
      code: "UNKNOWN_MATERIAL_REF",
      componentId: component.id,
      message: `Component "${component.id}" requires palette key "${fallback.value}" when materials.${fallback.role} is omitted.`,
      repairHint: `Add palette.${fallback.value}, set materials.${fallback.role}, or use a minecraft: block identifier.`,
    });
  }
}

function requiredFallbackMaterial(component: ComponentNode): { role: string; value: string } | undefined {
  switch (component.type) {
    case "Foundation":
      return { role: "main", value: "foundation" };
    case "Platform":
      return { role: "main", value: "floor" };
    case "Beam":
      return { role: "main", value: "trim" };
    case "RoomShell":
      return { role: "wall", value: "wall" };
    case "Door":
      return { role: "door", value: "door" };
    case "Window":
      return { role: "glass", value: "glass" };
    case "Opening":
      return undefined;
    case "Portal":
      return { role: "surface", value: "portal" };
    case "GableRoof":
      return { role: "roof", value: "roof" };
    case "FlatRoof":
      return { role: "roof", value: "roof" };
    case "SupportPost":
      return { role: "main", value: "trim" };
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
    default: {
      const _exhaustiveCheck: never = component;
      throw new ValidationError(`Unhandled component type: ${(_exhaustiveCheck as any).type}`);
    }
  }
}

function material(component: ComponentNode, role: string, fallback: string): string {
  return component.materials?.[role] ?? fallback;
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
