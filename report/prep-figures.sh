#!/bin/zsh
# Rebuild report/figures from the repo media and git history. Run from the repo root.
set -e
R=report/figures; S=report/src
mkdir -p $R $S
# Older renders from git history (baseline before the YOU-190 review)
for n in ant saturn blue_whale volcano set; do git show 816c16f:docs/media/seal_$n.png > $S/${n}_before.png; done
M=docs/media
# Cover / group shot (title text cropped away)
magick $M/seal_set.png -crop 2840x1390+180+250 +repage -resize 2400x $R/set_after.png
magick $S/set_before.png -crop 2840x1390+180+250 +repage -resize 1400x $R/set_before.png
magick $M/seal_set.png -crop 2840x1390+180+250 +repage -resize 1400x $R/set_after_small.png
# Triptychs (empty top band cropped)
for n in elephant blue_whale trex shark ant saturn volcano yongzhong; do
  magick $M/seal_$n.png -crop 3200x1430+0+340 +repage -resize 1800x $R/trip_$n.png
done
# Before/after crops: ant = knob + face; saturn/whale/volcano = face + rubbing
magick $S/ant_before.png -crop 1860x920+250+440 +repage -resize 1100x $R/ant_before.png
magick $M/seal_ant.png   -crop 1860x920+250+440 +repage -resize 1100x $R/ant_after.png
for n in saturn blue_whale volcano; do
  magick $S/${n}_before.png -crop 1810x980+1300+500 +repage -resize 1100x $R/${n}_before.png
  magick $M/seal_$n.png     -crop 1810x980+1300+500 +repage -resize 1100x $R/${n}_after.png
done
# Yongzhong knob + face (photo -> seal figure)
magick $M/seal_yongzhong.png -crop 1850x1040+250+340 +repage -resize 1100x $R/yongzhong_knobface.png
magick pipeline/out/inputs/met_bell/DP154556.jpg -resize x900 -quality 85 $R/met_DP154556.jpg
# Other media
cp $M/review190-angles.jpg $R/review_angles.jpg
magick $M/elephant_materials.jpg -crop 1440x660+0+0 +repage -quality 90 $R/elephant_materials.jpg
cp $M/seal_review_keyframes.jpg $R/keyframes.jpg
cp web/public/examples/yongzhong-views.jpg $R/yongzhong_views.jpg
magick /tmp/wwy/shots/maker.png -crop 1440x1075+0+0 +repage $R/maker.png
magick pipeline/out/screens/yongzhong_strike.png -quality 85 $R/wwys_strike.jpg
magick pipeline/out/screens/rack_jasmine.png -quality 85 $R/wwys_rack.jpg
ls -la $R
# Drop gamma/colour chunks so PDF viewers draw the cream image backgrounds exactly like the page colour
for f in $R/*.png; do magick "$f" -define png:exclude-chunks=gAMA,cHRM,bKGD,sRGB,iCCP,tIME,tEXt,zTXt,date "$f"; done
# Grid versions of the triptychs without the tiny built-in labels
for n in elephant blue_whale trex shark ant saturn volcano yongzhong; do
  magick $R/trip_$n.png -crop 1800x715+0+0 +repage -define png:exclude-chunks=gAMA,cHRM,bKGD,sRGB,iCCP,tIME,tEXt,zTXt,date $R/tripc_$n.png
done
# Key frames of the final demo video (made by the video tooling in web/tools/video, work dir /tmp/wwy)
[ -f /tmp/wwy/video_frames.jpg ] && cp /tmp/wwy/video_frames.jpg $R/video_frames.jpg
