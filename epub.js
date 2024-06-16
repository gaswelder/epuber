const fs = require("fs");
const child_process = require("child_process");
const epub = require("/home/gas/code/pub/epub-reader/epub/epub.bin");

const main = (args) => {
  if (args.length == 0) {
    console.log(
      "usage:\n\tepub init <dirname>\n\tepub build <dirname>\n\tepub rename [-d] <filepath...>"
    );
    return 1;
  }

  switch (args[0]) {
    case "init":
      return init(args.slice(1));
    case "build":
      return build(args.slice(1));
    case "rename":
      return rename(args.slice(1));
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

const rename = async (args) => {
  let errors = 0;
  let dry = false;
  if (args[0] == "-d") {
    dry = true;
    args.shift();
  }

  for (const path of args) {
    const data = fs.readFileSync(path);
    const b = await epub.load(data);
    const title = await b.title();
    const author = await b.author();
    if (!title || !author) {
      process.stderr.write(
        `couldn't get title or author (${author} ${title})\n`
      );
      errors++;
      continue;
    }
    const newname = `${author} - ${title}`.replace(/\//g, "-");
    const newpath = `${newname}.epub`;
    if (newpath == path) {
      process.stderr.write(`${path}: same\n`);
      continue;
    }
    console.log(`${path}\n->${newpath}`);
    if (!dry) {
      fs.renameSync(path, newpath);
    }
  }
};

process.exit(main(process.argv.slice(2)));
