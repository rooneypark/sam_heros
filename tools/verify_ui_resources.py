"""Validate editable UI resource links and PNG dimensions without extra dependencies."""
import json
import re
import struct
from pathlib import Path

root = Path(__file__).resolve().parents[1]
ui = root / 'art/ui'
read = lambda p: json.loads(p.read_text(encoding='utf-8-sig'))
manifest = read(ui / 'manifest.json')
index = read(ui / 'sprite-index.json')
assert len(index) == 1116
assert len(manifest['sprites']) == 37
for name, spec in index.items():
    path = (ui / spec['file']).resolve()
    assert path.is_relative_to(ui.resolve()), name
    data = path.read_bytes()
    assert data[:8] == b'\x89PNG\r\n\x1a\n', path
    assert struct.unpack('>II', data[16:24]) == (spec['width'], spec['height']), name
    assert spec['runtime'] == (name in manifest['sprites']), name
    if spec['runtime']:
        active = manifest['sprites'][name]
        assert active['file'] == spec['file'], name
        assert [active['width'], active['height']] == [spec['width'], spec['height']], name
        assert active['meta']['rot'] == 0, name
for path in manifest['prefabs'].values():
    read(ui / path)
prefabs = list((ui / 'reference/original-prefabs').rglob('*.json'))
assert len(prefabs) == 413
for path in prefabs:
    read(path)
for path in ui.rglob('*.css'):
    for rel in re.findall(r'@import\s+[\'"]([^\'"]+)', path.read_text(encoding='utf-8-sig')):
        assert (path.parent / rel).is_file(), (path, rel)
for path in ['web/index.html', 'docs/design/intro/intro_prototype.html']:
    text = (root / path).read_text(encoding='utf-8-sig')
    assert '/samguk/art/ui/chapter1/theme.css' in text
    assert '/samguk/art/ui/intro/style.css' in text
print('PASS 1116 PNG resources, 37 active sprites, 413 reference layouts, editable styles and entry links')
