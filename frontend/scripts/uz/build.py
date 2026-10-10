# Собирает src/i18n.uz.js из словарей. Запуск: python3 scripts/uz/build.py
import json, os, sys
here = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, here)
from ui1 import UI1
from ui2 import UI2
from ui3 import UI3
from ui4 import UI4
from ui5 import UI5
from data import DATA
from server import SERVER

merged = {}
for part in (UI1, UI2, UI3, UI4, UI5, DATA, SERVER):
    for k, v in part.items():
        if k in merged and merged[k] != v:
            print('конфликт перевода:', k, '|', merged[k], '|', v)
        merged.setdefault(k, v)

out = os.path.join(here, '..', '..', 'src', 'i18n.uz.js')
with open(out, 'w', encoding='utf-8') as f:
    f.write('// Узбекский перевод (латиница). Файл создаётся скриптом scripts/uz/build.py — правьте словари там.\n')
    f.write('export const UZ = ' + json.dumps(merged, ensure_ascii=False, indent=1, sort_keys=True) + ';\n')
    f.write(open(os.path.join(here, 'patterns.js'), encoding='utf-8').read())
print('фраз в словаре:', len(merged))
