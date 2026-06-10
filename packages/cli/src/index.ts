#!/usr/bin/env node
import fs from "fs";
import path from "path";
import { Command } from "commander";
import {
  validateDocument,
  compileDocument,
  generateMaterialList,
  generateLayerGuide,
  stringifyBlockState,
} from "@craftdag/core";
import { exportToSchematic } from "@craftdag/exporter-schem";

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
      const materials = generateMaterialList(plan);
      console.log(`Material List for "${plan.name}":`);
      console.log("========================================");
      for (const item of materials) {
        const blockStr = stringifyBlockState(item.block);
        console.log(`${blockStr.padEnd(40)} : ${item.count}`);
      }
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
      const layers = generateLayerGuide(plan);
      console.log(`Layer-by-Layer Guide for "${plan.name}":`);
      console.log("========================================");
      for (const layer of layers) {
        console.log(`Layer Y = ${layer.y} (${layer.blocks.length} blocks):`);
        // Group by block type within the layer
        const layerBlockCounts = new Map<string, number>();
        for (const blockObj of layer.blocks) {
          const key = stringifyBlockState(blockObj.block);
          layerBlockCounts.set(key, (layerBlockCounts.get(key) || 0) + 1);
        }
        for (const [blockStr, count] of layerBlockCounts) {
          console.log(`  - ${count}x ${blockStr}`);
        }
      }
    } catch (err: any) {
      console.error(`✗ Error: ${err.message}`);
      process.exit(1);
    }
  });

program
  .command("export")
  .description("Export a CraftDAG plan to Sponge schematic (.schem) format")
  .argument("<file>", "path to the CraftDAG JSON file")
  .argument("<outputFile>", "path to save the .schem file")
  .action((file, outputFile) => {
    const doc = readJsonFile(file);
    try {
      const plan = compileDocument(doc);
      const buffer = exportToSchematic(plan);
      fs.writeFileSync(path.resolve(outputFile), buffer);
      console.log(`✓ Sponge schematic exported successfully to ${outputFile}`);
    } catch (err: any) {
      console.error(`✗ Export error: ${err.message}`);
      process.exit(1);
    }
  });

program.parse(process.argv);
