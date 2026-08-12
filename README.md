# 深情.club

一个使用 Cloudflare Pages Functions、Turnstile 和 D1 的登录网站，主界面是一张登录后可见的全屏图片。

## 本地预览

完整功能需要通过 Wrangler Pages 开发服务器预览：

```sh
wrangler pages dev .
```

然后访问 `http://localhost:4173`。

注册时必须通过 Cloudflare Turnstile。账号存储在 Cloudflare D1，密码使用带随机盐的 PBKDF2-SHA-256 哈希保存，会话通过安全的 HttpOnly Cookie 管理。

## 免费上线方案

推荐使用 GitHub + Cloudflare Pages：

1. 在 GitHub 创建一个新仓库，例如 `shenqing-club`。
2. 把本目录提交并推送到 GitHub。
3. 在 Cloudflare Dashboard 进入 `Workers & Pages`，创建 Pages 项目。
4. 选择 `Connect to Git`，连接刚才的 GitHub 仓库。
5. 构建设置保持静态站默认值：
   - Framework preset: `None`
   - Build command: 留空
   - Build output directory: `/`
6. 部署成功后，在 Pages 项目的 `Custom domains` 添加 `深情.club`。
7. 如果你也想让 `www.深情.club` 可访问，再添加一个 `www.深情.club`。
8. 按 Cloudflare 给出的提示，到 22.cn 修改域名 DNS。

## 22.cn 域名绑定

Cloudflare 通常会给出两条 nameserver。到 22.cn 域名管理后台，把 `深情.club` 的 DNS 服务器改成 Cloudflare 提供的那两条。

中文域名在 DNS 系统里也会显示为 punycode：

- `深情.club` = `xn--feu160a.club`
- `www.深情.club` = `www.xn--feu160a.club`

DNS 生效可能需要数分钟到 24 小时。Cloudflare 识别成功后，会自动签发 HTTPS 证书。

参考：

- Cloudflare Pages Git 集成：https://developers.cloudflare.com/pages/get-started/git-integration/
- Cloudflare Pages 自定义域名：https://developers.cloudflare.com/pages/configuration/custom-domains/
- Cloudflare 修改 nameserver：https://developers.cloudflare.com/dns/zone-setups/full-setup/setup/
- 22.cn 修改 DNS 服务器：https://www.22.cn/help_33.html
