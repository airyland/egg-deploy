# egg-deploy


## Install

``` bash
yarn add egg-deploy --dev
```

## Usage

* create `nginx.conf` with upstream block, example:

``` bash
upstream nginxconf {
}

server {
    listen 443;
    ssl on;
    ssl_certificate *.fullchain.cer;
    ssl_certificate_key *.key
    server_name vux.li;
    location / {
        proxy_pass http://nginxconf;
    }
}
```

* edit package.json

``` json
{
  "scripts": {
    "deploy": "egg-deploy"
  }
}
```

then run

``` bash
yarn deploy
```

## Customize

create a config file: `.deploy.yml`, default setting list:

``` yml
instances:
  - 
    port: 8001
    title: 8001 # 自定义标题，避免与同机上其他 eggjs 重名
  -
    port: 8002
    title: 8002
startCommand: service nginx start # nginx 启动命令，运行时若 nginx 未运行会尝试执行
reloadCommand: nginx -s reload # nginx reload 命令
nginxConfig: nginx.conf # nginx 配置地址，可以是绝对地址，如果放置于项目下，记得在 nginx 全局配置里 include
waitStopTime: 5000 # 停止前的等待时间
```

## todo

- [ ] add test
