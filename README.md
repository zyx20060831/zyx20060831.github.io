# Tracy Reznik 个人网站迁移

公开页面位于 `public/`，后端位于 `backend/`。GitHub 仓库保存公开页面和不含私人数据的后端代码。

当前状态：Cloudflare 授权成功，D1 已创建并初始化，Worker 已部署，受限资料已存入 Worker Secret。生产健康检查返回 200，匿名受限页面返回 401 且没有受限值。GitHub OAuth 凭据和完整登录验证仍待完成，GitHub Pages 暂不启用。原 Sites 网站继续服务。

后端地址：`https://tracy-reznik-access.kuoyi-0705.workers.dev`。

GitHub OAuth 应用名称：`Tracy Reznik Access`；主页：`https://zyx20060831.github.io/`；Redirect URI：`https://tracy-reznik-access.kuoyi-0705.workers.dev/auth/callback`。不启用通配符或 Device Flow，登录仅用于读取 GitHub 公开身份。

## 访问设计

- GitHub Pages 展示四栏：关于我、个人信息、教育经历、个人爱好。
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
3. 创建 GitHub OAuth App：主页 `https://zyx20060831.github.io/`；回调地址为部署结果的实际后端域名加 `/auth/callback`。
4. 通过 Cloudflare 的秘密设置或 `wrangler secret put` 设置 `GITHUB_CLIENT_ID` 和 `GITHUB_CLIENT_SECRET`。`PRIVATE_PROFILE_JSON` 已配置；不在仓库中保存真实值。
5. `PRIVATE_PROFILE_JSON` 格式为 `{ "information": [{ "label": "字段", "value": "内容" }], "education": [{ "period": "年份", "school": "学校", "description": "说明" }] }`。
6. 公开页面已接入实际后端地址。
7. 在 GitHub 仓库将公开文件放入 `docs/`，Pages 来源设置为 `main` 分支的 `/docs`。
8. 验证管理员登录、访客申请、批准、拒绝、撤销，以及未批准者无法读取受限值，再交付新网址。

## 已验证

真实 Workers 本地运行时 + D1 权限测试：匿名访问、伪造身份头、过期会话、访客管理员隔离、跨站请求与 CSRF、批准和撤销、申请说明 HTML 转义、OAuth state / PKCE、退出登录。

生产匿名访问验证通过。完整 GitHub OAuth 回调和管理员登录仍需完成登录凭据配置后验证。
