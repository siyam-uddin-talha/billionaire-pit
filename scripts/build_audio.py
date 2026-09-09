"""Generate original synthetic sound design. All playback is owned by Babylon Sound."""
import math, random, wave, struct, os
random.seed(2026); os.makedirs('public/audio',exist_ok=True);SR=22050

def write(name,seconds,fn):
    with wave.open('public/audio/'+name+'.wav','wb') as f:
        f.setparams((1,2,SR,0,'NONE','not compressed'));f.writeframes(b''.join(struct.pack('<h',int(max(-1,min(1,fn(i/SR)))*26000)) for i in range(int(seconds*SR))))
write('ui',.11,lambda t:math.sin(2*math.pi*(700-1000*t)*t)*math.exp(-35*t)*.2)
write('beep',.2,lambda t:math.sin(2*math.pi*600*t)*math.exp(-12*t)*.3)
write('impact',.24,lambda t:(random.uniform(-1,1)*.45+math.sin(2*math.pi*(100-160*t)*t)*.7)*math.exp(-23*t))
write('heavy',.55,lambda t:(random.uniform(-1,1)*.5+math.sin(2*math.pi*(70-70*t)*t)*.7)*math.exp(-13*t))
write('block',.22,lambda t:(math.sin(2*math.pi*440*t)+math.sin(2*math.pi*687*t)+random.uniform(-1,1)*.5)*math.exp(-24*t)*.3)
write('whoosh',.28,lambda t:random.uniform(-1,1)*math.sin(math.pi*t/.28)**2*.22)
write('ko',1.2,lambda t:(math.sin(2*math.pi*(60-25*t)*t)*.65+random.uniform(-1,1)*.25)*math.exp(-5*t))
write('crowd',6,lambda t:random.uniform(-1,1)*(.025+.025*math.sin(t*3)**2)+math.sin(2*math.pi*150*t)*.01)
write('cheer',3.5,lambda t:(random.uniform(-1,1)*.28+math.sin(2*math.pi*320*t+math.sin(t*9)*8)*.055)*math.sin(math.pi*t/3.5)**.6)
notes=[55,55,65.406,49,55,55,73.416,65.406]
def music(t):
    beat=t%.5; n=notes[int(t/.5)%8]; bass=math.sin(2*math.pi*n*t)*math.exp(-beat*8)*.11
    kick=math.sin(2*math.pi*(60-60*beat)*beat)*math.exp(-beat*30)*.18
    hat=random.uniform(-1,1)*math.exp(-(t%.25)*100)*.04
    return bass+kick+hat
write('music',8,music)
write('trophy',3.5,lambda t:sum(math.sin(2*math.pi*f*t)*.075 for f in [261.63,329.63,392,523.25])*min(t*5,1)*max(0,1-t/3.5))
