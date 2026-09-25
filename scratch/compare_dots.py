import json, re

with open('src/core/schada/board_visual_data.ts', 'r') as f:
    text = f.read()

start = text.find('BOARD_VISUALS: Record<Square, SquareVisual> = ') + len('BOARD_VISUALS: Record<Square, SquareVisual> = ')
end = text.rfind(';')
data = json.loads(text[start:end].strip())

with open('src/core/schada/vectors.ts', 'r') as f:
    v_text = f.read()
v_start = v_text.find('SCHADA_VECTORS: Record<Square, MoveVector[]> = {') + len('SCHADA_VECTORS: Record<Square, MoveVector[]> = {')
v_end = v_text.rfind('};')
v_data = json.loads(re.sub(r'//.*', '', '{' + v_text[v_start:v_end] + '}'))

print("Comparison of visual dot counts vs vector targets:")
for sq in sorted(data.keys()):
    v_targets = v_data[sq]
    num_targets = len(v_targets)
    num_dots = len(data[sq]['dots'])
    if num_dots != num_targets:
        print(f"Square {sq}: {num_dots} visual dots, but {num_targets} vector targets!")
