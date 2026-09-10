"""Original short arcade-fighting cues; no music or crowd loops."""
import math, random, wave, struct
from pathlib import Path
random.seed(2026)
SR = 22050
out = Path('public/audio')
out.mkdir(exist_ok=True)
def write(name, duration, fn):
    samples=[]
    for i in range(int(duration*SR)):
        t=i/SR
        fade=min(1,t/.0015,(duration-t)/.015)
        samples.append(struct.pack('<h', round(max(-.9,min(.9,fn(t)*fade))*26000)))
    with wave.open(str(out/(name+'.wav')),'wb') as f:
        f.setparams((1,2,SR,0,'NONE','not compressed'))
        f.writeframes(b''.join(samples))
def hit(t, heavy=False):
    # Dry body contact, brief midrange crack, no sustained sub-bass.
    decay=32 if heavy else 48
    body=math.sin(2*math.pi*(125*t+.65*(1-math.exp(-60*t))))*.55*math.exp(-decay*t)
    crack=random.uniform(-1,1)*.28*math.exp(-110*t)
    return body+crack
write('impact',.16,hit)
write('heavy',.22,lambda t:hit(t,True))
write('block',.13,lambda t:(math.sin(2*math.pi*230*t)*.26+random.uniform(-1,1)*.15)*math.exp(-55*t))
wind=[0.0]
def whoosh(t):
    wind[0]=.75*wind[0]+.25*random.uniform(-1,1)
    return wind[0]*math.sin(math.pi*t/.18)**2*.55
write('whoosh',.18,whoosh)
write('ui',.075,lambda t:math.sin(2*math.pi*520*t)*math.exp(-60*t)*.15)
write('beep',.12,lambda t:math.sin(2*math.pi*660*t)*math.exp(-28*t)*.2)
write('ko',.4,lambda t:hit(t,True)*.65+math.sin(2*math.pi*220*t)*math.exp(-12*t)*.14)
def victory(t):
    notes=[392,493.88,587.33,783.99]
    n=notes[min(3,int(t/.12))]
    local=t%.12 if t<.36 else t-.36
    return math.sin(2*math.pi*n*local)*math.exp(-local*12)*.16
write('trophy',.85,victory)
write('cheer',.45,lambda t:sum(math.sin(2*math.pi*f*t) for f in (392,493.88,587.33))*.035*math.exp(-10*t))
for name in ('music','crowd'):
    (out/(name+'.wav')).unlink(missing_ok=True)
