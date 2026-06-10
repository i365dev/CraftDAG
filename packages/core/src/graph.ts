import { GraphError } from "./errors.js";
import { CraftDagDocument, CraftDagNode } from "./types.js";

/**
 * Sorts the nodes of a CraftDAG document topologically based on their dependencies.
 * If a cycle is detected, throws a GraphError.
 */
export function sortNodes(doc: CraftDagDocument): CraftDagNode[] {
  const nodes = doc.nodes;
  const nodeMap = new Map<string, CraftDagNode>();
  
  // Build node map and check for duplicate IDs (additional safeguard)
  for (const node of nodes) {
    if (nodeMap.has(node.id)) {
      throw new GraphError(`Duplicate node ID found: "${node.id}"`);
    }
    nodeMap.set(node.id, node);
  }

  // Build adjacency lists and compute in-degrees
  // A -> B means A is a dependency of B (B depends on A)
  const adj = new Map<string, string[]>();
  const inDegree = new Map<string, number>();

  for (const node of nodes) {
    inDegree.set(node.id, 0);
    adj.set(node.id, []);
  }

  for (const node of nodes) {
    if (node.inputs) {
      for (const input of node.inputs) {
        if (!nodeMap.has(input.ref)) {
          throw new GraphError(`Node "${node.id}" references non-existent node: "${input.ref}"`);
        }
        // input.ref is a dependency, so input.ref must compile before node.id
        // edge is input.ref -> node.id
        adj.get(input.ref)!.push(node.id);
        inDegree.set(node.id, inDegree.get(node.id)! + 1);
      }
    }
  }

  // Queue for nodes with in-degree 0
  const queue: string[] = [];
  for (const [id, degree] of inDegree.entries()) {
    if (degree === 0) {
      queue.push(id);
    }
  }

  // Process queue
  const sortedIds: string[] = [];
  while (queue.length > 0) {
    const u = queue.shift()!;
    sortedIds.push(u);

    const neighbors = adj.get(u) || [];
    for (const v of neighbors) {
      const newDegree = inDegree.get(v)! - 1;
      inDegree.set(v, newDegree);
      if (newDegree === 0) {
        queue.push(v);
      }
    }
  }

  // If sortedIds doesn't contain all nodes, there's a cycle
  if (sortedIds.length !== nodes.length) {
    const cycleNodeIds = nodes
      .map(n => n.id)
      .filter(id => inDegree.get(id)! > 0);
    throw new GraphError(
      `Dependency cycle detected in building plan among nodes: ${cycleNodeIds.join(", ")}`
    );
  }

  // Map sorted IDs back to nodes
  return sortedIds.map(id => nodeMap.get(id)!);
}
