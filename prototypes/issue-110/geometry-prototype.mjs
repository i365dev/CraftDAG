#!/usr/bin/env node
// Deliberately isolated research prototype. It is not part of @i365dev/craftdag-core.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

function need(condition, message) {
  if (!condition) throw new Error(message);
}

function ellipseRing(spec, voxels) {
  const { center, radiusX, radiusZ, y, height, thickness } = spec;
  need(Number.isInteger(radiusX) && radiusX > 0 && Number.isInteger(radiusZ) && radiusZ > 0, "EllipseRing radii must be positive integers.");
  need(Number.isInteger(thickness) && thickness > 0 && thickness < Math.min(radiusX, radiusZ), "EllipseRing thickness must leave an interior.");
  need(Number.isInteger(height) && height > 0, "EllipseRing height must be a positive integer.");
  for (let x = Math.floor(center.x - radiusX); x <= Math.ceil(center.x + radiusX); x++) {
    for (let z = Math.floor(center.z - radiusZ); z <= Math.ceil(center.z + radiusZ); z++) {
      const outer = ((x - center.x) / radiusX) ** 2 + ((z - center.z) / radiusZ) ** 2;
      const inner = ((x - center.x) / (radiusX - thickness)) ** 2 + ((z - center.z) / (radiusZ - thickness)) ** 2;
      if (outer <= 1 && inner >= 1) {
        for (let dy = 0; dy < height; dy++) add(voxels, x, y + dy, z, spec.block ?? "stone");
      }
    }
  }
}

function pathRepeat(spec, voxels) {
  const { center, radiusX, radiusZ, y, count, startAngle = 0, endAngle = 360, closed = false, module } = spec;
  need(Number.isInteger(count) && count > 0 && count <= 256, "PathRepeat count must be 1..256.");
  need(Number.isInteger(radiusX) && radiusX > 0 && Number.isInteger(radiusZ) && radiusZ > 0, "PathRepeat ellipse radii must be positive integers.");
  need(closed ? count >= 3 : count >= 2, "A closed path needs at least 3 placements; an open path needs at least 2.");
  need(Number.isFinite(startAngle) && Number.isFinite(endAngle) && Math.abs(endAngle - startAngle) <= 360, "PathRepeat angles must span at most one turn.");
  need(!closed || Math.abs(Math.abs(endAngle - startAngle) - 360) < 1e-9, "A closed ellipse path must span exactly one turn.");
  need(module && Array.isArray(module.voxels), "PathRepeat requires a bounded voxel module.");
  const steps = closed ? count : count - 1;
  for (let i = 0; i < count; i++) {
    const angle = (startAngle + (endAngle - startAngle) * i / steps) * Math.PI / 180;
    const x = center.x + radiusX * Math.cos(angle);
    const z = center.z + radiusZ * Math.sin(angle);
    const yaw = Math.atan2(radiusZ * Math.cos(angle), -radiusX * Math.sin(angle));
    for (const p of module.voxels) {
      const rx = Math.round(p.x * Math.cos(yaw) - p.z * Math.sin(yaw));
      const rz = Math.round(p.x * Math.sin(yaw) + p.z * Math.cos(yaw));
      add(voxels, Math.round(x) + rx, y + p.y, Math.round(z) + rz, p.block ?? "stone");
    }
  }
}

function add(voxels, x, y, z, block) { voxels.set(`${x},${y},${z}`, { x, y, z, block }); }

function renderIsometric(voxels, bounds, output) {
  const points = [...voxels.values()];
  const project = ({ x, y, z }) => ({ x: (x - z) * 0.866, y: (x + z) * 0.5 - y });
  const projected = points.map((p) => ({ p, q: project(p) }));
  const minX = Math.min(...projected.map(({ q }) => q.x)), maxX = Math.max(...projected.map(({ q }) => q.x));
  const minY = Math.min(...projected.map(({ q }) => q.y)), maxY = Math.max(...projected.map(({ q }) => q.y));
  const scale = Math.min(900 / Math.max(1, maxX - minX), 650 / Math.max(1, maxY - minY));
  const color = (block) => block.includes("trim") ? "#bd8b48" : block.includes("pillar") ? "#766c60" : "#a9a79f";
  const rects = projected.sort((a, b) => (a.p.x + a.p.z + a.p.y) - (b.p.x + b.p.z + b.p.y)).map(({ p, q }) => {
    const x = 32 + (q.x - minX) * scale, y = 32 + (q.y - minY) * scale;
    return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${(scale * 0.87).toFixed(1)}" height="${(scale * 0.5).toFixed(1)}" fill="${color(p.block)}" stroke="#45423d" stroke-width="0.35"/>`;
  }).join("\n");
  const width = Math.ceil((maxX - minX) * scale + 64), height = Math.ceil((maxY - minY) * scale + 64);
  fs.writeFileSync(output, `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="#f5f2ea"/>${rects}</svg>\n`);
}

const input = process.argv[2];
need(input, "Usage: node geometry-prototype.mjs <fixture.json>");
const fixture = JSON.parse(fs.readFileSync(input, "utf8"));
const voxels = new Map();
for (const item of fixture.geometry) {
  if (item.type === "EllipseRing") ellipseRing(item, voxels);
  else if (item.type === "PathRepeat") pathRepeat(item, voxels);
  else throw new Error(`Unsupported prototype type ${item.type}`);
}
for (const { x, y, z } of voxels.values()) {
  need(x >= 0 && x < fixture.bounds.width && y >= 0 && y < fixture.bounds.height && z >= 0 && z < fixture.bounds.length,
    `OUT_OF_BOUNDS at ${x},${y},${z}; move the center inward or reduce the radii/module.`);
}
need(voxels.size <= (fixture.maxBlocks ?? 100000), `BLOCK_BUDGET_EXCEEDED: ${voxels.size}; lower count/height or shrink the ellipse.`);
const output = path.resolve(here, fixture.output);
fs.mkdirSync(path.dirname(output), { recursive: true });
renderIsometric(voxels, fixture.bounds, output);
console.log(JSON.stringify({ fixture: fixture.name, voxelCount: voxels.size, output, deterministic: true }, null, 2));
