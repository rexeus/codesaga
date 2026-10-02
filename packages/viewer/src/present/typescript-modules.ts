import { formatShare } from "./code-stats.js";
import { formatCount, formatNoun, formatPercent } from "./format.js";
import type { TypeScriptDeepDive } from "./typescript-summary.js";

type Modules = NonNullable<TypeScriptDeepDive["modules"]>;

/** A part of the files, by the module system they use. */
export type ModuleSegment = {
  readonly label: string;
  readonly files: number;
  readonly entity: string;
};

/**
 * The parsed files split by module system: ES modules only, both systems,
 * CommonJS only, and neither (a script with no import and no export). Empty
 * parts are left out, and the parts add up to the files.
 */
export const moduleSegments = ({
  files,
  esmFiles,
  commonjsFiles,
  bothFiles,
}: Modules): ModuleSegment[] => {
  const esmOnly = esmFiles - bothFiles;
  const cjsOnly = commonjsFiles - bothFiles;
  const neither = files - esmOnly - cjsOnly - bothFiles;
  return [
    { label: "ES modules", files: esmOnly, entity: "slot-1" },
    { label: "Both", files: bothFiles, entity: "slot-3" },
    { label: "CommonJS", files: cjsOnly, entity: "slot-2" },
    { label: "Neither", files: neither, entity: "slot-other" },
  ].filter((segment) => segment.files > 0);
};

/** A kind of syntax Node's type stripping cannot erase, with how often the code uses it. */
type NonErasableRow = { readonly label: string; readonly count: string };

/** The facts of the module card besides the bar. */
export type ModulesView = {
  /** `98% ES modules`, in the headline of the folded card. */
  readonly teaser: string;
  readonly importLine: string;
  readonly packageLine: string;
  readonly nonErasableLine: string;
  readonly nonErasable: readonly NonErasableRow[];
};

const nonErasableLine = ({ files, nonErasable }: Modules): string =>
  nonErasable.files === 0
    ? "No file uses syntax that Node's type stripping cannot erase: the TypeScript could run unbuilt."
    : `${formatCount(nonErasable.files)} of ${formatNoun(files, "file")} use syntax that Node's type stripping cannot erase, so they need a build step.`;

const packageLine = ({ packageTypes }: Modules): string => {
  const { module, commonjs, unspecified } = packageTypes;
  if (module + commonjs + unspecified === 0) {
    return "No package.json was read.";
  }
  return `package.json "type": ${formatCount(module)} module, ${formatCount(commonjs)} commonjs, ${formatCount(unspecified)} unspecified (read as CommonJS).`;
};

/** The words and rows around the module bar. */
export const modulesView = (modules: Modules): ModulesView => {
  const { files, esmFiles, imports, nonErasable } = modules;
  return {
    teaser: `${formatShare(esmFiles, files)} of files are ES modules`,
    importLine:
      imports.declarations === 0
        ? "No import declaration binds anything."
        : `${formatPercent(imports.typeOnly / imports.declarations)} of ${formatNoun(imports.declarations, "import")} bind only types.`,
    packageLine: packageLine(modules),
    nonErasableLine: nonErasableLine(modules),
    nonErasable: [
      { label: "Enums", count: formatCount(nonErasable.enums) },
      {
        label: "Namespaces with code",
        count: formatCount(nonErasable.namespaces),
      },
      {
        label: "Parameter properties",
        count: formatCount(nonErasable.parameterProperties),
      },
      { label: "Decorators", count: formatCount(nonErasable.decorators) },
    ],
  };
};
