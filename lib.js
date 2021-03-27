'use strict'

const path = require('path')
const fs = require('fs')
const { promisify } = require('util')
const shell = require('shelljs')
const yml = require('js-yaml')
const NginxManager = require('nginx-upstream')
const chalk = require('chalk')
const http = require('http')
const cwd = process.cwd()
const { sleep, checkUp } = require('./helper')

const config = {
  instances: [{
    port: 8001,
    title: 8001
  }, {
    port: 8002,
    title: 8002
  }],
  runningInstances: [],
  startCommand: 'service nginx start',
  reloadCommand: 'nginx -s reload',
  nginxConfig: 'nginx.conf',
  waitStopTime: 5000
}

const info = function (str) {
  console.log(chalk.green(str))
}

const warn = function (str) {
  console.log(chalk.yellow(str))
}

const error = function (str) {
  console.log(chalk.red(str))
}

const configPath = path.join(cwd, '.deploy.yml')

if (fs.existsSync(configPath)) {
  const localConfig = yml.safeLoad(fs.readFileSync(configPath, 'utf8'))
  if (localConfig) {
    Object.assign(config, localConfig)
  }
}

// check if nginx config exists
let nginxConfPath = path.join(cwd, config.nginxConfig)
if (path.isAbsolute(config.nginxConfig)){
  nginxConfPath = config.nginxConfig
}
if (!fs.existsSync(nginxConfPath)) {
  error('[deploy] nginx conf not found, exit;')
  shell.exit(1)
}

const nginxManager = new NginxManager(nginxConfPath, 50)
const libs = {}
const names = ['backendList', 'addBackend', 'removeBackend', 'toggleBackend']

names.forEach(name => {
  libs[name] = promisify(nginxManager[name]).bind(nginxManager)
})

;(async function () {
  // if no upstream, append all
  const list = await libs.backendList()

  let shouldReload = false
  if (!list.length && config.instances) {
    info('[deploy info] initializing, appending all upstream;')
    for (let i = 0; i < config.instances.length; i++) {
      const instance = config.instances[i]
      try {
        await libs.addBackend(`localhost:${instance.port}`)
      } catch (e) {
        console.log(e)
      }
    }
    shouldReload = true
  }

  // if no instances found
  if (!config.instances.length) {
    info('[deploy info] no instances found, exit;')
    shell.exit(1)
  }

  if (config.instances === 1) {
    info('[deploy info] at least two instances are needed, exit;')
    shell.exit(1)
  }

  // check whether nginx has installed
  if (!shell.which('nginx')) {
    info('[deploy info] nginx not found, exit;')
    shell.exit(1)
  }

  // reload nginx
  if (shouldReload) {
    const reload = shell.exec(config.reloadCommand)
    if (reload.code !== 0) {
      if (reload.stderr.includes('open() "/usr/local/var/run/nginx.pid" failed')) {
        info('[deploy info] nginx is not started, try to start;')
        const start = shell.exec(config.startCommand)
      } else {
        info('[deploy info] nginx reload fail, exit;')
        shell.exit(1)
      }
    } else {
      info('[deploy info] nginx reloaded;')
    }
  }

  for (let i = 0; i < config.instances.length; i++) {
    const instance = config.instances[i]

    // remove backend from nginx and reload
    info(`[deploy info] remove backend:${instance.title} from nginx;`)
    try {
      await libs.removeBackend(`localhost:${instance.port}`)
    } catch (e) {
      warn(`[deploy warn] instance:${instance.title} not found, ignore;`)
    }
    info(`[deploy info] reload nginx;`)
    shell.exec(config.reloadCommand)

    // stop backend
    info(`[deploy info] wait ${config.waitStopTime}ms before stop backend;`)
    await sleep(config.waitStopTime)
    shell.exec(`npx egg-scripts stop --ignore-stderr --title=${instance.title}`)

    // start backend
    info(`[deploy info] start backend:${instance.title};`)
    let eggScripts = `npx egg-scripts start --ignore-stderr --daemon --title=${instance.title} --port=${instance.port}`
    if (config.workers) {
      eggScripts = `npx egg-scripts start --ignore-stderr --workers=${config.workers} --daemon --title=${instance.title} --port=${instance.port}`
    }
    console.log('command: ', eggScripts)
    const start = shell.exec(eggScripts)
    if (start.code !== 0) {
      error(`[deploy error] start instance:${instance.title} fail, please check errors and fix it, exit;`)
      shell.exit(1)
    }

    await checkUp(`http://localhost:${instance.port}`)

    // append backend to nginx and reload
    await libs.addBackend(`localhost:${instance.port}`)
    shell.exec(config.reloadCommand)

    // done for current backend
    info(`[deploy info] instance:${instance.title} reload done;`)
  }

  if (config.runningInstances && config.runningInstances.length) {
    for (const instance of config.instances) {
      try {
        console.log('remove backend:', `${instance.port}`)
        await libs.removeBackend(`localhost:${instance.port}`)
      } catch (e) {
        console.log('remove all backends', e)
      }
    }

    for (const instance of config.runningInstances) {
      try {
        console.log('add backend:', `${instance.port}`)
        await libs.addBackend(`localhost:${instance.port}`)
      } catch (e) {
        console.log('add backend', e)
      }
    }
    // shell.exec(config.reloadCommand)
  }
})()
