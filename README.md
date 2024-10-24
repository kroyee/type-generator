## Simple type generator

Uses handlebars to generate types for multiple languages from a common definition.

Currently two pre-written templates for types with serialization in TypeScript and C++ exists.

Handles basic types like

- uint8
- uint16
- uint32
- float
- string
- arrays (`std::vector` in c++)
- variants (`std::variant` in c++, in TS represented as `{ type: number, value: string | number }`)

Your custom types can reference each other.

Short example:

```ts
const BarDefinition: TypeDefinition = {
  name: "Bar",
  members: [
    { name: "name", type: "string" },
    { name: "id", type: "uint8|string" }, // variant<uint8 | string>
    { name: "foo", type: "Foo" }, // custom type
    { name: "values", type: ["Foo|uint8|uint16"] }, // array<variant<Foo|uint8|uint16>>
  ],
};

const FooDefinition: TypeDefinition = {
  name: "Foo",
  members: [
    { name: "name", type: "string" },
    { name: "id", type: "uint16" },
    { name: "values", type: ["uint8"] }, // array<uint8>
  ],
};
```

### Known limitations:

No nested arrays or variant

This means no `array<array<uint8>>` or `variant<uint8|variant<string|float>>`

Keep it simple.

## How to run

Requires deno.

Update the type definitions in main.ts and run `deno task generate`

You can run this with node/npm if you want, requires transpiling.
