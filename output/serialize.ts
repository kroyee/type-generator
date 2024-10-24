export type StrictArrayBuffer = ArrayBuffer & { buffer?: undefined };

const TYPE_FLOAT = 0;
const TYPE_UINT32 = 1;
const TYPE_INT32 = 2;
const POW_2_32 = 2 ** 32;

export interface Ser {
  index: number;
  buffer: ArrayBuffer;
  view: DataView;
  reset: () => void;
  getBuffer: () => StrictArrayBuffer;
  serializeBoolean: (b: boolean) => void;
  serializeUInt8: (n: number) => void;
  serializeUInt16: (n: number) => void;
  serializeUInt32: (n: number) => void;
  serializeFloat32: (n: number) => void;
  serializeNumber: (n: number) => void;
  serializeString: (str: string) => void;
  serializeArray: <T>(arr: T[], serialize: (ser: Ser, t: T) => void) => void;
  serializeIterable: <T>(
    iterable: Iterable<T>,
    serialize: (ser: Ser, t: T) => void
  ) => void;
  unsafeSerializeUint32Array: (buffer: Uint32Array) => void;
}
export interface Des {
  index: number;
  buffer: StrictArrayBuffer;
  view: DataView;
  setBuffer: (
    buffer: StrictArrayBuffer,
    byteOffset?: number,
    byteLength?: number
  ) => void;
  deserializeBoolean: () => boolean;
  deserializeUInt8: () => number;
  deserializeUInt16: () => number;
  deserializeUInt32: () => number;
  deserializeFloat32: () => number;
  deserializeNumber: () => number;
  deserializeString: () => string;
  deserializeArray: <T>(deserialize: (des: Des) => T) => T[];
  deserializeIterable: <T>(deserialize: (des: Des) => T) => Iterable<T>;
  unsafeDeserializeUint32Array: () => Uint32Array;
}

interface CreateSerOption {
  bufferSize?: number;
}
export function createSer({ bufferSize }: CreateSerOption = {}): Ser {
  const size = bufferSize ?? 2 ** 24;
  if (size >= POW_2_32) {
    throw new Error("bufferSize option must be strictly less than 2 ** 32");
  }

  const buffer = new ArrayBuffer(size);
  return {
    index: 0,
    buffer,
    view: new DataView(buffer),
    reset: function () {
      this.index = 0;
    },
    serializeBoolean,
    serializeUInt8,
    serializeUInt16,
    serializeUInt32,
    serializeFloat32,
    serializeNumber,
    serializeString,
    serializeArray,
    serializeIterable,
    unsafeSerializeUint32Array,
    getBuffer: function () {
      return this.buffer.slice(0, this.index * 4);
    },
  };
}

export function createDes(buffer: StrictArrayBuffer): Des {
  return {
    index: 0,
    buffer,
    view: new DataView(buffer),
    setBuffer: function (
      buffer: StrictArrayBuffer,
      byteOffset?: number,
      byteLength?: number
    ) {
      if (typeof byteOffset === "number" && typeof byteLength === "number") {
        this.index = byteOffset;

        this.buffer = buffer;
        this.view = new DataView(buffer);

        return;
      }

      this.buffer = buffer;
      this.index = 0;
      this.view = new DataView(buffer);
    },
    deserializeBoolean,
    deserializeUInt8,
    deserializeUInt16,
    deserializeUInt32,
    deserializeFloat32,
    deserializeNumber,
    deserializeString,
    deserializeArray,
    deserializeIterable,
    unsafeDeserializeUint32Array,
  };
}

function serializeBoolean(this: Ser, b: boolean): void {
  this.view.setUint8(this.index++, b ? 1 : 0);
}
function deserializeBoolean(this: Ser): boolean {
  return this.view.getUint8(this.index++) === 1;
}

