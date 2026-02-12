# Happy New Year 手势烟花 + 回忆页面 ✨

一个“互动烟花 + 浪漫回忆”的静态前端项目 (๑˃̵ᴗ˂̵)ﻭ

---

## 1) 快速启动

> 请使用本地 HTTP 服务启动，不能直接双击 `index.html`（`file://` 下无法读取 JSON）。

### Python

```bash
python3 -m http.server 5173
```

### Node

```bash
npx serve . -l 5173
```

浏览器访问：

```text
http://localhost:5173
```

---

## 2) 只改 JSON 即可维护内容

### 回忆页配置：assets/memories.json

| 字段 | 说明 |
| ------ | ------ |
| page.heroTitle | 回忆页主标题 |
| page.heroSubtitle | 顶部副标题 |
| bgm | 烟花阶段 BGM |
| memoryBgm | 进入回忆页后的 BGM |
| enableBackgroundVideo | 是否启用背景视频（true/false） |
| backgroundVideo | 背景视频路径 |
| chapters | 时间轴章节数组 |

章节结构（示例）：

```json
{
  "time": "记忆 · 01",
  "title": "一起去海边",
  "text": "那天下午的风很温柔。",
  "items": [
    {
      "type": "image",
      "src": "./assets/memories/01.jpg",
      "title": "海边",
      "desc": "你笑得很好看"
    }
  ]
}
```

### 信件配置：assets/letter.json

| 字段 | 说明 |
| ------ | ------ |
| title | 信件标题 |
| paragraphs | 正文段落数组 |
| buttonText | 按钮文案 |

---

## 3) 主要技术原理与实现

### A. 手势识别与烟花互动

- 使用 MediaPipe Hands 识别双手食指指尖坐标。
- 通过“距离 + 相对速度 + 连续帧稳定性”判断摩擦点火。
- 粒子系统使用重力与阻力更新

### B. 资源预加载

- 首屏先读取 JSON，再预加载图片/视频/BGM。
- 使用进度条显示加载百分比，加载完成后才允许开启摄像头。

### C. 回忆页时间轴与动效

- 时间轴章节按 JSON 动态渲染。
- 顶部标题和 BGM 按钮固定在最上方。
- 卡片与章节入场动画使用轻量 transform/opacity，避免重滤镜卡顿。
- 飘动爱心使用定时器持续生成，营造浪漫氛围 (♡˙︶˙♡)

### D. 性能优化点

- 图片使用 `loading="lazy"` + `decoding="async"`。
- 章节使用 `content-visibility` 降低长列表渲染成本。
- 点击信件后关闭摄像头并释放烟花页面资源，减少内存和 GPU 压力。

---

## 4) 交互流程

1. 进入页面后先预加载资源（显示进度）
2. 点击开启摄像头
3. 双食指互动点燃烟花，点亮 `2026` 格子
4. 展示信件
5. 点击“收下这封信”进入回忆页并切换 BGM
6. 滑到页面底部触发小彩蛋 🎁

---

## 5) 项目结构

```text
.
├── index.html
├── style.css
├── main.js
└── assets/
    ├── memories.json
    ├── letter.json
    ├── bgm.mp3
    ├── bgm-memory.mp3
    └── memories/
```

---

## 6) 常见问题

- 摄像头打不开：请确认使用 `localhost`，并授予浏览器摄像头权限。
- 图片不显示：检查文件名和路径（大小写要一致）。
- 滚动卡顿：优先压缩超大分辨率图片，建议单图宽度控制在 2000px 内。

祝你们的回忆页越做越浪漫 ✨(｡•̀ᴗ-)✧
