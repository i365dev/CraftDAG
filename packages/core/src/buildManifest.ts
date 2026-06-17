import { compileComponentPlan, validateComponentPlan } from "./componentPlan.js";
import { generateMaterialList } from "./metadata/materials.js";
import { generateLayerGuide } from "./metadata/layers.js";
import { analyzeComponentPlanSupport } from "./supportAnalysis.js";
import { ComponentPlanDocument } from "./types.js";

export interface BuildManifestDimensions {
  width: number;
  height: number;
  length: number;
}

export interface BuildManifestMaterial {
  block: { name: string; properties?: Record<string, string> };
  count: number;
}

export interface BuildManifestExport {
  schem: { available: boolean };
}

export interface BuildManifestDiagnostics {
  blocking: number;
  review: number;
  allowed: number;
  qualityGate: "pass" | "review" | "block";
}

export interface BuildManifestVerification {
  status: "compiled" | "previewed" | "verified";
  notes: string[];
}

export interface BuildManifest {
  id: string;
  title: string;
  source: "component-plan" | "imported-schematic";
  dimensions: BuildManifestDimensions;
  blockCount: number;
  materials: BuildManifestMaterial[];
  layers: { y: number; blockCount: number }[];
  exports: BuildManifestExport;
  diagnostics: BuildManifestDiagnostics;
  tags: string[];
  provenance: {
    planName: string;
    sizeTier: string;
    componentCount: number;
    assemblyCount: number;
    sectionCount: number;
  };
}

export interface BuildManifestOptions {
  tags?: string[];
}

export function generateBuildManifest(
  doc: unknown,
  options?: BuildManifestOptions
): BuildManifest {
  const plan = validateComponentPlan(doc) as ComponentPlanDocument;
  const voxelPlan = compileComponentPlan(plan);
  const materials = generateMaterialList(voxelPlan);
  const layers = generateLayerGuide(voxelPlan);
  const support = analyzeComponentPlanSupport(plan);

  const blockCount = materials.reduce((sum, m) => sum + m.count, 0);

  return {
    id: plan.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""),
    title: plan.name,
    source: "component-plan",
    dimensions: {
      width: plan.bounds.width,
      height: plan.bounds.height,
      length: plan.bounds.length,
    },
    blockCount,
    materials: materials.map((m) => ({
      block: m.block,
      count: m.count,
    })),
    layers: layers.map((l) => ({ y: l.y, blockCount: l.blocks.length })),
    exports: {
      schem: { available: true },
    },
    diagnostics: {
      blocking: support.summary.diagnostics.blockingDiagnostics,
      review: support.summary.diagnostics.reviewDiagnostics,
      allowed: support.summary.diagnostics.allowedDiagnostics,
      qualityGate: support.summary.qualityGate.status,
    },
    tags: options?.tags ?? [],
    provenance: {
      planName: plan.name,
      sizeTier: plan.policy?.sizeTier ?? "small",
      componentCount: (plan.components?.length ?? 0) + (plan.sections?.reduce((s, sec) => s + sec.components.length, 0) ?? 0),
      assemblyCount: (plan.assemblies?.length ?? 0) + (plan.sections?.reduce((s, sec) => s + (sec.assemblies?.length ?? 0), 0) ?? 0),
      sectionCount: plan.sections?.length ?? 0,
    },
  };
}
