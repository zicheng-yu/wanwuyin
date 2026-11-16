# 演示视频怎么做出来的

成片：`submission/盼盼法式小面包-万物印-演示视频.mp4`（1920×1080，30 fps，106 秒，无配音，文字说明加本地合成的配乐）。画面全部来自网页本身：造印机的实机录屏，以及展示页 `seal.html` 的逐帧实时渲染。没有手工建模或后期 3D。

工作目录默认是 `/tmp/wwy`（`edit.py` 读环境变量 `WWY_WORK`）。Node 脚本在 `web/` 下运行，用本机 Chrome（其他系统设 `CHROME_PATH`）。Python 脚本需要 `numpy scipy pillow`。

## 1. 造印机实机录屏（真的调用 Lux3D）

先开 Vite（`npx vite --port 5199 --host 127.0.0.1`）和造印机后端（`pipeline/scripts/serve_seals.py --port 8000`，见 docs/造印机后端.md）。

```bash
node tools/video/rec-maker.mjs text  /tmp/wwy/rec_text2  1600 900 2   # 输入"我想摸摸长颈鹿"，文生 3D，约 13 积分
node tools/video/rec-maker.mjs photo /tmp/wwy/rec_photo2 1600 900 2   # 上传大都会博物馆 CC0 青铜钟照片，图生 3D，约 1 积分
```

脚本用 Playwright 操作页面（打字、选照片、点"铸成我的印"、翻面、拓印），画面来自 Chrome DevTools 的屏幕流，每帧带时间戳；`markers.json` 记下提交、落桌、翻面等时刻。Chrome 要带 `--force-device-scale-factor=2`，否则屏幕流只有 1600×900，放大局部会糊。漫长的等待段每 0.5 秒存一帧，剪辑时加速。页面上画了一个假鼠标指针，因为无头浏览器的录屏里没有光标。

注意：同名的印已经在 `generated.json` 里时，造印机会直接拿出"已备好的印"，不会重新生成。重录前把旧的生成结果移开。

## 2. 展示页逐帧渲染

`seal.html?...&capture` 模式下页面不自己动，由脚本调用 `window.seek(t)` 一帧一帧渲染，不掉帧。`&orbit=秒数` 给合影、三联图、三种印材加一个缓慢环绕的镜头。

```bash
U=http://127.0.0.1:5199/seal.html
node tools/video/render-seal.mjs "{\"url\":\"$U?view=anim&seal=elephant&capture\",\"out\":\"/tmp/wwy/renders/elephant_anim\",\"ranges\":[[0,12]],\"speed\":0.9,\"css\":\"#cap{display:none!important}\"}"
node tools/video/render-seal.mjs "{\"url\":\"$U?view=anim&seal=blue_whale&capture&plain\",\"out\":\"/tmp/wwy/renders/spin_blue_whale\",\"ranges\":[[0.5,2.45]],\"speed\":0.8,\"css\":\"#cap{display:none!important}\"}"
node tools/video/render-seal.mjs "{\"url\":\"$U?view=set&capture&orbit=9&swing=0.3&push=0.12\",\"out\":\"/tmp/wwy/renders/set_orbit\",\"css\":\".head{display:none!important}\"}"
node tools/video/render-seal.mjs "{\"url\":\"$U?view=set&materials=1&capture&orbit=6\",\"out\":\"/tmp/wwy/renders/materials_orbit\",\"css\":\".head{display:none!important}\"}"
node tools/video/render-seal.mjs "{\"url\":\"$U?seal=elephant&capture&orbit=5&swing=0.25&push=0.06\",\"out\":\"/tmp/wwy/renders/triptych_orbit\"}"
```

其余六枚印的快切把 `blue_whale` 换成 saturn、trex、shark、volcano、ant、yongzhong。快切镜头的放大框按 `renders/bbox.json`（每段里印的外接框）计算。

## 3. 文字、配乐、剪辑

```bash
node tools/video/overlays.mjs tools/video/overlays.json /tmp/wwy/ov         # 文字层、标题卡、片尾卡（苹方，透明 PNG）
python tools/video/edit.py /tmp/wwy/video_silent.mp4                       # 按时间线合成无声成片，打印各镜头起止
python tools/video/music.py /tmp/wwy/music.wav 106.0                       # 本地合成配乐：F 大调、80 BPM，无采样、无版权问题
ffmpeg -i /tmp/wwy/video_silent.mp4 -i /tmp/wwy/music.wav \
  -filter_complex "[1:a]loudnorm=I=-16:TP=-1.5:LRA=11,afade=t=out:st=104.2:d=1.8[a]" \
  -map 0:v -map "[a]" -c:v copy -c:a aac -b:a 192k -shortest out.mp4
```

`edit.py` 里的 `SHOTS` 是整条时间线：每个镜头写明素材、取哪一段、输出多长（据此变速）、放大框关键帧和交叉淡化；`OVS` 是文字层的出现时间。每一帧只由时间决定，8 个进程并行，整片约半分钟渲完。`python tools/video/edit.py out "preview:12,47.5"` 只出几张预览图。`frame-at.py` 从录屏里按标记取一帧并画 100 px 网格，用来定放大框。

`cover.mjs` 生成横版和 3:4 竖版封面。
