import { z } from "zod";
import { ValidationError } from "./errors.js";
import { CraftDagDocument } from "./types.js";

const Vec3Schema = z.tuple([
  z.number().int().nonnegative(),
  z.number().int().nonnegative(),
  z.number().int().nonnegative(),
]);

const NodeInputSchema = z.object({
  ref: z.string().min(1),
}).strict();

const SolidBoxNodeSchema = z.object({
  id: z.string().min(1),
  type: z.literal("SolidBox"),
  inputs: z.array(NodeInputSchema).optional(),
  params: z.object({
    from: Vec3Schema,
    to: Vec3Schema,
    block: z.string().min(1),
  }).strict(),
}).strict();

const HollowBoxNodeSchema = z.object({
  id: z.string().min(1),
  type: z.literal("HollowBox"),
  inputs: z.array(NodeInputSchema).optional(),
  params: z.object({
    from: Vec3Schema,
    to: Vec3Schema,
    block: z.string().min(1),
    includeFloor: z.boolean().optional(),
    includeCeiling: z.boolean().optional(),
  }).strict(),
}).strict();

const WallNodeSchema = z.object({
  id: z.string().min(1),
  type: z.literal("Wall"),
  inputs: z.array(NodeInputSchema).optional(),
  params: z.object({
    from: Vec3Schema,
    to: Vec3Schema,
    block: z.string().min(1),
  }).strict(),
}).strict();

const FloorNodeSchema = z.object({
  id: z.string().min(1),
  type: z.literal("Floor"),
  inputs: z.array(NodeInputSchema).optional(),
  params: z.object({
    from: Vec3Schema,
    to: Vec3Schema,
    block: z.string().min(1),
  }).strict(),
}).strict();

const ColumnNodeSchema = z.object({
  id: z.string().min(1),
  type: z.literal("Column"),
  inputs: z.array(NodeInputSchema).optional(),
  params: z.object({
    from: Vec3Schema,
    to: Vec3Schema,
    block: z.string().min(1),
  }).strict(),
}).strict();

const DoorwayNodeSchema = z.object({
  id: z.string().min(1),
  type: z.literal("Doorway"),
  inputs: z.array(NodeInputSchema).optional(),
  params: z.object({
    from: Vec3Schema,
    to: Vec3Schema,
    block: z.string().min(1).optional(),
    facing: z.enum(["north", "south", "east", "west"]).optional(),
  }).strict(),
}).strict();

const WindowNodeSchema = z.object({
  id: z.string().min(1),
  type: z.literal("Window"),
  inputs: z.array(NodeInputSchema).optional(),
  params: z.object({
    from: Vec3Schema,
    to: Vec3Schema,
    block: z.string().min(1).optional(),
  }).strict(),
}).strict();

const GableRoofNodeSchema = z.object({
  id: z.string().min(1),
  type: z.literal("GableRoof"),
  inputs: z.array(NodeInputSchema).optional(),
  params: z.object({
    from: Vec3Schema,
    to: Vec3Schema,
    block: z.string().min(1),
    direction: z.enum(["x", "z"]).optional(),
  }).strict(),
}).strict();

const CraftDagNodeSchema = z.discriminatedUnion("type", [
  SolidBoxNodeSchema,
  HollowBoxNodeSchema,
  WallNodeSchema,
  FloorNodeSchema,
  ColumnNodeSchema,
  DoorwayNodeSchema,
  WindowNodeSchema,
  GableRoofNodeSchema,
]);

const CraftDagDocumentSchema = z.object({
  version: z.literal("0.1"),
  name: z.string().min(1),
  size: z.tuple([
    z.number().int().positive(),
    z.number().int().positive(),
    z.number().int().positive(),
  ]),
  palette: z.record(z.string(), z.string()).optional(),
  nodes: z.array(CraftDagNodeSchema),
}).strict();

/**
 * Validates a CraftDAG document against the schema.
 * Rejects unknown fields, invalid types, duplicate node IDs, and missing input references.
 */
export function validateDocument(doc: unknown): CraftDagDocument {
  const result = CraftDagDocumentSchema.safeParse(doc);
  if (!result.success) {
    const errorDetails = result.error.errors.map(err => `${err.path.join(".")}: ${err.message}`).join("; ");
    throw new ValidationError(`Schema validation failed: ${errorDetails}`, result.error.errors);
  }

  const parsedDoc = result.data as CraftDagDocument;

  // Check for duplicate node IDs
  const nodeIds = new Set<string>();
  for (const node of parsedDoc.nodes) {
    if (nodeIds.has(node.id)) {
      throw new ValidationError(`Duplicate node ID found: "${node.id}"`);
    }
    nodeIds.add(node.id);
  }

  // Check that input references point to existing nodes
  for (const node of parsedDoc.nodes) {
    if (node.inputs) {
      for (const input of node.inputs) {
        if (!nodeIds.has(input.ref)) {
          throw new ValidationError(`Node "${node.id}" references non-existent node: "${input.ref}"`);
        }
      }
    }
  }

  return parsedDoc;
}
