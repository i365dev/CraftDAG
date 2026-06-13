# CraftDAG

CraftDAG is an open building-plan DSL and compiler for Minecraft-oriented construction workflows.

It turns structured building primitives into voxel plans, layer guides, material lists, and exportable structure files.

CraftDAG is the open core engine behind MinePilot.

## Mental model

```text
Natural language idea
→ ComponentPlan
→ CraftDAG building plan
→ schema validation
→ graph validation
→ voxel compilation
→ preview / material list / layer guide / file output / future executor
```

CraftDAG is not a general Minecraft agent. It is a deterministic build-plan engine.

ComponentPlan is the recommended authoring layer for LLMs and agents. CraftDAG is the lower-level compiler IR that ComponentPlan expands into.

## Key docs

Start here:

- [Project Brief](docs/PROJECT_BRIEF.md)
- [Implementation Plan](docs/IMPLEMENTATION_PLAN.md)
- [ComponentPlan v0.1 Spec](docs/COMPONENT_PLAN_SPEC.md)
- [LLM Authoring Contract](docs/LLM_AUTHORING_CONTRACT.md)

## Relationship with MinePilot

```text
CraftDAG = open core engine
MinePilot = user-facing app and playground
```

MinePilot should consume CraftDAG. CraftDAG should not depend on MinePilot.

## Early non-goals

- no live Minecraft bot
- no survival automation
- no redstone generation
- no Bedrock support
- no large city generation
- no free-form JavaScript execution

## Initial goal

The first useful version should validate and compile small, bounded Minecraft build plans into Voxel Plans, material lists, and layer guides.
