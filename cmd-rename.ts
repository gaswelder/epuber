import * as fs from "fs";
import * as epub from "./lib-epub";

export const rename = async (args: string[]) => {
  let errors = 0;
  let dry = false;
  if (args[0] == "-d") {
    dry = true;
    args.shift();
  }

  for (const path of args) {
    const data = fs.readFileSync(path);
    const b = await epub.load(data);
    const title = b.title();
    const author = b.author();
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
