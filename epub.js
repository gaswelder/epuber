const fs = require("fs");
const child_process = require("child_process");

const main = (args) => {
  if (args.length == 0) {
    console.log("usage:\n\tepub init <dirname>\n\tepub build <dirname>");
    return 1;
  }

  switch (args[0]) {
    case "init":
      return init(args.slice(1));
    case "build":
      return build(args.slice(1));
    default:
      console.log("unknown command: " + args[0]);
      return 1;
  }
};

const init = async (args) => {
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

const build = async (args) => {
  if (args.length != 1) {
    console.log("usage: build <dirname>");
    return 1;
  }
  const dirname = args[0];
  child_process.execFileSync("/home/gas/code/pub/epuber/venv/bin/python", [
    "/home/gas/code/pub/epuber/packer.py",
    dirname,
    dirname + ".epub",
  ]);
  return 0;
};

process.exit(main(process.argv.slice(2)));
