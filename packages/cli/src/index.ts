#!/usr/bin/env node
import fs from "fs";
import path from "path";
import { Command } from "commander";
import {
  analyzeComponentPlanSupport,
  compileComponentPlan,
  validateDocument,
  compileDocument,
  diagnosticsFromError,
  expandComponentPlan,
  generateMaterialList,
  generateLayerGuide,
  stringifyBlockState,
  validateComponentPlan,
} from "@i365dev/craftdag-core";
import { exportToSchematic } from "@i365dev/craftdag-exporter-schem";

const program = new Command();

program
  .name("craftdag")
  .description("CraftDAG CLI for Minecraft build-plan compilation and validation")
  .version("0.1.0");

function readJsonFile(filePath: string): any {
  const absolutePath = path.resolve(filePath);
  if (!fs.existsSync(absolutePath)) {
    console.error(`Error: File does not exist at ${absolutePath}`);
    process.exit(1);
  }
  try {
    const content = fs.readFileSync(absolutePath, "utf-8");
    return JSON.parse(content);
  } catch (err: any) {
    console.error(`Error parsing JSON file: ${err.message}`);
    process.exit(1);
  }
}

function writeJson(value: unknown, outPath?: string): void {
  const outputJson = JSON.stringify(value, null, 2);
  if (outPath) {
    fs.writeFileSync(path.resolve(outPath), outputJson, "utf-8");
  } else {
    console.log(outputJson);
  }
}

function writeJsonError(error: unknown): void {
  console.error(JSON.stringify({
    ok: false,
    diagnostics: diagnosticsFromError(error),
  }, null, 2));
}

function formatMaterials(plan: ReturnType<typeof compileDocument>): string {
  const materials = generateMaterialList(plan);
  const lines = [
    `Material List for "${plan.name}":`,
    "========================================",
  ];
  for (const item of materials) {
    const blockStr = stringifyBlockState(item.block);
    lines.push(`${blockStr.padEnd(40)} : ${item.count}`);
  }
  return lines.join("\n");
}

function formatLayers(plan: ReturnType<typeof compileDocument>): string {
  const layers = generateLayerGuide(plan);
  const lines = [
    `Layer-by-Layer Guide for "${plan.name}":`,
    "========================================",
  ];
  for (const layer of layers) {
    lines.push(`Layer Y = ${layer.y} (${layer.blocks.length} blocks):`);
    const layerBlockCounts = new Map<string, number>();
    for (const blockObj of layer.blocks) {
      const key = stringifyBlockState(blockObj.block);
      layerBlockCounts.set(key, (layerBlockCounts.get(key) || 0) + 1);
    }
    for (const [blockStr, count] of layerBlockCounts) {
      lines.push(`  - ${count}x ${blockStr}`);
    }
  }
  return lines.join("\n");
}

program
  .command("validate")
  .description("Validate a CraftDAG building plan JSON file")
  .argument("<file>", "path to the CraftDAG JSON file")
  .action((file) => {
    const doc = readJsonFile(file);
    try {
      validateDocument(doc);
      console.log("✓ Document is valid!");
    } catch (err: any) {
      console.error(`✗ Validation error: ${err.message}`);
      process.exit(1);
    }
  });

program
  .command("compile")
  .description("Compile a CraftDAG plan into a VoxelPlan JSON")
  .argument("<file>", "path to the CraftDAG JSON file")
  .option("-o, --output <outputFile>", "write output to file instead of stdout")
  .action((file, options) => {
    const doc = readJsonFile(file);
    try {
      const plan = compileDocument(doc);
      const outputJson = JSON.stringify(plan, null, 2);
      if (options.output) {
        fs.writeFileSync(path.resolve(options.output), outputJson, "utf-8");
        console.log(`✓ Compiled voxel plan saved to ${options.output}`);
      } else {
        console.log(outputJson);
      }
    } catch (err: any) {
      console.error(`✗ Compilation error: ${err.message}`);
      process.exit(1);
    }
  });

program
  .command("materials")
  .description("List materials and counts for a CraftDAG building plan")
  .argument("<file>", "path to the CraftDAG JSON file")
  .action((file) => {
    const doc = readJsonFile(file);
    try {
      const plan = compileDocument(doc);
      console.log(formatMaterials(plan));
    } catch (err: any) {
      console.error(`✗ Error: ${err.message}`);
      process.exit(1);
    }
  });

program
  .command("layers")
  .description("Print the layer-by-layer building guide")
  .argument("<file>", "path to the CraftDAG JSON file")
  .action((file) => {
    const doc = readJsonFile(file);
    try {
      const plan = compileDocument(doc);
      console.log(formatLayers(plan));
    } catch (err: any) {
      console.error(`✗ Error: ${err.message}`);
      process.exit(1);
    }
  });

const component = program
  .command("component")
  .description("Validate, expand, compile, and inspect ComponentPlan JSON files");

component
  .command("validate")
  .description("Validate a ComponentPlan JSON file")
  .argument("<file>", "path to the ComponentPlan JSON file")
  .option("--json", "emit machine-readable JSON")
  .action((file, options) => {
    const doc = readJsonFile(file);
    try {
      validateComponentPlan(doc);
      if (options.json) {
        writeJson({ ok: true, diagnostics: [] });
      } else {
        console.log("✓ ComponentPlan is valid!");
      }
    } catch (err: any) {
      if (options.json) {
        writeJsonError(err);
      } else {
        console.error(`✗ ComponentPlan validation error: ${err.message}`);
      }
      process.exit(1);
    }
  });

