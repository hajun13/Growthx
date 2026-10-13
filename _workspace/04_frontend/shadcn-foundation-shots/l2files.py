# usage: python l2files.py <eslint-json> — components/*.tsx(L2) 중 남은 위반 파일 목록(소유자 배정용)
import json, os, sys, collections

d = json.load(open(sys.argv[1], encoding='utf-8'))
root = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(sys.argv[1])), '..', '..', 'apps', 'web'))
rows = []
for f in d:
    rel = os.path.relpath(f['filePath'], root).replace(chr(92), '/')
    if rel.startswith('components/') and rel.count('/') == 1 and f['messages']:
        c = collections.Counter((m.get('ruleId') or 'x').replace('shadcn/', '').replace('no-restricted-syntax', 'raw') for m in f['messages'])
        rows.append((len(f['messages']), rel, dict(c)))
rows.sort(reverse=True)
print(len(rows), 'files', sum(r[0] for r in rows), 'violations')
for n, rel, c in rows:
    print(n, rel, c)
