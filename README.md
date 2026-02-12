# Happy New Year 手势烟花 + 回忆页面

两个食指相触触发烟花特效，配合时间轴形式的回忆展示页面。

---

## 本地运行

本项目依赖 fetch 读取本地 JSON 文件，请勿直接双击 index.html 打开（file:// 协议下无法工作）。

建议通过本地 HTTP 服务器运行：

# Python
python3 -m http.server 5173

# Node
npx serve . -l 5173

访问 http://localhost:5173

---

## 内容配置

所有可编辑内容集中在两个 JSON 文件中，无需修改 JavaScript 代码。

### 回忆页配置：assets/memories.json

| 字段 | 说明 |
|------|------|
| page.heroTitle | 回忆页主标题 |
| page.heroSubtitle | 副标题 |
| bgm | 烟花阶段背景音乐 |
| memoryBgm | 进入回忆页后的背景音乐 |
| backgroundVideo | 回忆页剪影背景视频 |
| chapters | 时间轴章节数组 |

chapters 结构示例：

{
  "time": "2023 夏",
  "title": "一起去海边",
  "text": "那几天没涂防晒，你后背晒红了",
  "items": [
    {
      "type": "image",
      "src": "./assets/memories/beach.jpg",
      "title": "傍晚拍的",
      "desc": "你说这张像电影截图"
    }
  ]
}

items 支持 type: image / video。

参考文件：assets/memories_sample.json

### 信件配置：assets/letter.json

| 字段 | 说明 |
|------|------|
| title | 信件标题 |
| paragraphs | 正文段落数组 |
| buttonText | 按钮文案 |

参考文件：assets/letter_sample.json

---

## 资源路径说明

建议按以下目录存放资源文件：

- 音频文件：assets/
- 图片/视频：assets/memories/

JSON 中填写相对路径：

./assets/bgm.mp3
./assets/memories/photo-1.jpg

---

## 交互流程

1. 资源预加载（进度条）
2. 用户授权摄像头
3. 检测到双食指同时伸出 → 烟花特效 → 2026 格子逐一亮起
4. 烟花结束 → 展示信件
5. 点击“收下这封信” → 切换 BGM → 进入回忆页（时间轴视图）

---

## 目录结构

.
├── index.html
├── style.css
├── main.js
├── assets/
│   ├── memories.json      # 回忆页配置
│   ├── letter.json        # 信件配置
│   ├── bgm.mp3
│   ├── bgm-memory.mp3
│   └── memories/          # 照片、视频素材

---

## 维护说明

本项目中 main.js 为核心逻辑文件，不建议直接修改。内容维护仅需编辑 assets/ 目录下的两个 JSON 文件，按格式填充即可。

图片、视频素材请统一存放于 assets/memories/ 目录，路径填写时注意以 ./ 开头。