import wave 
import math


with wave.open("pan_sweep.wav", "w") as f:
    f.setnchannels(2)
    f.setsampwidth(2)
    f.setframerate(44100)

    for i in range(10):
        pan = i / 10
        beep = math.sin(2 * math.pi * 440 * i / 44100)
        left = beep * (1 - pan)
        right = beep * pan
        left_num  = int (left *  32767  )
        right_num =   int (right * 32767  )
        
        print("pan", pan, "left", left_num, "right", right_num)