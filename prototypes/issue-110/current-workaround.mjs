#!/usr/bin/env node
// Generate and compile two current-vocabulary baseline plans for the report.
import { compileComponentPlan } from "../../packages/core/dist/index.mjs";

const palette = { wall: "minecraft:stone_bricks", trim: "minecraft:stone_bricks", foundation: "minecraft:stone" };
const shell = {
  version: "0.1", name: "Current workaround: stadium-like shell",
  policy: { sizeTier: "large" },
  bounds: { width: 55, height: 10, length: 35 }, palette,
  components: [
    { id: "west_cap", type: "CircleRing", placement: { center: { x: 16, z: 17 }, y: 0, radius: 16 }, materials: { main: "minecraft:stone_bricks" }, options: { thickness: 2, height: 8, startAngle: 90, endAngle: 270 } },
    { id: "east_cap", type: "CircleRing", placement: { center: { x: 38, z: 17 }, y: 0, radius: 16 }, materials: { main: "minecraft:stone_bricks" }, options: { thickness: 2, height: 8, startAngle: 270, endAngle: 90 } },
    { id: "north_tangent_wall", type: "Beam", placement: { anchor: { x: 16, y: 0, z: 0 }, size: { width: 22, height: 8, length: 2 } } },
    { id: "south_tangent_wall", type: "Beam", placement: { anchor: { x: 16, y: 0, z: 33 }, size: { width: 22, height: 8, length: 2 } } }
  ]
};

const center = { x: 36, z: 20 }, rx = 25, rz = 13, count = 24;
const instances = [];
for (const [level, y] of [[0, 1], [1, 9]]) {
  for (let i = 0; i < count; i++) {
    const angle = 2 * Math.PI * i / count;
    const x = Math.round(center.x + rx * Math.cos(angle));
    const z = Math.round(center.z + rz * Math.sin(angle));
    instances.push({ id: `level_${level}_bay_${i}`, type: "Instance", placement: { assembly: "fixed_x_bay", anchor: { x: x - 3, y, z } } });
  }
}
const arcade = {
  version: "0.1", name: "Current workaround: manual oval arcade bays",
  policy: { sizeTier: "large" },
  bounds: { width: 72, height: 18, length: 40 }, palette,
  assemblies: [{ id: "fixed_x_bay", bounds: { width: 7, height: 6, length: 1 }, components: [
    { id: "pier_left", type: "SupportPost", placement: { anchor: { x: 0, y: 0, z: 0 }, size: { width: 1, height: 5, length: 1 } } },
    { id: "pier_right", type: "SupportPost", placement: { anchor: { x: 6, y: 0, z: 0 }, size: { width: 1, height: 5, length: 1 } } },
    { id: "lintel", type: "Beam", placement: { anchor: { x: 0, y: 5, z: 0 }, size: { width: 7, height: 1, length: 1 } } }
  ] }],
  components: instances
};

for (const [id, plan] of [["shell", shell], ["arcade", arcade]]) {
  const compiled = compileComponentPlan(plan);
  console.log(JSON.stringify({ id, authoredComponents: plan.components.length, planBytes: Buffer.byteLength(JSON.stringify(plan)), expandedBlocks: compiled.blocks.length, valid: true }));
}
