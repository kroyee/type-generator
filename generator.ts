import { compile, Member } from "./handlebars.ts";

export type TypeDefinition = {
  name: string;
  members: Member[];
};

export type IncludesAndImports = {
  stdincludes: string[];
  includes: string[];
  imports: string[];
};

export type TypeDefinitionWithIncludes = TypeDefinition & IncludesAndImports;

type TemplateData = {
  template: HandlebarsTemplateDelegate;
  fileEnding: string;
  includes?: IncludesAndImportsObject;
};

type IncludesAndImportsObject = {
  stdincludes: Set<string>;
  includes: Set<string>;
  imports: Set<string>;
};

function mergeIncludesAndImportsObject(...objects: IncludesAndImportsObject[]) {
  let result: IncludesAndImportsObject = {
    stdincludes: new Set(),
    includes: new Set(),
    imports: new Set(),
  };
  for (const object of objects) {
    result = {
      stdincludes: new Set([...result.stdincludes, ...object.stdincludes]),
      includes: new Set([...result.includes, ...object.includes]),
      imports: new Set([...result.imports, ...object.imports]),
    };
  }

  return result;
}

function getIncludesAndImports(type: string): IncludesAndImportsObject {
  const result: IncludesAndImportsObject = {
    stdincludes: new Set(),
    includes: new Set(),
    imports: new Set(),
  };

  if (type.includes("|")) {
    result.stdincludes.add("variant");
    return mergeIncludesAndImportsObject(
      ...type.split("|").map((t) => getIncludesAndImports(t.trim())),
      result
    );
  }

  switch (type) {
    case "uint8":
    case "uint16":
    case "uint32":
      result.stdincludes.add("cstdint");
      break;
    case "string":
      result.stdincludes.add("string");
      break;
    case "float":
      break;
    default:
      result.includes.add(`${type}.hpp`);
      result.imports.add(type);
  }

  return result;
}

function addIncludesAndImports(
  definition: TypeDefinition,
  always?: IncludesAndImportsObject
): TypeDefinitionWithIncludes {
  const allTypes = definition.members.map((member) => {
    if (typeof member.type === "string") {
      return getIncludesAndImports(member.type);
    }
    const result = getIncludesAndImports(member.type[0]);
    result.stdincludes.add("vector");
    return result;
  });

  const merged = always
    ? mergeIncludesAndImportsObject(always, ...allTypes)
    : mergeIncludesAndImportsObject(...allTypes);

  return {
    ...definition,
    includes: Array.from(merged.includes),
    stdincludes: Array.from(merged.stdincludes),
    imports: Array.from(merged.imports),
  };
}

export class Generator {
  templateData: TemplateData[] = [];
  outputLocation = "./output";

  addTemplate(
    filename: string,
    fileEnding: string,
    includes?: IncludesAndImports
  ) {
    const text = Deno.readTextFileSync(filename);
    this.templateData.push({
      template: compile(text),
      fileEnding,
      includes: includes && {
        includes: new Set([...includes.includes]),
        stdincludes: new Set([...includes.stdincludes]),
        imports: new Set([...includes.imports]),
      },
    });
  }

  setOutputLocation(location: string) {
    this.outputLocation = location;
  }

  generateFiles(definition: TypeDefinition) {
    for (const data of this.templateData) {
      const output = data.template(
        addIncludesAndImports(definition, data.includes)
      );

      try {
        Deno.mkdirSync(this.outputLocation);
      } catch (_err) {
        // directory already exists
      }

      Deno.writeTextFileSync(
        `${this.outputLocation}/${definition.name}.${data.fileEnding}`,
        output
      );
    }
  }
}
