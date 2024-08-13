import { build } from "./cmd-build";
import { init } from "./cmd-init";
import { rename } from "./cmd-rename";

const main = async (args: string[]) => {
  if (args.length == 0) {
    console.log(
      "usage:\n\tinit <dirname>\n\tbuild <dirname>\n\trename [-d] <filepath...>"
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

main(process.argv.slice(2)).then((x) => {
  process.exit(x || 1);
});
