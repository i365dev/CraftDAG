import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { objToVoxelPlan } from "../../../packages/adapter-mesh/dist/index.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const artifacts = resolve(here, "../artifacts");
const inputDir = process.argv[2] ? resolve(process.argv[2]) : artifacts;
const outDir = process.argv[3] ? resolve(process.argv[3]) : artifacts;
const cases = ["simple-house", "castle-tower", "ship", "statue", "dragon"];

for (const name of cases) {
  const obj = await readFile(resolve(inputDir, `${name}.obj`), "utf8");
  const metrics = {
    case: name,
    source: {
      bytes: Buffer.byteLength(obj),
      objectCount: (obj.match(/^o\s/gm) ?? []).length,
      triangleCount: (obj.match(/^f\s+.+$/gm) ?? []).reduce((sum, face) => sum + face.trim().split(/\s+/).length - 3, 0),
    },
    voxelization: {},
  };
  for (const voxelMode of ["surface", "solid"]) {
    const plan = objToVoxelPlan(obj, {
      targetHeight: 64,
      maxBlocks: 1_000_000,
      voxelMode,
      name: `${name} (Blender OBJ, ${voxelMode})`,
    });
    await writeFile(resolve(outDir, `${name}-${voxelMode}.json`), `${JSON.stringify(plan, null, 2)}\n`);
    metrics.voxelization[voxelMode] = { size: plan.size, blockCount: plan.blocks.length };
  }
  await writeFile(resolve(outDir, `${name}-metrics.json`), `${JSON.stringify(metrics, null, 2)}\n`);
  console.log(JSON.stringify(metrics));
}
