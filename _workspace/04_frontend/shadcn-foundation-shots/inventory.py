# usage: python inventory.py — components/ui/*.tsx 의 export 와 cva variant 옵션을 마크다운으로 출력
import re, glob, os

base = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..', 'apps', 'web', 'components', 'ui')
rows = []
for f in sorted(glob.glob(os.path.join(base, '*.tsx'))):
    name = os.path.basename(f)[:-4]
    src = open(f, encoding='utf-8').read()
    m = re.search(r'export\s*\{([^}]*)\}', src, re.S)
    exports = []
    if m:
        exports = [e.strip().split(' as ')[-1] for e in m.group(1).split(',') if e.strip()]
        exports = [e for e in exports if not e.endswith('Variants') and not e.startswith('type ')]
    exports += re.findall(r'export (?:const|function) (\w+)', src)
    exports = list(dict.fromkeys(exports))
    variants = {}
    for cm in re.finditer(r'cva\(', src):
        i = src.find('variants:', cm.start())
        if i < 0:
            continue
        # variants: { group: { key: ..., key2: ... }, group2: {...} } — 중괄호 깊이로 파싱
        j = src.find('{', i)
        depth = 0
        k = j
        while k < len(src):
            if src[k] == '{':
                depth += 1
            elif src[k] == '}':
                depth -= 1
                if depth == 0:
                    break
            k += 1
        body = src[j + 1:k]
        for gm in re.finditer(r'(\w+):\s*\{', body):
            g = gm.group(1)
            # 그룹 본문
            d = 0
            p = gm.end() - 1
            q = p
            while q < len(body):
                if body[q] == '{':
                    d += 1
                elif body[q] == '}':
                    d -= 1
                    if d == 0:
                        break
                q += 1
            gb = body[p + 1:q]
            # 최상위 키만(값 문자열 안 콜론 제외): 줄 시작의 `key:` 또는 `"key":`
            keys = re.findall(r'^\s*(?:"([^"]+)"|([\w]+))\s*:', gb, re.M)
            keys = [a or b for a, b in keys]
            if keys:
                variants[g] = keys
    rows.append((name, exports, variants))

out = ['| 파일 | export | variants (cva) |', '|---|---|---|']
for name, exports, variants in rows:
    v = '<br>'.join(f'`{g}`: ' + ' · '.join(f'`{k}`' for k in ks) for g, ks in variants.items()) or '—'
    out.append(f'| `{name}` | {", ".join(exports)} | {v} |')
print('\n'.join(out))