function serializeUInt8(this: Ser, n: number): void {
  this.view.setUint8(this.index++, n);
}
function deserializeUInt8(this: Des): number {
  return this.view.getUint8(this.index++);
}
function serializeUInt16(this: Ser, n: number): void {
  this.view.setUint16(this.index, n);
  this.index += 2;
}
function deserializeUInt16(this: Des): number {
  this.index += 2;
  return this.view.getUint16(this.index - 2);
}
function serializeUInt32(this: Ser, n: number): void {
  this.view.setUint32(this.index, n);
  this.index += 4;
}
function deserializeUInt32(this: Des): number {
  this.index += 4;
  return this.view.getUint32(this.index - 4);
}
function serializeFloat32(this: Ser, n: number): void {
  this.view.setFloat32(this.index, n);
  this.index += 4;
}
function deserializeFloat32(this: Des): number {
  this.index += 4;
  return this.view.getFloat32(this.index - 4);
}
function serializeNumber(this: Ser, n: number): void {
  // If it's not an integer
  if (n % 1 !== 0) {
    this.serializeUInt8(TYPE_FLOAT);
    this.serializeFloat32(n);
  } else if (n >= 0) {
    this.serializeUInt8(TYPE_UINT32);
    this.serializeUInt32(n);
  } else {
    this.serializeUInt8(TYPE_INT32);
    this.serializeUInt32(POW_2_32 + n);
  }
}
function deserializeNumber(this: Des): number {
  const type = this.deserializeUInt8();
  if (type === TYPE_FLOAT) {
    return this.deserializeFloat32();
  } else if (type === TYPE_UINT32) {
    return this.deserializeUInt32();
  } else if (type === TYPE_INT32) {
    return this.deserializeUInt32() - POW_2_32;
  } else {
    throw new Error("Unknown type");
  }
}

const textEncoder = new TextEncoder();
function serializeString(this: Ser, str: string): void {
  const r = textEncoder.encodeInto(
    str,
    new Uint8Array(this.buffer, this.index + 2)
  );
  this.serializeUInt16(r.written);
  this.index += r.written;
}

const textDecoder = new TextDecoder();
function deserializeString(this: Des): string {
  const len = this.deserializeUInt16();
  const decoded = textDecoder.decode(
    new Uint8Array(this.buffer, this.index, len)
  );
  this.index += len;
  return decoded;
}

function serializeArray<T>(
  this: Ser,
  arr: T[],
  serialize: (ser: Ser, t: T) => void
): void {
  const len = arr.length;
  this.serializeUInt16(len);
  for (let i = 0; i < len; i++) {
    serialize(this, arr[i]);
  }
}
function deserializeArray<T>(this: Des, deserialize: (ser: Des) => T): T[] {
  const len = this.deserializeUInt16();
  const arr = new Array(len);
  for (let i = 0; i < len; i++) {
    arr[i] = deserialize(this);
  }
  return arr;
}

function serializeIterable<T>(
  this: Ser,
  iterable: Iterable<T>,
  serialize: (ser: Ser, t: T) => void
): void {
  // Keep space for the length
  const currentIndex = this.index;
  this.index += 2;
  let n = 0;
  for (const t of iterable) {
    n++;
    serialize(this, t);
  }
  this.view.setUint16(currentIndex, n);
}
function deserializeIterable<T>(
  this: Des,
  deserialize: (des: Des) => T
): Iterable<T> {
  const len = this.deserializeUInt16();
  const aGeneratorObject = (function* (des) {
    for (let i = 0; i < len; i++) {
      yield deserialize(des);
    }
  })(this);

  return {
    [Symbol.iterator]() {
      return aGeneratorObject;
    },
  };
}

function unsafeSerializeUint32Array(this: Ser, arr: Uint32Array): void {
  const length = Math.ceil(arr.byteLength / 4);
  this.serializeUInt16(length);
  const buffArr = new Uint32Array(this.buffer, this.index);
  buffArr.set(arr, this.index);
  this.index += length * 4;
}
function unsafeDeserializeUint32Array(this: Des): Uint32Array {
  const byteLength = this.deserializeUInt16();
  const d = new Uint32Array(this.buffer, this.index, byteLength);
  this.index += byteLength;
  return d;
}
