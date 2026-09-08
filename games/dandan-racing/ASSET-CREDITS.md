# 素材来源与许可

以下素材来自 Poly Haven，其资产页面声明采用 CC0 1.0。所有图片和 HDR 文件均在构建时随软件打包，游戏运行时不会向来源站点发送请求。

| 本地文件 | 原始资产 | 来源 |
|---|---|---|
| daylight-2k.hdr | Kloofendal 48d Partly Cloudy (Pure Sky), Greg Zaal / Jarod Guest | https://polyhaven.com/a/kloofendal_48d_partly_cloudy_puresky |
| asphalt.jpg, asphalt-normal.jpg | Asphalt 02, Rob Tuytel | https://polyhaven.com/a/asphalt_02 |
| rock.jpg, rock-normal.jpg | Rock Face 03 | https://polyhaven.com/a/rock_face_03 |
| sand.jpg | Coast Sand 01 | https://polyhaven.com/a/coast_sand_01 |
| grass.jpg | Aerial Grass Rock | https://polyhaven.com/a/aerial_grass_rock |

许可说明：https://polyhaven.com/license
CC0 1.0：https://creativecommons.org/publicdomain/zero/1.0/

车辆几何、道路、建筑、植被、UI 和音效由本项目生成。Three.js 采用 MIT 许可，完整许可证随应用提供。

3.1 大厅资产（全部离线打包）：
- `lobby/concourse.jpg`、`driver.jpg`、四张 `map-*.jpg`、`egg.png` 和 `medal.png` 使用 OpenAI 内置 imagegen 生成。依据用户提供的 `游戏大厅.png` 统一美术风格，没有提取其他游戏资源。生成提示词见 `lobby/PROMPTS.md`。
- `fonts/NotoSansSC.ttf`：Google Fonts / Noto Sans SC 可变字体，SIL Open Font License 1.1。来源：https://github.com/google/fonts/tree/main/ofl/notosanssc ，完整 OFL.txt 随字体打包。
- Remix Icon 4.9.1：来源 https://github.com/Remix-Design/RemixIcon ，Remix Icon License 1.0，完整许可证 `REMIXICON-LICENSE.txt` 随应用提供。
- 车库车辆缩略图复用本游戏的实际 Three.js 车型，在启动时渲染，无远程加载。

美术与玩法参考：QQ 飞车的滨海、山路和矿山类赛道在一圈内的空间变化，以及不同赛车的轮廓和操控差异。未使用 QQ 飞车原始模型、贴图、音乐、角色或品牌标识。

3.2 火山海岛：
- `lobby/map-volcano.jpg`：由用户提供的 `新地图-火山海岛.png` 转为 JPEG，作为本机游戏的选图参考封面；未对该参考图声明原创或新增授权。
- 可驾驶路线、岛屿地形、桥墩、双瀑布、水屋村、火山隧道、植被、天空与水面效果由本项目重新制作。参考图是美术与布局依据，实际游戏为可驾驶的三维改编。


3.4 参考车型：
- 豆腐与星陨依据用户提供的 `豆腐.png`、`星陨.png` 制作独立三维几何。图片只作为造型依据，实车、车库缩略图和大厅展示使用同一套可驾驶模型；未将参考图贴到平面上代替实车。
- 跳灯、掀背窗框、宽体轮拱、尾翼、星芒涂装与轮毂均由本项目构建，使用自制材质与图案。
