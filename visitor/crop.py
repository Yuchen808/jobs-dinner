import sys
from PIL import Image
im = Image.open(sys.argv[1]).convert("RGB"); print(im.size)
W,H = im.size; s = W/1536
for name,(a,b) in {"front":(100,495),"side":(455,945),"back":(1035,1455)}.items():
    im.crop((int(a*s),0,int(b*s),H)).save(f"{name}.png")
