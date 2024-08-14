// http://www.idpf.org/epub/20/spec/OPF_2.0.1_draft.htm#Section2.3
import JSZip from "jszip";
import * as path from "path";
import xmldoc, { XmlElement, XmlNode } from "xmldoc";
import { toHTML } from "./lib-html";

/**
 * Reads the given source and returns a book object.
 * The source is whatever can be read by JSZip.
 */
export const load = async (src: any) => {
  const zip = await new JSZip().loadAsync(src);
  const file = async (path: string, format: "string" | "base64") => {
    const file = zip.file(path);
    if (!file) {
      throw new Error(`${path} not found`);
    }
    return file.async(format);
  };
  const loadXML = async (path: string) =>
    new xmldoc.XmlDocument(await file(path, "string"));

  // Go to container.xml and find out where the index file is.
  const containerDoc = await loadXML("META-INF/container.xml");
  const rootfile = containerDoc.descendantWithPath("rootfiles.rootfile");
  if (!rootfile) {
    throw new Error(`couldn't get rootfile from container.xml`);
  }
  if (rootfile.attr["media-type"] != "application/oebps-package+xml") {
    throw new Error(
      "Expected rootfile with media type application/oebps-package+xml, got " +
        rootfile.attr["media-type"]
    );
  }
  const indexPath = rootfile.attr["full-path"];
  const indexDoc = await loadXML(indexPath);

  // Get the manifest - the list of all files in the package.
  const manifest = indexDoc
    .childNamed("manifest")
    ?.childrenNamed("item")
    .map((node) => {
      return {
        id: node.attr.id,
        href: node.attr.href,
        type: node.attr["media-type"],
      };
    });
  if (!manifest) {
    throw new Error(`couldn't read the manifest`);
  }

  // Get the spine - the ordered list of chapter file ids.
  const spine = indexDoc
    .childNamed("spine")
    ?.childrenNamed("itemref")
    .map((node) => node.attr.idref);
  if (!spine) {
    throw new Error(`couldn't read the spine`);
  }

  return {
    cover: function () {
      const f = (n: XmlNode): n is XmlElement =>
        n.type == "element" && n.name == "meta" && n.attr.name == "cover";
      const coverMeta = indexDoc.childNamed("metadata")?.children.find(f);
      if (!coverMeta) {
        return null;
      }
      const coverImageId = coverMeta.attr.content;
      const item = manifest.find((x) => x.id == coverImageId);
      if (!item) {
        throw new Error(`couldn't find item "${coverImageId}"`);
      }
      return {
        type: item.type,
        b64: () => file(applyHref(indexPath, item.href), "base64"),
      };
    },

    chapters() {
      return spine.map(function (chapterFileId) {
        const chapterItem = manifest.find((x: any) => x.id == chapterFileId);
        if (!chapterItem) {
          throw new Error(`couldn't find spine item "${chapterFileId}"`);
        }
        return {
          /**
           * Returns contents of the chapter as HTML string.
           */
          async html() {
            const errors = [] as string[];
            const chapterPath = applyHref(indexPath, chapterItem.href);
            const doc = await loadXML(chapterPath);
            const imageNodes = xmlfind(
              doc,
              (ch) => ch.name == "img" || ch.name == "image"
            );
            const inlineImage = async (image: xmldoc.XmlElement) => {
              let hrefAttr = "src";
              if (image.name == "image") {
                hrefAttr = "xlink:href";
              }
              const imagePath = applyHref(chapterPath, image.attr[hrefAttr]);
              const imageItem = manifest.find(
                (x) => applyHref(indexPath, x.href) == imagePath
              );
              if (!imageItem) {
                throw new Error("couldn't find image " + imagePath);
              }
              const img64 = await file(
                applyHref(indexPath, imageItem.href),
                "base64"
              );
              image.attr[hrefAttr] = `data:${imageItem.type};base64,${img64}`;
            };
            for (const image of imageNodes) {
              try {
                await inlineImage(image);
              } catch (err: any) {
                errors.push(err.message);
              }
            }
            const elements = [];
            const body = doc.childNamed("body");
            if (!body) {
              throw new Error(`body element missing in the document`);
            }
            elements.push(...body.children);
            const html = elements.map(toHTML).join("");
            return { errors, html };
          },

          /**
           * Returns the chapter's archive path.
           */
          path: function () {
            return applyHref(indexPath, chapterItem.href);
          },
        };
      });
    },
    /**
     * Returns the book's table of contents
     * as a list of navigation pointer objects.
     */
    toc: async () => {
      const ncxItem = manifest.find(
        (x) => x.type == "application/x-dtbncx+xml"
      );
      if (!ncxItem) {
        throw new Error("couldn't find NCX item in the manifest");
      }

      const ncxPath = applyHref(indexPath, ncxItem.href);
      function parsePoints(root: XmlElement[]) {
        return root.map(function (p) {
          const text = p.childNamed("navLabel")?.childNamed("text");
          if (!text) {
            throw new Error(`navLabel not found`);
          }
          const content = p.childNamed("content");
          if (!content) {
            throw new Error(`content not found`);
          }
          return {
            title: () => text.val,
            children: () => parsePoints(p.childrenNamed("navPoint")),
            /**
             * Returns the target chapter's archive path.
             */
            path: () => applyHref(ncxPath, content.attr.src),
          };
        });
      }
      const tocDoc = await loadXML(ncxPath);
      const map = tocDoc.childNamed("navMap");
      if (!map) {
        throw new Error(`navMap missing`);
      }
      return parsePoints(map.childrenNamed("navPoint"));
    },

    /**
     * Returns the book's title.
     */
    title() {
      return indexDoc.descendantWithPath("metadata.dc:title")?.val;
    },

    /**
     * Returns the book's language.
     */
    language() {
      return indexDoc.descendantWithPath("metadata.dc:language")?.val;
    },

    author() {
      return indexDoc.descendantWithPath("metadata.dc:creator")?.val;
    },

    stylesheet: async function () {
      let css = "";
      for (const cssItem of manifest.filter((x: any) => x.type == "text/css")) {
        css += await file(applyHref(indexPath, cssItem.href), "string");
        css += "\n";
      }
      return css;
    },
  };
};

function ns(data: any): any {
  if (typeof data != "object") {
    return data;
  }
  return new Proxy(data, {
    get(t, k) {
      if (typeof k != "string") {
        return t[k];
      }
      return ns(t[k] || t["ncx:" + k]);
    },
  });
}

const applyHref = (p: string, href: string) => path.join(path.dirname(p), href);

function xmlfind(
  root: XmlElement,
  match: (n: XmlElement) => boolean
): XmlElement[] {
  return root.children.flatMap((child: any) => {
    if (child.type != "element") {
      return [];
    }
    return [...(match(child) ? [child] : []), ...xmlfind(child, match)];
  });
}
