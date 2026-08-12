# 深情.club

一个极简静态网站，当前内容是一张登录后可见的全屏图片。

## 本地预览

直接打开 `index.html` 即可预览；也可以在当前目录运行：

```sh
python3 -m http.server 4173
```

然后访问 `http://localhost:4173`。

首次访问先切换到“注册”创建本地账号，之后即可登录进入主界面。账号信息保存在当前浏览器本地，适合静态站演示使用。

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
