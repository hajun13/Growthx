# usage: python classdiff.py <oldCssDir> <newCssDir>  — 구 빌드 CSS 에 있던 클래스 중 신 빌드에서 사라진 것
import re, glob, sys

def classes(d):
    s = set()
    for f in glob.glob(d + '/*.css'):
        css = open(f, encoding='utf-8').read()
        for m in re.finditer(r'\.((?:\\.|[A-Za-z0-9_\-])+)', css):
            s.add(re.sub(r'\\(.)', r'\1', m.group(1)))
    return s

old, new = classes(sys.argv[1]), classes(sys.argv[2])
miss = sorted(c for c in old - new if not c[0].isdigit())
print(len(old), len(new), len(miss))
print('\n'.join(miss))
