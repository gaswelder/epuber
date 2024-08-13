import { XmlNode } from "xmldoc";

export function toHTML(element: XmlNode) {
  switch (element.type) {
    case "cdata":
    case "comment":
      break;
    case "element":
      const name = element.name;
      let s = `<${name}`;
      for (var k in element.attr) {
        s += ` ${k}="${element.attr[k]}"`;
      }
      s += ">";
      s += element.children.map(toHTML).join("");
      s += `</${name}>`;
      return s;
    case "text":
      return escape(element.text);
    default:
      throw new Error(`unexpected element type`);
  }
}

// escape escapes the given plain text string for safe use in HTML code.
function escape(str: string) {
  return str.replace("&", "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
