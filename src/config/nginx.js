const {Config} = require("./config")
const os = require("os")
const path = require("path")
const {format} = require("../util")
const ConfigParser = require('@webantic/nginx-config-parser')
const fs = require("fs-extra")
const nodepath = require("path")

class NginxConfig extends Config {

    constructor() {
        super();
        this.parser = new ConfigParser()
    }

    async parse(content) {
        this.content = await this.parser.parse(content, {parseIncludes: false});

        if(!this.content.server){
            this.content.server = []
        }

        if(!Array.isArray(this.content.server)){
            this.content.server = [
                this.content.server
            ]
        }

        return this.content
    }

    async stringify() {

        let serverlessConfig = {...this.content}
        delete serverlessConfig.server

        return this.parser.toConf(serverlessConfig) + this.content.server.map(el => `server {\n${this.parser.toConf(el)}}`).join("\n")
    }

    addServer(serviceName, hostname){
        this.content[`upstream ${serviceName}`] = {
            "server": `${serviceName}:80`
        }

        this.content.server.push({
                "listen": [80],
                "server_name": hostname,
                "location /": {
                    "proxy_pass": `http://${serviceName}`,
                    "proxy_set_header": [
                        "X-Real-IP          $remote_addr",
                        "X-Forwarded-For    $proxy_add_x_forwarded_for",
                        "Host               $http_host",
                        "X-Forwarded-Host   $host",
                        "X-Forwarded-Server $host"
                    ]
                }
        })
    }
}

module.exports = {
    NginxConfig
}