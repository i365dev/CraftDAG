export type DiagnosticSeverity = "error" | "warning";

export interface Diagnostic {
  severity: DiagnosticSeverity;
  stage: string;
  code: string;
  message: string;
  path?: string;
  componentId?: string;
  sectionId?: string;
  assemblyId?: string;
  instanceId?: string;
  sourceNodeId?: string;
  availableRefs?: string[];
  repairHint?: string;
}

export class CraftDagError extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class ValidationError extends CraftDagError {
  constructor(message: string, public readonly details?: any) {
    super(message);
  }
}

export class GraphError extends CraftDagError {
  constructor(message: string, public readonly details?: any) {
    super(message);
  }
}

export class CompileError extends CraftDagError {
  constructor(message: string, public readonly details?: any) {
    super(message);
  }
}

function isDiagnosticLike(value: unknown): value is Partial<Diagnostic> & { message?: string } {
  return typeof value === "object" && value !== null;
}

export function diagnosticsFromError(error: unknown): Diagnostic[] {
  if (
    error instanceof ValidationError ||
    error instanceof GraphError ||
    error instanceof CompileError
  ) {
    if (Array.isArray(error.details)) {
      return error.details.map((detail) => normalizeDiagnostic(detail, error.message));
    }
    return [normalizeDiagnostic(error.details, error.message)];
  }

  if (error instanceof Error) {
    return [{
      severity: "error",
      stage: "unknown",
      code: "UNKNOWN_ERROR",
      message: error.message,
    }];
  }

  return [{
    severity: "error",
    stage: "unknown",
    code: "UNKNOWN_ERROR",
    message: String(error),
  }];
}

function normalizeDiagnostic(detail: unknown, fallbackMessage: string): Diagnostic {
  if (!isDiagnosticLike(detail)) {
    return {
      severity: "error",
      stage: "unknown",
      code: "UNKNOWN_ERROR",
      message: fallbackMessage,
    };
  }

  return {
    severity: detail.severity === "warning" ? "warning" : "error",
    stage: typeof detail.stage === "string" ? detail.stage : "unknown",
    code: typeof detail.code === "string" ? detail.code : "UNKNOWN_ERROR",
    message: typeof detail.message === "string" ? detail.message : fallbackMessage,
    path: normalizeDiagnosticPath(detail.path),
    componentId: typeof detail.componentId === "string" ? detail.componentId : undefined,
    sectionId: typeof detail.sectionId === "string" ? detail.sectionId : undefined,
    assemblyId: typeof detail.assemblyId === "string" ? detail.assemblyId : undefined,
    instanceId: typeof detail.instanceId === "string" ? detail.instanceId : undefined,
    sourceNodeId: typeof detail.sourceNodeId === "string" ? detail.sourceNodeId : undefined,
    availableRefs: Array.isArray(detail.availableRefs) ? detail.availableRefs.filter((ref) => typeof ref === "string") : undefined,
    repairHint: typeof detail.repairHint === "string" ? detail.repairHint : undefined,
  };
}

function normalizeDiagnosticPath(path: unknown): string | undefined {
  if (typeof path === "string") {
    return path;
  }

  if (Array.isArray(path)) {
    return path.map((part) => String(part)).join(".");
  }

  return undefined;
}
