import { Generator, TypeDefinition } from "./generator.ts";

const generator = new Generator();

generator.addTemplate("./serialize-cpp.hbr", "hpp");
generator.addTemplate("./serialize-ts.hbr", "ts");

const BarDefinition: TypeDefinition = {
  name: "Bar",
  members: [
    { name: "name", type: "string", default: '""' },
    { name: "id", type: "uint8|string", default: "{ type: 0, value: 0 }" },
    { name: "foo", type: "Foo", default: "new Foo()" },
    { name: "values", type: ["Foo|uint8|uint16"], default: "[]" },
  ],
};

const FooDefinition: TypeDefinition = {
  name: "Foo",
  members: [
    { name: "name", type: "string", default: '""' },
    { name: "id", type: "uint16", default: "0" },
    { name: "values", type: ["uint8"], default: "[]" },
  ],
};

generator.generateFiles(BarDefinition);
generator.generateFiles(FooDefinition);
