import sys
import os
import zipfile
import epubfiles
import re
import markdown2
import html.parser

def main():
    if len(sys.argv) < 2:
        print("usage: epuber <project-dir> [<output-path>]")
        sys.exit(1)

    project_dir = sys.argv[1]
    if len(sys.argv) < 3:
        output_path = project_dir.rstrip('/') + ".epub"
    else:
        output_path = sys.argv[2]

    meta = parse_meta(project_dir + "/meta")
    cover = read_cover(project_dir)
    chapters = read_chapters_folder(project_dir + "/chapters")
    flat_chapters = flatten(chapters)
    images = read_images(project_dir)

    #
    # Input validation
    #
    invalid_titles = []
    for c in flat_chapters:
        title = c['title']
        if title is None:
            continue
        if title.find('<') != -1:
            invalid_titles.append([title, c['path']])
    if len(invalid_titles) > 0:
        print("Invalid titles:")
        for title, path in invalid_titles:
            print(f'\t"{title}" ({path})')
        exit(1)

    no_titles = True
    for c in flat_chapters:
        if c['title'] is not None:
            no_titles = False
            break
    if no_titles:
        raise Exception("The book doesn't have chapter titles")

    #
    # Output
    #
    writer = ZipWriter(output_path)
    writer.copy("epub/style.css",
                os.path.join(os.path.dirname(__file__), "style.css"))
    manifest_path = "epub/content.opf"
    files = [
        ("mimetype", "application/epub+zip"),
        ("META-INF/container.xml", epubfiles.container(manifest_path)),
        (manifest_path, epubfiles.manifest(flat_chapters, images, meta, cover)),
        ("epub/toc.ncx", epubfiles.ncx(chapters))
    ]
    for chapter in flat_chapters:
        src = epubfiles.chapter(chapter, meta)
        err = epubfiles.validate_xml(src)
        if err is not None:
            print('%s: %s: %s' %
                  (chapter['path'], err['message'], err['line']))
        files.append(("epub/" + chapter["path"], src))

    for path, content in files:
        writer.write_file(path, content)
    if cover is not None:
        f = cover
        writer.write_file("epub/" + f["path"], f["content"])
    for f in images:
        writer.write_file("epub/" + f["path"], f["content"])
    writer.close()


class ZipWriter:
    def __init__(self, dest_path):
        self.zip = zipfile.ZipFile(dest_path, "w")

    def write_file(self, path, content):
        with self.zip.open(path, "w") as f:
            if type(content) != bytes:
                f.write(bytes(content, 'utf-8'))
            else:
                f.write(content)

    def copy(self, path, srcpath):
        with open(srcpath, "rb") as f:
            self.write_file(path, f.read())

    def close(self):
        self.zip.close()


class Writer:
    def __init__(self, output_dir):
        self.output_dir = output_dir

    def write_file(self, path, content):
        dirpath = self.output_dir + "/" + os.path.dirname(path)
        if not os.path.exists(dirpath):
            os.makedirs(dirpath)

        with open(self.output_dir + "/" + path, "wb") as f:
            if type(content) != bytes:
                f.write(bytes(content, 'utf-8'))
            else:
                f.write(content)

    def copy(self, path, srcpath):
        with open(srcpath, "rb") as f:
            self.write_file(path, f.read())

    def close(self):
        pass


def flatten(chapters):
    """Flattens the given hierarchical list of chapters."""
    l = []
    for c in chapters:
        if type(c) == list:
            l = l + c
        else:
            l.append(c)
    return l


def read_file(path):
    with open(path, 'rb') as f:
        return {
            "path": local_path(path),
            "type": mime_type(path),
            "content": f.read()
        }

def read_cover(dirpath):
    cover = None
    cover_files = ["cover.jpg", "cover.png"]
    for name in cover_files:
        try:
            cover = read_file(dirpath + "/" + name)
            break
        except FileNotFoundError:
            pass
    return cover

def read_images(dirpath):
    images = []
    try:
        os.stat(dirpath + "/images")
    except FileNotFoundError:
        return images

    names = os.listdir(dirpath + "/images")
    for name in names:
        path = dirpath + "/images/" + name
        images.append(read_file(path))

    return images


def parse_meta(path):
    """Reads a project description file"""
    meta = {}
    with open(path) as f:
        for line in f:
            line = line.strip()
            if line == "":
                continue
            k, v = line.split("=")
            meta[k.strip()] = v.strip()
    return meta


def read_chapters_folder(dirpath):
    """Reads a collection (folder) of chapters.
    Returns a list containing chapter objects or nested lists in the case
    of nested folders."""
    files = []
    for name in sorted(os.listdir(dirpath)):
        path = dirpath + "/" + name
        if os.path.isdir(path):
            files.append(read_chapters_folder(path))
        else:
            files.append(read_chapter(path))
    return files


def local_path(path):
    return "/".join(path.split("/")[2:])


def read_chapter(path):
    with open(path) as f:
        content = f.read()
    if path.endswith('.md'):
        content = markdown2.markdown(content).replace('<br>', '<br/>')
        path = path.replace('.md', '.html')
    content = html.unescape(content)

    return {
        "path": local_path(path),
        "type": mime_type(path),
        "content": content,
        "title": chapter_title(content)
    }


def mime_type(path):
    """Guesses a file's MIME type given its path"""
    types = [
        ("jpg", "image/jpeg"),
        ("gif", "image/gif"),
        ("jpeg", "image/jpeg"),
        ("png", "image/png"),
        ("xhtml", "application/xhtml+xml"),
        # Allow html extension for source files to let viewing them with a browser.
        ("html", "application/xhtml+xml"),
        ("htm", "application/xhtml+xml")
    ]
    for ext, t in types:
        if path.endswith("." + ext):
            return t
    raise Exception("Unknown extension: " + path)


def chapter_title(content):
    e = r'<h\d>(.*?)<\/h\d>'
    regex = re.compile(e, re.MULTILINE | re.DOTALL)
    m = re.search(regex, content)
    if m is None:
        return None
    return m[1]



main()
