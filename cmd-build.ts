import * as fs from "fs";
import JSZip from "jszip";
import * as path from "path";
import * as html from "./lib-html";

export const build = async (args) => {
  const projectDir = args[0];
  let output_path = "";
  if (args[1]) {
    output_path = args[1];
  } else {
    output_path = "out.epub";
  }

  const meta = parseMeta(projectDir + "/meta");
  const cover = loadCover(projectDir);
  const chapters = loadChapters(projectDir + "/chapters");
  const flat_chapters = chapters.flat(Infinity);
  const images = loadImages(projectDir);

  validate(flat_chapters);
  await output(chapters, flat_chapters, images, meta, cover, output_path);
};

const output = async (
  chapters,
  flat_chapters,
  images,
  meta,
  cover,
  output_path
) => {
  const manifest_path = "epub/content.opf";
  const files = [
    { path: "epub/style.css", content: fs.readFileSync("style.css") },
    { path: "mimetype", content: "application/epub+zip" },
    { path: "META-INF/container.xml", content: xmlContainer(manifest_path) },
    {
      path: manifest_path,
      content: xmlManifest(flat_chapters, images, meta, cover),
    },
    { path: "epub/toc.ncx", content: xmlNCX(chapters) },
  ];
  for (const chapter of flat_chapters) {
    const src = xmlChapter(chapter, meta);
    const err = validate_xml(src);
    if (err != undefined) {
      console.log(chapter, err);
    }
    files.push({ path: path.join("epub", chapter.path), content: src });
  }

  if (cover) {
    files.push(cover);
  }
  for (const f of images) {
    files.push({ path: path.join("epub", f.path), content: f.content });
  }
  await zipFiles(files, output_path);
};

const zipFiles = async (
  files: { path: string; content: any }[],
  output_path: string
) => {
  const zip = new JSZip();
  for (const f of files) {
    zip.file(f.path, f.content);
  }
  const content = await zip.generateAsync({ type: "nodebuffer" });
  fs.writeFileSync(output_path, content);
};

const escapeXML = (s) => {
  if (!s) return s;
  const args = [
    ["'", "&apos;"],
    ['"', "&quot;"],
    [">", "&gt;"],
    ["<", "&lt;"],
    ["&", "&amp;"],
  ];
  for (const [a, b] of args) {
    s = s.replace(a, b);
  }
  return s;
};

