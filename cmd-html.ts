import * as epub from "./lib-epub";
import * as fs from "fs";

export const html = async (args: string[]) => {
  const path = args[0];
  console.log({ path });

  const data = fs.readFileSync(path);
  const book = await epub.load(data);
  const chapters = book.chapters();
  const n = chapters.length;
  const chaptersHTML = [];

  const cover = await book.cover();
  if (cover) {
    chaptersHTML.push(
      `<img src="data:${cover.type};base64,${await cover.b64()}" alt="cover">`
    );
  }

  function setProgress(i) {
    process.stderr.write(`${i}/${n}\n`);
  }
  for (let i = 0; i < n; i++) {
    setProgress(i);
    const c = chapters[i];
    let { html, errors } = await c.html();
    errors.forEach(console.error);
    html = html.replace(/id="/g, `id="${c.path()}#`);
    html = `<a id="${c.path()}"></a>` + html;
    chaptersHTML.push(html);
    setProgress(i + 1);
  }
  let lang = book.language();
  if (lang == "eng") {
    lang = "en";
  }
  const css = await book.stylesheet();
  const content = chaptersHTML.join("");
  process.stdout.write(
    `<!DOCTYPE html><html lang=""><head><style>${css}</style></head><body>${content}</body></html>`
  );
  return 0;
};
