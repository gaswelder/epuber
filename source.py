import os
import re


def read(dirpath):
    """Reads a book project located at the given path"""
    meta = parse_meta(dirpath + "/meta")
    chapters = read_part(dirpath + "/chapters")
    images = read_images(dirpath)
    return (meta, chapters, images)


def read_images(dirpath):
    try:
        os.stat(dirpath + "/images")
    except FileNotFoundError:
        return []
    names = os.listdir(dirpath + "/images")
    return [read_image(dirpath + "/images/" + name) for name in names]


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


def read_part(dirpath):
    """Reads a collection (folder) of chapters"""
    files = []
    for name in sorted(os.listdir(dirpath)):
        path = dirpath + "/" + name
        if os.path.isdir(path):
            files.append(read_part(path))
        else:
            files.append(read_chapter(path))
    return files


def read_image(path):
    """Reads an image located at the given path"""
    with open(path, 'rb') as f:
        return {
            "path": local_path(path),
            "type": mime_type(path),
            "content": f.read()
        }


def local_path(path):
    return "/".join(path.split("/")[2:])


def read_chapter(path):
    with open(path) as f:
        content = f.read()
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
        ("jpeg", "image/jpeg"),
        ("png", "image/png"),
        ("xhtml", "application/xhtml+xml"),
        # Allow html extension for source files to let viewing them with a browser.
        ("html", "application/xhtml+xml")
    ]
    for ext, t in types:
        if path.endswith("." + ext):
            return t
    raise "Unknown extension: " + path


def chapter_title(content):
    e = r'<h\d>(.*?)<\/h\d>'
    m = re.search(e, content)
    if m is None:
        return None
    return m[1]
