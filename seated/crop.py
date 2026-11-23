import sys
from PIL import Image
im = Image.open(sys.argv[1]).convert("RGB"); print(im.size)
W,H = im.size; s = W/1880
for name,(a,b) in {"front":(120,530),"side":(590,1140),"back":(1290,1770)}.items():
    im.crop((int(a*s),0,int(b*s),H)).save(f"{name}.png")
