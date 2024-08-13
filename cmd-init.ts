import * as fs from "fs";

export const init = async (args: string[]) => {
  if (args.length != 1) {
    console.log("usage: init <dirname>");
    return 1;
  }
  const name = args[0];
  fs.mkdirSync(name);
  fs.mkdirSync(name + "/chapters");
  fs.writeFileSync(name + "/chapters/0.html", "<h1>Chapter 1</h1>");
  fs.writeFileSync(
    name + "/meta",
    `title = ${name}
  author = 
  language = en
  `
  );
  return 0;
};
