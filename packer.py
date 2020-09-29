import sys
import source
import os
import zipfile
import epubfiles


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


def main():
    if len(sys.argv) < 2:
        print("usage: epuber <project-dir> [<output-path>]")
        sys.exit(1)

    project_dir = sys.argv[1]
    if len(sys.argv) < 3:
        output_path = project_dir.rstrip('/') + ".epub"
    else:
        output_path = sys.argv[2]

    w = ZipWriter(output_path)
    pack(project_dir, w)
    w.close()


def pack(project_dir, writer):
    """Reads a project in the given directory and writes epub archive using the given file writer"""
    manifest_path = "epub/content.opf"
    meta, chapters, images = source.read(project_dir)

    flat_chapters = flatten(chapters)

    no_titles = True
    for c in flat_chapters:
        if c['title'] is not None:
            no_titles = False
            break

    if no_titles:
        raise Exception("The book doesn't have chapter titles")

    writer.copy("epub/style.css",
                os.path.join(os.path.dirname(__file__), "style.css"))
    files = [
        ("mimetype", "application/epub+zip"),
        ("META-INF/container.xml", epubfiles.container(manifest_path)),
        (manifest_path, epubfiles.manifest(flat_chapters, images, meta)),
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

    for f in images:
        writer.write_file("epub/" + f["path"], f["content"])


def flatten(chapters):
    """Flattens a given hierarchical list of chapters."""
    l = []
    for c in chapters:
        if type(c) == list:
            l = l + c
        else:
            l.append(c)
    return l


main()
