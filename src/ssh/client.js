const Client = require("ssh2").Client
const os = require("os")
const fs = require("fs-extra")
const path = require("path")

class SshClient {

    constructor(hostname, username= null, port= 22) {
        this.connection = null
        this.isReady = false
        this.isClosed = false

        this.hostname = hostname
        this.username = username
        this.port = port
    }

    async connect(password = null){
        if(this.connection && !this.isClosed){
            return
        }

        this.connection = new Client()
        this.isReady = false
        this.isClosed = false

        let privateKey;
        try {
            privateKey = await fs.readFile(path.join(os.homedir(), ".ssh/id_rsa"))
        } catch(e){
            if(!password){
                let error = new Error("Please generate a private key to this server")
                error.code = "NOPKNOPW"
                throw error
            }
        }

        await new Promise((resolve,reject) => {
            this.connection.on("ready", () => {
                return resolve()
            }).on("error", e => {
                return reject(e)
            }).on("end", () => {
                this.isClosed = true
                this.isReady = false
            }).on("close", () => {
                this.isClosed = true
                this.isReady = false
            })

            this.connection.connect({
                host: this.hostname,
                username: this.username,
                port: this.port,
                privateKey,
                password
            })
        })
    }

    disconnect(){
        this.connection.end()
    }

}

module.exports = {
    SshClient
}