const fix_html = (s: string) => {
  const a = s.matchAll(/'&\w+;/g);
  for (const m of a) {
    const entity = m[0];
    // There's a rumor that epub readers only support the "quo, amp, apos, lt and gt quintet."
    if (["&apos;", "&quot;", "&gt;", "&lt;", "&amp;"].includes(entity)) {
      continue;
    }
    s = s.replace(entity, html.unescape(entity));
  }
  return s;
};

const xmlChapter = (chapter, meta) => {
  const content = fix_html(chapter["content"]);
  return `<?xml version="1.0" encoding="utf-8"?>
    <html
      xmlns="http://www.w3.org/1999/xhtml"
      xmlns:epub="http://www.idpf.org/2007/ops"
      lang="${meta["language"]}"
      xml:lang="${meta["language"]}"
    >
      <head>
        <title>${chapter["title"] || ""}</title>
        <link href="../style.css" rel="stylesheet" type="text/css" />
      </head>
      <body>
      ${content}
      </body>
    </html>`;
};

const xmlContainer = (manifestPath: string) => {
  return `<?xml version="1.0" encoding="utf-8"?>
    <container xmlns="urn:oasis:names:tc:opendocument:xmlns:container" version="1.0">
        <rootfiles>
            <rootfile full-path="${manifestPath}" media-type="application/oebps-package+xml"/>
        </rootfiles>
    </container>`;
};

const xmlNCX = (chapters) => {
  /*
      <navPoint id="navpoint-1" playOrder="1">
          <navLabel>
              <text>Front</text>
          </navLabel>
          <navPoint id="navpoint-1" playOrder="1">
              <navLabel>
                  <text>Front</text>
              </navLabel>
              <content src="text/title.xhtml"/>
          </navPoint>
      </navPoint>
      */
  const points = chapters.map((c) => nav_point(c)).join("\n");
  return `<?xml version="1.0" encoding="utf-8"?>
        <ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1" xml:lang="en-US">
            <head>
            </head>
            <docTitle>
                <text>Table of Contents</text>
            </docTitle>
            <navMap id="navmap">
                ${points}
            </navMap>
        </ncx>`;
};

const nav_point = (chapter) => {
  if (Array.isArray(chapter)) {
    // Assume the first subchapter is the title.
    const title = chapter[0];
    const rest = chapter.slice(1);
    const subentries = rest.map((c) => nav_point(["", c])).join("\n");
    return `<navPoint id="navpoint-${title["path"]}">
          <navLabel>
            <text>${title["title"]}</text>
          </navLabel>
          <content src="${title["path"]}"/>
          ${subentries}
        </navPoint>`;
  }

  return `<navPoint id="navpoint-${chapter["path"]}">
        <navLabel>
            <text>${chapter["title"]}</text>
        </navLabel>
        <content src="${chapter["path"]}"/>
        </navPoint>`;
};

const xmlManifest = (chapters, images, meta, cover) => {
  const files = [...chapters, ...images];
  if (cover) {
    files.push(cover);
  }

  let file_items = "";
  for (const f of files) {
    file_items += `<item href="${f["path"]}" id="${f["path"]}" media-type="${f["type"]}"/>\n`;
  }

  const itemrefs = chapters
    .map((c) => `<itemref idref="${c["path"]}"/>`)
    .join("\n");

  return `<?xml version = "1.0" encoding = "utf-8"?>
    <package
      xmlns="http://www.idpf.org/2007/opf"
      dir="ltr"
      unique-identifier="uid"
      version="3.0"
      xml:lang="${meta["language"]}">
        <metadata
            xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
            xmlns:opf="http://www.idpf.org/2007/opf"
            xmlns:dcterms="http://purl.org/dc/terms/"
            xmlns:dc="http://purl.org/dc/elements/1.1/"
            >
            <dc:title>${meta["title"]}</dc:title>
            <dc:language>${meta["language"]}</dc:language>
            <dc:creator>${meta["author"]}</dc:creator>
        </metadata>
        <manifest>
            <item href="toc.ncx" id="ncx" media-type="application/x-dtbncx+xml"/>
            <item href="style.css" id="style.css" media-type="text/css"/>
            ${file_items}
        </manifest>
        <spine toc="ncx">
            ${itemrefs}
        </spine>
        <guide>
            ${chapters
              .map(
                (c) =>
                  `<reference href="${c["path"]}" title="${escapeXML(
                    c["title"]
                  )}" type="bodymatter"/>`
              )
              .join("")}
        </guide>
    </package>`;
};

const validate = (flat_chapters: any[]) => {
  const invalid_titles = [] as any[];
  for (const c of flat_chapters) {
    const title = c["title"];
    if (title == undefined) {
      continue;
    }
    if (title.indexOf("<") != -1) {
      invalid_titles.push([title, c["path"]]);
    }
  }
  if (invalid_titles.length > 0) {
    console.log("Invalid titles:");
    for (const [title, path] of invalid_titles) {
      console.log({ title, path });
    }
    process.exit(1);
  }

  let no_titles = true;
  for (const c of flat_chapters) {
    if (c["title"] != undefined) {
      no_titles = false;
      break;
    }
  }
  if (no_titles) {
    throw new Error("The book doesn't have chapter titles");
  }
};

const parseMeta = (path) => {
  const meta = {};
  const content = fs.readFileSync(path).toString();
  for (const line0 of content.split("\n")) {
    const line = line0.trim();
    if (line == "") {
      continue;
    }
    const [k, v] = line.split("=");
    meta[k.trim()] = v.trim();
  }
  return meta;
};

const loadChapters = (dirpath) => {
  // """Reads a collection (folder) of chapters.
  // Returns a list containing chapter objects or nested lists in the case
  // of nested folders."""
  const files = [] as any[];
  const ls = fs.readdirSync(dirpath);
  for (const name of ls) {
    const path = dirpath + "/" + name;
    const s = fs.statSync(path);
    if (s.isDirectory()) {
      files.push(loadChapters(path));
    } else {
      files.push(loadChapter(path));
    }
  }
  return files;
};

const local_path = (path) => {
  return path.split("/").slice(2).join("/");
};

const mime_type = (path) => {
  const types = [
    ["jpg", "image/jpeg"],
    ["gif", "image/gif"],
    ["jpeg", "image/jpeg"],
    ["png", "image/png"],
    ["xhtml", "application/xhtml+xml"],
    ["html", "application/xhtml+xml"],
    ["htm", "application/xhtml+xml"],
  ];
  for (const [ext, t] of types) {
    if (path.endsWith("." + ext)) {
      return t;
    }
  }
  throw new Error("Unknown extension: " + path);
};

const getChapterTitle = (content) => {
  const m = content.match(/<h\d>(.*?)<\/h\d>/ms);
  if (!m) {
    return null;
  }
  return m[1];
};

const validate_xml = (xml) => {
  //
};

const loadChapter = (path) => {
  let content = fs.readFileSync(path).toString();
  if (path.endsWith(".md")) {
    throw new Error("markdown todo");
    // content = markdown2.markdown(content).replace("<br>", "<br/>");
    path = path.replace(".md", ".html");
  }
  content = html.unescape(content);

  return {
    path: local_path(path),
    type: mime_type(path),
    content: content,
    title: getChapterTitle(content),
  };
};

const loadImages = (dirpath: string) => {
  const images = [] as any[];
  try {
    fs.statSync(dirpath + "/images");
  } catch (e) {
    return images;
  }

  const names = fs.readdirSync(dirpath + "/images");
  for (const name of names) {
    const path = dirpath + "/images/" + name;
    images.push(loadFile(path));
  }
  return images;
};

const loadCover = (projectDir: string) => {
  const coverFiles = ["cover.jpg", "cover.png"];
  for (const name of coverFiles) {
    const path = projectDir + "/" + name;
    if (fs.existsSync(path)) {
      return loadFile(path);
    }
  }
  return null;
};

const loadFile = (path: string) => {
  const content = fs.readFileSync(path);
  return {
    path: local_path(path),
    type: mime_type(path),
    content,
  };
};
