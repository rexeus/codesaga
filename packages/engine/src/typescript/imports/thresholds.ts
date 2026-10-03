// Owns the constants of the import structure that the report states as `thresholds.typescript.imports`.

/** Where an import edge toward a less stable territory is worth listing. */
export const IMPORT_THRESHOLDS = {
  instabilityGap: 0.3,
  minEdges: 5,
} as const;
