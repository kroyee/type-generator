import Handlebars from "handlebars";

function getVariantType(type: string) {
  return Object.keys(
    Object.fromEntries(type.split("|").map((t) => [typeTS(t), typeTS(t)]))
  ).join(" | ");
}

function typeTS(type: string | [string]): string {
  if (typeof type === "string") {
    switch (type) {
      case "string":
        return "string";
      case "uint8":
      case "uint16":
      case "uint32":
      case "float":
        return "number";
      default:
        if (type.includes("|")) {
          return `{ type: number, value: ${getVariantType(type)} }`;
        }
        return type;
    }
  }

  return `${typeTS(type[0])}[]`;
}

function typeCPP(type: string | [string]): string {
  if (typeof type === "string") {
    switch (type) {
      case "string":
        return "std::string";
      case "uint8":
        return "std::uint8_t";
      case "uint16":
        return "std::uint16_t";
      case "uint32":
        return "std::uint32_t";
      case "float":
        return "float";
      default:
        if (type.includes("|")) {
          return `std::variant<${type
            .split("|")
            .map((t) => typeCPP(t.trim()))
            .join(",")}>`;
        }
        return type;
    }
  }

  return `std::vector<${typeCPP(type[0])}>`;
}

function tsSerializeArrayElem(member: Member & { hbr_index: number }): string {
  switch (member.type) {
    case "string":
      return `ser.serializeString(t)`;
    case "uint8":
      return `ser.serializeUInt8(t)`;
    case "uint16":
      return `ser.serializeUInt16(t)`;
    case "uint32":
      return `ser.serializeUInt32(t)`;
    case "float":
      return `ser.serializeFloat32(t)`;
    default:
      if (member.type.includes("|")) {
        return `data.serializeVariant${member.hbr_index}(ser, t)`;
      }
      return `${member.type}.serialize(ser, t)`;
  }
}

function tsSerialize(member: Member & { hbr_index: number }): string {
  if (typeof member.type === "string") {
    switch (member.type) {
      case "string":
        return `ser.serializeString(data.${member.name})`;
      case "uint8":
        return `ser.serializeUInt8(data.${member.name})`;
      case "uint16":
        return `ser.serializeUInt16(data.${member.name})`;
      case "uint32":
        return `ser.serializeUInt32(data.${member.name})`;
      case "float":
        return `ser.serializeFloat32(data.${member.name})`;
      default:
        if (member.type.includes("|")) {
          return `data.serializeVariant${member.hbr_index}(ser, data.${member.name})`;
        }
        return `${member.type}.serialize(ser, data.${member.name})`;
    }
  }

  return `ser.serializeArray(data.${
    member.name
  }, (ser, t) => { ${tsSerializeArrayElem({
    ...member,
    type: member.type[0],
  })} })`;
}

function tsDeserialize(member: Member & { hbr_index: number }): string {
  if (typeof member.type === "string") {
    switch (member.type) {
      case "string":
        return `des.deserializeString()`;
      case "uint8":
        return `des.deserializeUInt8()`;
      case "uint16":
        return `des.deserializeUInt16()`;
      case "uint32":
        return `des.deserializeUInt32()`;
      case "float":
        return `des.deserializeFloat32()`;
      default:
        if (member.type.includes("|")) {
          return `data.deserializeVariant${member.hbr_index}(des)`;
        }
        return `${member.type}.deserialize(des)`;
    }
  }

  return `des.deserializeArray((des) => ${tsDeserialize({
    ...member,
    type: member.type[0],
  })})`;
}

function tsVariant(member: Member & { hbr_index: number }): string {
  const type = typeof member.type === "string" ? member.type : member.type[0];
  if (type.includes("|")) {
    const serializeVariantTypes = type.split("|").map((t, idx) => {
      switch (t.trim()) {
        case "string":
          return `case ${idx}: ser.serializeString(data.value as string)`;
        case "uint8":
          return `case ${idx}: ser.serializeUInt8(data.value as number)`;
        case "uint16":
          return `case ${idx}: ser.serializeUInt16(data.value as number)`;
        case "uint32":
          return `case ${idx}: ser.serializeUInt32(data.value as number)`;
        case "float":
          return `case ${idx}: ser.serializeFloat32(data.value as number)`;
        default:
          return `case ${idx}: ${t}.serialize(ser, data.value as ${t})`;
      }
    });

    const deserializeVariantTypes = type.split("|").map((t, idx) => {
      switch (t.trim()) {
        case "string":
          return `case ${idx}: data.value = des.deserializeString()`;
        case "uint8":
          return `case ${idx}: data.value = des.deserializeUInt8()`;
        case "uint16":
          return `case ${idx}: data.value = des.deserializeUInt16()`;
        case "uint32":
          return `case ${idx}: data.value = des.deserializeUInt32()`;
        case "float":
          return `case ${idx}: data.value = des.deserializeFloat32()`;
        default:
          return `case ${idx}: data.value = ${t}.deserialize(des)`;
      }
    });
    return `serializeVariant${
      member.hbr_index
    }(ser: Ser, data: {type: number, value: ${getVariantType(type)}}) {
  ser.serializeUInt8(data.type)
  switch (data.type) {
    ${serializeVariantTypes.join("\n    break;\n    ")}
    break;
    default:
      console.error("Invalid variant type for variant${member.hbr_index} in ${
      member.name
    }")
  }
}
    
deserializeVariant${member.hbr_index}(des: Des) {
  const data: { type: number, value: ${getVariantType(
    type as string
  )}} = { type: 0, value: 0 }
  data.type = des.deserializeUInt8()
  switch (data.type) {
    ${deserializeVariantTypes.join("\n    break;\n    ")}
    break;
    default:
      console.error("Invalid variant type for variant${member.hbr_index} in ${
      member.name
    }")
  }
  return data
}`;
  }
  return "";
}

export type Member = {
  name: string;
  type: string | [string];
  default: string;
};

let initDone = false;

export function init() {
  Handlebars.registerHelper("cpptype", typeCPP);
  Handlebars.registerHelper("tstype", typeTS);
  Handlebars.registerHelper("tsserialize", tsSerialize);
  Handlebars.registerHelper("tsdeserialize", tsDeserialize);
  Handlebars.registerHelper("tsvariant", tsVariant);

  Handlebars.registerPartial("variantpartial", "{{{tsvariant this}}}");

  Handlebars.registerHelper("eachindex", function (context, options) {
    let ret = "";

    for (let i = 0; i < context.length; i++) {
      ret = ret + options.fn({ ...context[i], hbr_index: i });
    }

    return ret;
  });
  Handlebars.registerHelper(
    "ifvariant",
    function (this: object, context, options) {
      if (typeof context.type === "string") {
        if (context.type.includes("|")) {
          return options.fn(this);
        }
      }
      if (context.type[0].includes("|")) {
        return options.fn(this);
      }
    }
  );
  initDone = true;
}

export function compile(text: string) {
  if (!initDone) {
    init();
  }

  return Handlebars.compile(text);
}
