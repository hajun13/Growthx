# usage: python lintsum.py <eslint-json> — 규칙별 x 디렉터리별 위반 집계 (마크다운 표)
import json, sys, os, collections

data = json.load(open(sys.argv[1], encoding='utf-8'))
root = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(sys.argv[1])), '..', '..', 'apps', 'web'))
rules = ['no-restyle', 'no-raw-colors', 'no-arbitrary-values', 'no-inline-styles', 'no-unknown-classes', 'require-static-classes', 'no-restricted-syntax']
tab = collections.defaultdict(collections.Counter)
other = collections.Counter()
for f in data:
    rel = os.path.relpath(f['filePath'], root).replace(chr(92), '/')
    parts = rel.split('/')
    if parts[0] == 'features' and len(parts) > 2:
        d = 'features/' + parts[1]
    elif parts[0] == 'components' and len(parts) > 2:
        d = 'components/' + parts[1]
    elif parts[0] == 'components':
        d = 'components (L2)'
    else:
        d = parts[0]
    for m in f['messages']:
        r = (m.get('ruleId') or 'parse-error').replace('shadcn/', '')
        tab[d][r] += 1
        if r not in rules:
            other[r] += 1
tot = collections.Counter()
print('| 경로 | ' + ' | '.join(rules) + ' | 합계 |')
print('|---|' + '---:|' * (len(rules) + 1))
for d in sorted(tab):
    row = [tab[d][r] for r in rules]
    for r, c in zip(rules, row):
        tot[r] += c
    print(f'| {d} | ' + ' | '.join(map(str, row)) + f' | {sum(row)} |')
print('| **합계** | ' + ' | '.join(f'**{tot[r]}**' for r in rules) + f' | **{sum(tot.values())}** |')
if other:
    print('other:', dict(other))
