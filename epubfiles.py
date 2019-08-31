import os
import xml
import xml.dom.minidom
import html.parser
import re

# There's a rumor that epub readers only support the "quo, amp, apos, lt and gt quintet."


def escape_xml(s):
    if not s:
        return s
    args = [
        ("'", "&apos;"),
        ('"', '&quot;'),
        ('>', "&gt;"),
        ('<', "&lt;"),
        ("&", "&amp;")
    ]
    for a, b in args:
        s = s.replace(a, b)
    return s


def fix_html(s):
    a = set(re.findall(r'&\w+;', s))
    for entity in a:
        if entity in ["&apos;", "&quot;", "&gt;", "&lt;", "&amp;"]:
            continue
        s = s.replace(entity, html.unescape(entity))
    return s


def validate_xml(s):
    try:
        xml.dom.minidom.parseString(s)
    except xml.parsers.expat.ExpatError as e:
        line = s.split("\n")[e.lineno - 1]
        print(f'{str(e)}: {line}')


def validatexml(func):
    def with_validation(*args):
        s = func(*args)
        validate_xml(s)
        return s
    return with_validation


@validatexml
def manifest(chapters, images, meta):
    cover = None
    for f in images:
        if os.path.basename(f['path']).startswith("cover."):
            cover = f
            break

    if cover is None:
        raise Exception("Missing cover")

    files = chapters + images

    file_items = "".join(
        [f'<item href="{f["path"]}" id="{f["path"]}" media-type="{f["type"]}"/>' for f in files])
    itemrefs = "\n".join([f'<itemref idref="{c["path"]}"/>' for c in chapters])

    return f"""<?xml version = "1.0" encoding = "utf-8"?>
    <package
      xmlns="http://www.idpf.org/2007/opf"
      dir="ltr"
      unique-identifier="uid"
      version="3.0"
      xml:lang="{meta['language']}">
        <metadata
            xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
            xmlns:opf="http://www.idpf.org/2007/opf"
            xmlns:dcterms="http://purl.org/dc/terms/"
            xmlns:dc="http://purl.org/dc/elements/1.1/"
            >
            <meta name="cover" content="{cover['path']}"/>
            <dc:title>{meta['title']}</dc:title>
            <dc:language>{meta['language']}</dc:language>
            <dc:creator>{meta['author']}</dc:creator>
        </metadata>
        <manifest>
            <item href="toc.ncx" id="ncx" media-type="application/x-dtbncx+xml"/>
            <item href="style.css" id="style.css" media-type="text/css"/>
            {file_items}
        </manifest>
        <spine toc="ncx">
            {itemrefs}
        </spine>
        <guide>
            {"".join(
                [f'<reference href="{c["path"]}" title="{escape_xml(c["title"])}" type="bodymatter"/>' for c in chapters])}
        </guide>
    </package>
    """


@validatexml
def container(manifestPath):
    return f"""<?xml version="1.0" encoding="utf-8"?>
    <container xmlns="urn:oasis:names:tc:opendocument:xmlns:container" version="1.0">
        <rootfiles>
            <rootfile full-path="{manifestPath}" media-type="application/oebps-package+xml"/>
        </rootfiles>
    </container>
    """


@validatexml
def ncx(chapters):
    #   /*
    #     <navPoint id="navpoint-1" playOrder="1">
    #         <navLabel>
    #             <text>Front</text>
    #         </navLabel>
    #         <navPoint id="navpoint-1" playOrder="1">
    #             <navLabel>
    #                 <text>Front</text>
    #             </navLabel>
    #             <content src="text/title.xhtml"/>
    #         </navPoint>
    #     </navPoint>
    #     */
    points = "\n".join([nav_point(c) for c in chapters])
    return f"""<?xml version="1.0" encoding="utf-8"?>
        <ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1" xml:lang="en-US">
            <head>
            </head>
            <docTitle>
                <text>Table of Contents</text>
            </docTitle>
            <navMap id="navmap">
                {points}
            </navMap>
        </ncx>
        """


@validatexml
def nav_point(chapter):
    if type(chapter) == list:
        # Assume the first subchapter is the title.
        title = chapter[0]
        rest = chapter[1:]
        subentries = "\n".join([nav_point(c) for c in rest])
        return f"""<navPoint id="navpoint-{title["path"]}">
          <navLabel>
            <text>{title["title"]}</text>
          </navLabel>
          <content src="{title["path"]}"/>
          {subentries}
        </navPoint>
        """

    return f"""<navPoint id="navpoint-{chapter["path"]}">
        <navLabel>
            <text>{chapter["title"]}</text>
        </navLabel>
        <content src="{chapter["path"]}"/>
        </navPoint>"""


@validatexml
def chapter(chapter, meta):
    content = fix_html(chapter['content'])
    return f"""<?xml version="1.0" encoding="utf-8"?>
    <html
      xmlns="http://www.w3.org/1999/xhtml"
      xmlns:epub="http://www.idpf.org/2007/ops"
      lang="{meta["language"]}"
      xml:lang="{meta["language"]}"
    >
      <head>
        <title>{chapter["title"] or ""}</title>
        <link href="../style.css" rel="stylesheet" type="text/css" />
      </head>
      <body>
      {content}
      </body>
    </html>
    """
