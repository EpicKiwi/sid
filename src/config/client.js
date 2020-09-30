const {Config} = require("./config")
const os = require("os")
const path = require("path")

class ClientConfig extends Config{

    constructor(configDir) {
        super();
        this.configDir = configDir
    }

    get defaultPath(){
        return path.join(this.configDir,`user${this.fileExtension}`)
    }

    get defaultContent(){
        return {
            deploymentServer: null
        }
    }

}

module.exports = {
    ClientConfig
}