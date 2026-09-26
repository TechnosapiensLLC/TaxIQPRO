"""One-off migration: replace hardcoded palette hexes with theme tokens."""
import os
import re

ROOT = "/app/frontend/app"

MAP = {
    "0A0A0F": "bg",
    "0F0F15": "bgSunken",
    "14141A": "surface",
    "1A1A22": "surfaceAlt",
    "1A1A24": "surfaceAlt",
    "2A2A35": "border",
    "4A4A5A": "borderStrong",
    "6B6B7B": "textMuted",
    "8A8A9A": "textTertiary",
    "9999AA": "textTertiary",
    "DDDDDD": "textSecondary",
    "FFFFFF": "text",
    "00D9A5": "accent",
    "7C6BFF": "accentAlt",
    "FFB84D": "warning",
    "FF6B6B": "danger",
    "0A1A15": "brandTint",
    "0A1510": "brandTint",
}

HEX_RE = re.compile(r"""(=)?(['"])#([0-9A-Fa-f]{6})([0-9A-Fa-f]{2})?\2""")


def convert(text: str, var: str) -> str:
    def repl(m):
        is_attr, quote, base, alpha = m.group(1), m.group(2), m.group(3), m.group(4)
        token = MAP.get(base.upper())
        if not token:
            return m.group(0)
        expr = f"{var}.{token}"
        if alpha:
            expr = f"{expr} + '{alpha}'"
        if is_attr:
            return "={" + expr + "}"
        return expr

    return HEX_RE.sub(repl, text)


def rel_import(path: str) -> str:
    depth = os.path.relpath(path, ROOT).count(os.sep)
    return "../" * (depth + 1) + "src/context/ThemeContext"


changed = []
for dirpath, _dirs, files in os.walk(ROOT):
    for fn in files:
        if not fn.endswith(".tsx"):
            continue
        path = os.path.join(dirpath, fn)
        with open(path) as fh:
            src = fh.read()

        if not HEX_RE.search(src):
            continue

        # Locate regions
        style_m = re.search(r"^const styles = StyleSheet\.create\(", src, re.M)
        comp_m = re.search(r"^export default function\s+(\w+)\s*\([^)]*\)\s*\{", src, re.M)
        if not comp_m:
            continue

        comp_start = comp_m.end()
        style_start = style_m.start() if style_m else len(src)

        if style_start < comp_start:
            # styles declared before the component: treat everything after styles
            module_part = src[:style_start]
            rest = src[style_start:]
            new = convert(module_part, "C") + convert(rest, "c")
        else:
            module_part = src[:comp_m.start()]
            body = src[comp_m.start():]
            new = convert(module_part, "C") + convert(body, "c")

        # styles -> makeStyles factory
        if style_m:
            new = new.replace(
                "const styles = StyleSheet.create(",
                "const makeStyles = (c: Palette) => StyleSheet.create(",
                1,
            )

        # inject hooks into component body
        comp_m2 = re.search(r"^export default function\s+(\w+)\s*\([^)]*\)\s*\{", new, re.M)
        inject = "\n  const c = useColors();"
        if style_m:
            inject += "\n  const styles = makeStyles(c);"
        new = new[: comp_m2.end()] + inject + new[comp_m2.end():]

        # imports
        imp = rel_import(path)
        names = "useColors, C" if "C." in new else "useColors"
        import_line = f"import {{ {names} }} from '{imp}';\n"
        if style_m:
            import_line += f"import type {{ Palette }} from '{imp.replace('context/ThemeContext', 'theme')}';\n"
        # insert after last top-level import
        imports = list(re.finditer(r"^import .*?;\s*$", new, re.M | re.S))
        last = imports[-1].end()
        new = new[:last] + "\n" + import_line.rstrip("\n") + new[last:]

        with open(path, "w") as fh:
            fh.write(new)
        changed.append(path)

print(f"migrated {len(changed)} files")
for p in changed:
    print(" ", p)
