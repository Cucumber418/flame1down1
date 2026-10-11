# Flame1Down - 1（试验版）

一款类宝可梦的精灵对战网页游戏。精灵来自手绘图鉴，战斗方式参考赛尔号，带有账号、配队、图鉴和星际探索剧情。

## 怎么玩

把仓库下载到电脑（绿色 **Code** 按钮 → **Download ZIP**），解压后双击 `index.html`，用浏览器打开就能玩，不需要安装任何东西。

整个文件夹要保持原样：`index.html`、`css`、`js`、`images` 必须放在同一个目录里。

## 目录结构

```
index.html            页面骨架（各个界面的 HTML），并按顺序加载下面的脚本
css/style.css         全部样式
js/
  data/               游戏数据，平时加内容基本只改这里
    types.js          属性颜色、属性克制表
    moves.js          技能表
    creatures.js      精灵表（种族值、进化、特性、技能列表）
    story.js          星际探索剧本（全部对话）
    wild.js           各星球的野外精灵和区域（出现概率、捕捉率）
    assets.js         图片路径表
    ship-map.js       荆楚号平面图的区域坐标
  engine/             对战规则，和界面无关
    battle.js         能力值、伤害公式、状态、回合流程、道具
    ai.js             电脑怎么选技能、换精灵
    ranked.js         实战段位、电脑强度、配招、公平阵容
  ui/                 界面
    battle-ui.js      竞技对战页面：选精灵、对战画面、动画
    game.js           账号、背包、仓库、黄冈秘鉴、航行日志、星际探索、商城、茶室、任务、每日任务
images/
  sprites/            精灵立绘（最终形态），文件名 = 精灵 id
  pre_sprites/        进化前形态，id_s1 是一阶，id_s2 是二阶
  lineart/            手绘原画扫描
  backgrounds/        剧情、探索、对战背景
  characters/         剧情角色立绘、表情差分、图标
```

`index.html` 里脚本的加载顺序是固定的：数据 → 引擎 → 界面。后面的文件会用到前面文件里定义的东西，所以不要调换顺序。新增 js 文件时也要按这个规则插到合适的位置。

## 常见修改

### 改数值、改技能描述

直接在 `js/data/creatures.js` 或 `js/data/moves.js` 里找到对应的精灵或技能改数字。用编辑器的搜索功能（Mac 上 `Cmd + F`）搜精灵名或技能名最快。

### 新增一只精灵

1. 在 `js/data/creatures.js` 的 `SP` 列表里照着已有的格式加一项。`id` 用英文小写，例如 `fox`。
2. 技能如果是新的，在 `js/data/moves.js` 的 `M` 里加上。精灵的 `moves`、`hidden`、`def` 里写的技能名必须和 `M` 里的完全一致。
3. 把立绘放进 `images/sprites/`，文件名用 id，例如 `fox.png`。
4. 打开 `js/data/assets.js`，在 `SPRITES` 里加一行 `"fox": "images/sprites/fox.png",`。
5. 有进化前形态的话，图片放进 `images/pre_sprites/`，命名为 `fox_s1.png`、`fox_s2.png`，并在 `PRE_SPRITES` 里加对应的行。手绘原画同理，放 `lineart/`，登记在 `LINEART`。

只在账号系统里出现、不参加竞技对战的精灵，加在同一个文件里的 `EXTRA_SP`。

### 改剧情对话

剧本都在 `js/data/story.js`。每个地点是一个列表，一行是一句话，例如：

```js
{ s: 'v', on: [['p', 'l'], ['v', 'r']], t: '{name}！这边这边！' },
```

- `s`：说话人。`n` 是旁白，`p` 是玩家，其他代号见 `js/ui/game.js` 里的 `CAST`
- `t`：台词。`{name}` 会自动换成玩家的名字
- `on`：站在画面上的角色和位置（`l` 左，`r` 右）
- `bg`：切换背景，值是 `BG` 里的名字

新增一个剧情地点时，除了在 `story.js` 里加剧本，还要在 `js/ui/game.js` 的 `SITES` 里登记这个地点。

### 换图片

用同名文件直接覆盖 `images/` 里的旧图即可，代码不用改。如果新图的格式不同（比如 png 换成 webp），记得同步改 `js/data/assets.js` 里的文件名。

## 修改后怎么检查

1. 改完保存，在浏览器里刷新 `index.html`。
2. 如果页面空白或者点了没反应，按 `Cmd + Option + I` 打开开发者工具，看 **Console** 里的红色报错，一般会写出是哪个文件、第几行出了问题。最常见的原因是少了逗号或括号。

## 一起修改的约定

1. 动手改之前在群里说一声，改完提交了再说一声，尽量不要两个人同时改同一个文件。
2. 改之前先拉取仓库里的最新版本。
3. 提交时写清楚改了什么，例如"新增精灵：狐火"、"修复换精灵时血条不刷新"。

## 服务器（联网版）

游戏也部署在一台腾讯云轻量服务器上，用浏览器打开 `http://服务器IP` 就能玩，联网对战也走这台服务器。

```
server/
  server.js           服务器程序：发网页 + 在 /ws 上给联网对战传话
  setup.sh            第一次安装用（装 Node.js、注册成开机自启的服务）
  update.sh           以后更新用
  node_modules/ws     WebSocket 库，直接放进仓库，服务器上不用再 npm install
```

**第一次安装**：在腾讯云控制台登录服务器的网页终端，粘贴运行：

```
sudo git clone --depth 1 https://github.com/Cucumber418/flame1down1 /opt/flame1down1 && sudo bash /opt/flame1down1/server/setup.sh
```

**更新**：代码推到 GitHub 之后，在服务器终端运行 `sudo bash /opt/flame1down1/server/update.sh`。

80 端口被占用时（比如镜像自带了 caddy / nginx），可以换端口安装：`sudo bash /opt/flame1down1/server/setup.sh 8080`，然后在腾讯云防火墙里放行这个端口，用 `http://服务器IP:8080` 打开。

**检查是否在运行**：浏览器打开 `http://服务器IP/ping`，显示 `ok` 就正常；`http://服务器IP/status` 能看到在线人数和房间数。

## 存档

账号、精灵、段位等进度保存在浏览器本地，换电脑或换浏览器不会同步。

注意：浏览器按「网址」分开保存存档。双击 `index.html` 打开的本地版和 `http://服务器IP` 打开的联网版是两份独立的存档，互相看不到。
