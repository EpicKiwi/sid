const {Config} = require("./config")
const os = require("os")
const path = require("path")
const {format} = require("../util")

class ServerConfig extends Config{

    constructor(cacheDir, vars={}) {
        super();
        this.cacheDir = cacheDir
        this.vars = vars
    }

    get defaultPath(){
        return path.join(this.cacheDir,`server${this.fileExtension}`)
    }

    get defaultContent(){
        return {
            nginxContainerName: "main-nginx",
            nginxConfigFile: "/etc/nginx/conf.d/sid-{username}.conf",
            domainName: "{id}-{name}.example.org",
            dockerNetwork: "sid"
        }
    }

    async parse(content) {
        this.content = await super.parse(content);
        this.varContent = {
            ...this.content,
            nginxConfigFile: format(this.content.nginxConfigFile, this.vars),
            domainName: format(this.content.domainName, this.vars)
        }
        return this.content
    }
}

module.exports = {
    ServerConfig
}