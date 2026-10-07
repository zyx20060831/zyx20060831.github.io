# Tracy Reznik 个人网站迁移

公开页面位于 `public/`，后端位于 `backend/`。GitHub 仓库保存公开页面和不含私人数据的后端代码。

当前状态：迁移已上线。公开主页为 https://zyx20060831.github.io/ ，GitHub Pages 来源为 main 分支的 /docs。Cloudflare D1 / Worker 和 GitHub OAuth 凭据已配置，受限资料保存于 Worker Secret。生产 GitHub OAuth 回调、管理员登录及审批页面均已验证成功。原 Sites 网站继续服务。

后端地址：`https://tracy-reznik-access.kuoyi-0705.workers.dev`。

GitHub OAuth 应用名称：`Tracy Reznik Access`；主页：`https://zyx20060831.github.io/`；Redirect URI：`https://tracy-reznik-access.kuoyi-0705.workers.dev/auth/callback`。不启用通配符或 Device Flow，登录仅用于读取 GitHub 公开身份。

## 访问设计

- GitHub Pages 展示六栏：关于我、个人信息、教育经历、个人爱好、Tracy 的动态、问问 Tracy。
- 第一和第四个邮箱、QQ、微信、真实生日、南京大学之前的教育经历不会进入公开页面或 GitHub 仓库。
- 访客从公开页面进入 Cloudflare 的受限信息页面，使用 GitHub 登录并提交申请。
- 管理员由 GitHub 固定账号 ID `242745826` 识别，用户名变化不改变身份。
- 管理员审批后，服务器才读取并发送受限信息。撤销权限后后续请求不能再次读取。
- 登录会话保存在服务器 D1 中，浏览器仅有 HttpOnly、Secure、SameSite=Lax 的随机会话 cookie。
- 在同一后端域名完成登录和受限页面查看，避免跨站 cookie 限制。
- 旧 ChatGPT 身份与 GitHub 身份不同，已有批准记录不自动映射；访客需在新系统重新申请。

## 生产配置顺序

1. 已创建 `tracy-reznik-access` D1，并将数据库 ID 填入 `backend/wrangler.jsonc`。
2. 已初始化数据库并部署 Worker；后续代码变更可在 `backend/` 运行 `npm ci` 和 `npm run deploy`。
3. 已创建 GitHub OAuth App：主页 `https://zyx20060831.github.io/`；回调地址 `https://tracy-reznik-access.kuoyi-0705.workers.dev/auth/callback`。
4. `GITHUB_CLIENT_ID`、`GITHUB_CLIENT_SECRET` 和 `PRIVATE_PROFILE_JSON` 均已配置于 Cloudflare。真实密钥和受限资料不在仓库中保存。
5. `PRIVATE_PROFILE_JSON` 格式为 `{ "information": [{ "label": "字段", "value": "内容" }], "education": [{ "period": "年份", "school": "学校", "description": "说明" }] }`。
6. 公开页面已接入实际后端地址。
7. 公开文件已放入 `docs/`，Pages 来源已设置为 `main` 分支的 `/docs`。
8. 管理员使用自己的 GitHub 账号登录，进入后端 `/admin` 审批访客。公开内容可通过聊天修改或直接修改仓库 `docs/index.html` 后发布。

## 动态与提问

- `/admin/moments`：管理员发布文字和照片，编辑、移入回收站及恢复；每条最多 9 张，客户端自动缩小至最长边 1600 像素、压缩至每张最多 600 KB。支持公开或仅已批准访客可见。
- 照片压缩后存入 D1 独立 BLOB 行，不放入 GitHub 仓库。当前适合少量个人照片；大量照片应迁往对象存储。图片读取时再次检查动态可见范围、审批状态和回收站状态；禁止缓存私密图片。
- `/admin/questions`：回复匿名或 GitHub 昵称署名的问题。未回复或未勾选公开的问题不会展示在主页；关闭可恢复。
- 匿名提问不保存账号身份，反滥用仅保存按小时计算的地址散列；每小时最多 5 条。提问者用独立随机查询链接查看回复，数据库仅保存查询令牌的散列。
- `/api/moments` 与 `/api/questions` 只返回公开内容，跨域读取限定主页。原有私人联系信息和教育经历权限保持生效。
- 邮箱地址使用 `mailto:` 打开写信窗口，另提供对应邮箱网页版入口。

## 已验证的社交功能

本地真实 Workers + D1 测试覆盖照片上传和字节读取、照片与动态权限同步、撤销后的图片访问、动态编辑和回收站恢复、重复发布去重、格式和大小限制；匿名及署名提问、账号身份隔离、私密查询、公开审批、关闭与恢复、CSRF 和提问频率限制。

真实 Workers 本地运行时 + D1 权限测试：匿名访问、伪造身份头、过期会话、访客管理员隔离、跨站请求与 CSRF、批准和撤销、申请说明 HTML 转义、OAuth state / PKCE、退出登录。

生产浏览器验证：公开主页展示六栏和插画版权信息；匿名与 GitHub 署名提问均实际提交成功，管理员实际保存回复，勾选公开的匿名问答在主页展示，私密署名问答不进入公开列表。测试提问随后关闭，可在后台恢复。

生产照片表单实际完成选择 PNG、自动压缩预览、发布和保存为仅批准访客可见的动态。匿名直接读取该测试图片返回 404（隐藏存在性），公开动态接口排除测试照片。测试动态随后移入回收站，保留恢复能力。

原表单失败由 `Referrer-Policy: no-referrer` 导致原生提交使用不透明 Origin 引起；普通表单页面改用 `same-origin`，保留严格 Origin 与 CSRF 校验，私密查询页面仍使用 `no-referrer`。回归测试验证了正常策略和拒绝 `Origin: null`。

背景移除白色渐变遮罩，内容卡片透明，以文字阴影保持阅读清晰；插画版权署名保留。

匿名受限访问返回 401、不含受限值；真实 GitHub OAuth 回调成功，账号 `zyx20060831` 被识别为管理员，可查看受限资料并打开申请管理页面。尚未使用第二个真实 GitHub 账号完成访客全流程；访客申请、批准及撤销逻辑已由本地 Workers + D1 测试覆盖。
