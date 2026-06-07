import math, os
from PIL import Image, ImageDraw

RUN_DIR = r"D:\temp\petdex-catgirl"
W, H = 192, 208

C = {
    "skin": "#fcd9b8", "skin_shd": "#e8c4a0", "blush": "#fca5a5",
    "eye_w": "#ffffff", "iris": "#a78bfa", "pupil": "#2d1b69", "hi": "#ffffff",
    "hair": "#a78bfa", "hair_l": "#c4b5fd", "hair_d": "#7c3aed",
    "hoodie": "#d8b4fe", "hoodie_d": "#9b72cf",
    "skirt": "#9b72cf", "skirt_d": "#754fa0",
    "ear": "#f9a8d4", "ear_d": "#f472b6", "mouth": "#e87979",
}

def df(img, cx, by, **kw):
    d = ImageDraw.Draw(img)
    b = kw.get("blink"); lx=kw.get("lx",0); sq=kw.get("sq",1.0)
    sm=kw.get("sm",0); tu=kw.get("tu"); au=kw.get("au",0)
    a_s=kw.get("as",0); ba=kw.get("ba",0.3); hf=kw.get("hf")
    sl=kw.get("sl"); zs=kw.get("zs",0); wc=kw.get("wc",0)
    t=kw.get("t",0); bo=kw.get("bo",0); sp=kw.get("sp")
    cx+=t; by+=bo; hy=by-34; bt=by-12

    if tu:
        d.polygon([(cx+22,bt+6),(cx+38,bt-14),(cx+32,bt-26),(cx+28,bt-30),(cx+24,bt-24),(cx+28,bt-10)],fill=C["hair"],outline=C["hair_d"])
    d.ellipse([cx-32,hy-14,cx+32,hy+12],fill=C["hair_d"])
    for s in[-1,1]:
        ex,ey=cx+s*30,by-62
        d.polygon([(ex,ey),(ex+s*-14,ey-22),(ex+s*6,ey-18)],fill=C["ear"],outline=C["ear_d"])
        d.polygon([(ex+s*-1,ey-4),(ex+s*-7,ey-16),(ex+s*3,ey-12)],fill=C["ear_d"])
    d.ellipse([cx-24,hy-24,cx+24,hy+26],fill=C["skin"],outline=C["skin_shd"])
    d.ellipse([cx-28,hy-16,cx+28,hy+4],fill=C["hair"])
    for i in range(-3,4):
        bx=cx+i*7; by2=hy-10+abs(i)*2+math.sin(i*2)*2
        d.ellipse([bx-5,by2-12,bx+5,by2+2],fill=C["hair_l"] if abs(i)%2 else C["hair"])
    d.polygon([(cx-26,hy-2),(cx-34,by-30),(cx-28,by-6),(cx-26,by-12),(cx-22,by-22),(cx-24,hy-2)],fill=C["hair_d"])
    d.polygon([(cx+26,hy-2),(cx+34,by-30),(cx+28,by-6),(cx+26,by-12),(cx+22,by-22),(cx+24,hy-2)],fill=C["hair_d"])

    if not hf:
        ey=hy+2; el=6*sq; eh=7 if not b else 1
        d.ellipse([cx-9+lx-el,ey-eh,cx-9+lx+el,ey+eh],fill=C["eye_w"])
        d.ellipse([cx+9+lx-el,ey-eh,cx+9+lx+el,ey+eh],fill=C["eye_w"])
        if not b:
            d.ellipse([cx-8+lx-4,ey-2,cx-8+lx+4,ey+5],fill=C["iris"])
            d.ellipse([cx+10+lx-4,ey-2,cx+10+lx+4,ey+5],fill=C["iris"])
            d.ellipse([cx-8+lx-2,ey,cx-8+lx+2,ey+3],fill=C["pupil"])
            d.ellipse([cx+10+lx-2,ey,cx+10+lx+2,ey+3],fill=C["pupil"])
            d.ellipse([cx-10+lx-1.5,ey-1,cx-10+lx+1.5,ey+1],fill=C["hi"])
            d.ellipse([cx+8+lx-1.5,ey-1,cx+8+lx+1.5,ey+1],fill=C["hi"])
        if ba>0:
            for ox in[-16,16]:
                d.ellipse([cx+ox-6,by-30-4,cx+ox+6,by-22+4],fill="#fca5a5")
        if sm>0.3: d.arc([cx-4,by-25,cx+4,by-19],10,170,fill=C["mouth"],width=2)
        elif sm<0: d.arc([cx-3,by-22,cx+3,by-18],190,350,fill=C["mouth"],width=2)
        else: d.arc([cx-3,by-26,cx+3,by-22],10,170,fill=C["mouth"],width=2)

    au2=au*-4
    d.polygon([(cx-24,bt),(cx-28,bt+10),(cx-26,bt+28),(cx-20,bt+38),(cx,bt+40),(cx+20,bt+38),(cx+26,bt+28),(cx+28,bt+10),(cx+24,bt)],fill=C["hoodie"],outline=C["hoodie_d"])
    d.line([(cx,bt+2),(cx,bt+38)],fill=C["hoodie_d"],width=1)
    d.ellipse([cx-12,bt+22,cx+12,bt+30],fill=C["hoodie_d"])
    d.ellipse([cx-10,bt-4,cx+10,bt+2],fill="#f0abfc")
    for s,sa in[(-1,a_s),(1,-a_s)]:
        d.ellipse([cx+s*36,bt+6-sa*0.3+au2,cx+s*24,bt+16-sa*0.3+au2],fill=C["hoodie"],outline=C["hoodie_d"])
        d.ellipse([cx+s*35,bt+16-sa*0.3+au2,cx+s*27,bt+24-sa*0.3+au2],fill=C["skin"],outline=C["skin_shd"])
    sty=bt+38
    d.polygon([(cx-18,sty),(cx-24,sty+16),(cx-20,sty+26),(cx-10,sty+32),(cx,sty+32),(cx+10,sty+32),(cx+20,sty+26),(cx+24,sty+16),(cx+18,sty)],fill=C["skirt"],outline=C["skirt_d"])
    for i in range(-2,3):
        d.line([(cx+i*8,sty+2),(cx+i*8+2,sty+28)],fill=C["skirt_d"],width=1)
    lo=wc*4
    d.ellipse([cx-13+lo,sty+28,cx-3+lo,sty+44],fill=C["skin"],outline=C["skin_shd"])
    d.ellipse([cx+3-lo,sty+28,cx+13-lo,sty+44],fill=C["skin"],outline=C["skin_shd"])
    d.ellipse([cx-13+lo,sty+34,cx-3+lo,sty+44],fill="#f0e6ff")
    d.ellipse([cx+3-lo,sty+34,cx+13-lo,sty+44],fill="#f0e6ff")
    if sl:
        zy=hy-16
        for z in range(zs+1):
            d.text((cx+14+z*6,zy-z*8),"z" if z<2 else "Z",fill=C["iris"])
    if sp:
        for i,sx in enumerate([12,22,30,16]):
            d.ellipse([cx+sx-2,by-56+math.sin(i*1.5)*3-2,cx+sx+2,by-56+math.sin(i*1.5)*3+2],fill="#fde68a")

def ms(name,fc,fn):
    strip=Image.new("RGBA",(fc*W,H),(0,0,0,0))
    for c in range(fc):
        fr=Image.new("RGBA",(W,H),(0,0,0,0)); fn(c,fr); strip.paste(fr,(c*W,0),fr)
    strip.save(RUN_DIR+"/decoded/"+name+".png")
    print(f"  {name}.png")

os.makedirs(RUN_DIR+"/decoded",exist_ok=True)
os.makedirs(RUN_DIR+"/references",exist_ok=True)

img=Image.new("RGBA",(W,H),(0,0,0,0))
df(img,96,120)
img.save(RUN_DIR+"/decoded/base.png")
img.save(RUN_DIR+"/references/canonical-base.png")
print("base.png ok")

# Test just base first, then strips
