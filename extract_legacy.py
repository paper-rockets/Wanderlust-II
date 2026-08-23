import re

with open(r'E:\GAME FINAL RUN\LEGACY\galactic-home\index.f019de0c.js', 'r', encoding='utf-8') as f:
    text = f.read()

# Find the entire galaxy class or setup in index.f019de0c.js
idx = text.find('_createBoxBG')
start = max(0, idx - 4000)
end = min(len(text), idx + 4000)

print(text[start:end])
