import { Bar } from "./output/Bar.ts";
import { Foo } from "./output/Foo.ts";
import { createDes, createSer } from "./output/serialize.ts";

const bar = new Bar();
bar.id = { type: 0, value: 17 };
bar.name = "MrCool";
bar.foo = new Foo();

bar.foo.id = 12;
bar.foo.name = "Single foo";
bar.foo.values = [1, 2, 3, 4, 6];

bar.values = [
  { type: 1, value: 2 },
  { type: 1, value: 7 },
  { type: 0, value: new Foo() },
];

const innerFoo = bar.values[2].value as Foo;

innerFoo.id = 33;
innerFoo.name = "Inner foo";
innerFoo.values = [9, 8, 7];

const ser = createSer();
Bar.serialize(ser, bar);

const des = createDes(ser.getBuffer());

const bar2 = Bar.deserialize(des);

console.log("Started with bar1:", bar);
console.log("Inner foo was", bar.values[2].value);
console.log("Ended with bar2:", bar2);
console.log("Inner foo was", bar2.values[2].value);
