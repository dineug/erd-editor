import { observable, observer, watch } from "@/core/observable";

const data = observable({ a: 1, b: 2 });

observer(() => {
  console.log(data.a);
});

watch(data, propName => {
  console.log(propName);
});

data.a = 2;
data.a = 3;
