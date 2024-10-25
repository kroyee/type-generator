import { Generator, TypeDefinition } from "./generator.ts";

const generator = new Generator();

generator.addTemplate("./serialize-cpp.hbr", "hpp");
generator.addTemplate("./serialize-ts.hbr", "ts");

const BarDefinition: TypeDefinition = {
  name: "Bar",
  members: [
    { name: "name", type: "string" },
    { name: "id", type: "uint8|string" },
    { name: "foo", type: "Foo" },
    { name: "values", type: ["Foo|uint8|uint16"] },
  ],
};

const FooDefinition: TypeDefinition = {
  name: "Foo",
  members: [
    { name: "name", type: "string" },
    { name: "id", type: "uint16" },
    { name: "values", type: ["uint8"] },
  ],
};

generator.generateFiles(BarDefinition);
generator.generateFiles(FooDefinition);
