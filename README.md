# Making a live image

1. In Photos.app, select an image, then `file > export > export original` to get a MOV.
2. `ffmpeg -i x.mov` to see fps and resolution.
3. `ffmpeg -i x.mov -ss 1.5 -to 2.5 trimmed.mov`
4. `ffmpeg -i trimmed.mov frames/%d.jpg`




# TODO:
- Use an image stabilizer (eg, stabbot) and crop to fit.
