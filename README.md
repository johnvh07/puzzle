# Making a live image

1. In Photos.app, select an image, then `file > export > export original` to get a MOV.
2. `ffmpeg -i x.mov` to see fps and resolution.
3. `ffmpeg -i x.mov -ss 1.5 -to 2.5 -an trimmed.mov`  (`-an` removes audio)
4. `ffmpeg -i trimmed.mov -qscale:v 2 frames/%d.jpg` (qualityscale is 1=best to 31=worst)




# TODO:
- Use an image stabilizer (eg, stabbot) and crop to fit.