component
  .command("expand")
  .description("Expand a ComponentPlan into low-level CraftDAG JSON")
  .argument("<file>", "path to the ComponentPlan JSON file")
  .option("-o, --out <outputFile>", "write output to file instead of stdout")
  .action((file, options) => {
    const doc = readJsonFile(file);
    try {
      writeJson(expandComponentPlan(doc), options.out);
    } catch (err: any) {
      writeJsonError(err);
      process.exit(1);
    }
  });

component
  .command("compile")
  .description("Compile a ComponentPlan into a VoxelPlan JSON")
  .argument("<file>", "path to the ComponentPlan JSON file")
  .option("-o, --out <outputFile>", "write output to file instead of stdout")
  .action((file, options) => {
    const doc = readJsonFile(file);
    try {
      writeJson(compileComponentPlan(doc), options.out);
    } catch (err: any) {
      writeJsonError(err);
      process.exit(1);
    }
  });

component
  .command("materials")
  .description("List materials and counts for a ComponentPlan")
  .argument("<file>", "path to the ComponentPlan JSON file")
  .option("--json", "emit machine-readable JSON")
  .action((file, options) => {
    const doc = readJsonFile(file);
    try {
      const plan = compileComponentPlan(doc);
      if (options.json) {
        writeJson({
          ok: true,
          name: plan.name,
          materials: generateMaterialList(plan),
        });
      } else {
        console.log(formatMaterials(plan));
      }
    } catch (err: any) {
      if (options.json) {
        writeJsonError(err);
      } else {
        console.error(`✗ ComponentPlan materials error: ${err.message}`);
      }
      process.exit(1);
    }
  });

component
  .command("layers")
  .description("Print the layer-by-layer building guide for a ComponentPlan")
  .argument("<file>", "path to the ComponentPlan JSON file")
  .option("--json", "emit machine-readable JSON")
  .action((file, options) => {
    const doc = readJsonFile(file);
    try {
      const plan = compileComponentPlan(doc);
      if (options.json) {
        writeJson({
          ok: true,
          name: plan.name,
          layers: generateLayerGuide(plan),
        });
      } else {
        console.log(formatLayers(plan));
      }
    } catch (err: any) {
      if (options.json) {
        writeJsonError(err);
      } else {
        console.error(`✗ ComponentPlan layers error: ${err.message}`);
      }
      process.exit(1);
    }
  });

component
  .command("support")
  .description("Analyze ComponentPlan support diagnostics")
  .argument("<file>", "path to the ComponentPlan JSON file")
  .option("--json", "emit machine-readable JSON")
  .option("--include-allowed", "include diagnostics allowed by structural intent")
  .action((file, options) => {
    const doc = readJsonFile(file);
    try {
      const result = analyzeComponentPlanSupport(doc, { includeAllowed: options.includeAllowed });
      if (options.json) {
        writeJson({ ok: true, ...result });
      } else {
        console.log(`Support diagnostics: ${result.diagnostics.length}`);
        console.log(`Total blocks: ${result.totalBlocks}`);
        console.log(`Vertical unsupported blocks: ${result.verticalUnsupportedBlocks}`);
        console.log(`Disconnected blocks: ${result.disconnectedBlocks}`);
        console.log(`Large cantilever blocks: ${result.largeCantileverBlocks}`);
      }
    } catch (err: any) {
      if (options.json) {
        writeJsonError(err);
      } else {
        console.error(`✗ ComponentPlan support error: ${err.message}`);
      }
      process.exit(1);
    }
  });

component
  .command("export")
  .description("Export a ComponentPlan to Sponge schematic (.schem) format")
  .argument("<file>", "path to the ComponentPlan JSON file")
  .option("-f, --format <format>", "export format (default: schem)", "schem")
  .requiredOption("-o, --out <outputFile>", "path to save the exported file")
  .option("--data-version <number>", "Minecraft DataVersion", "3463")
  .action((file, options) => {
    const doc = readJsonFile(file);
    try {
      if (options.format !== "schem") {
        throw new Error(`Unsupported export format: ${options.format}`);
      }
      const plan = compileComponentPlan(doc);
      const dataVersion = options.dataVersion ? Number(options.dataVersion) : undefined;
      const buffer = exportToSchematic(plan, { dataVersion });
      fs.writeFileSync(path.resolve(options.out), buffer);
      console.log(`✓ Sponge schematic exported successfully to ${options.out}`);
    } catch (err: any) {
      writeJsonError(err);
      process.exit(1);
    }
  });

program
  .command("export")
  .description("Export a CraftDAG plan to Sponge schematic (.schem) format")
  .argument("<file>", "path to the CraftDAG JSON file")
  .option("-f, --format <format>", "export format (default: schem)", "schem")
  .requiredOption("-o, --out <outputFile>", "path to save the exported file")
  .option("--data-version <number>", "Minecraft DataVersion", "3463")
  .action((file, options) => {
    const doc = readJsonFile(file);
    try {
      if (options.format !== "schem") {
        throw new Error(`Unsupported export format: ${options.format}`);
      }
      const plan = compileDocument(doc);
      const dataVersion = options.dataVersion ? Number(options.dataVersion) : undefined;
      const buffer = exportToSchematic(plan, { dataVersion });
      fs.writeFileSync(path.resolve(options.out), buffer);
      console.log(`✓ Sponge schematic exported successfully to ${options.out}`);
    } catch (err: any) {
      console.error(`✗ Export error: ${err.message}`);
      process.exit(1);
    }
  });

program.parse(process.argv);
