const axios = require('axios')
const CHECK_TIME = 5000
const TIMEOUT = 60000

const sleep = function (time) {
  return new Promise((resolve) => {
    setTimeout(resolve, time)
  })
}

async function checkup(url) {
  return new Promise(async (resolve, reject) => {
    let up = false
    const startTime = new Date().getTime()
    while (!up) {
      if (new Date().getTime() - startTime > TIMEOUT) {
        up = true
        return reject('check up fail')
      }
      try {
        console.log('检查是否在线: ', url)
        await axios.get(url)
        console.log('已经在线')
        up = true
      } catch (e) {
        console.log(e.message)
        await sleep(CHECK_TIME)
      }
    }
    console.log('duration:', new Date().getTime() - startTime)
    resolve()
  })
}

module.exports = {
  sleep,
  checkup
}
