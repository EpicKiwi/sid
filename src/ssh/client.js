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

    async exec(cmd){
        return await new Promise((res,rej) => {
            let stdout = "";
            let stderr = "";
            let log = "";
            this.connection.exec(cmd, function(err, stream) {
                if (err) return rej(err);
                stream.on('close', function(code, signal) {
                    if(code != 0){
                        let err = new Error("Command return with non-zero code")
                        err.cmd = cmd
                        err.stdout = stdout
                        err.stderr = stderr
                        err.returnCode = code
                        err.signal = signal
                        err.log = log
                        return rej(err)
                    }
                    return res({
                        cmd,
                        stdout,
                        stderr,
                        signal,
                        log,
                        returnCode: code
                    })
                }).on('data', function(data) {
                    stdout += data
                    log += data
                }).stderr.on('data', function(data) {
                    stderr += data
                    log += data
                });
            });
        })
    }

    async sendFile(localPath, remotePath, options){
        return await new Promise((res,rej) => {
            this.connection.sftp(function(err, sftp) {
                if (err) return rej(err);
                sftp.fastPut(localPath, remotePath, options, err => {
                    if(err) return rej(err)
                    return res()
                })
            });
        })
    }

    async getFile(remotePath, localPath, options= {}){
        return await new Promise((res,rej) => {
            this.connection.sftp(function(err, sftp) {
                if (err) return rej(err);
                sftp.fastGet(remotePath, localPath, options, err => {
                    if(err) return rej(err)
                    return res()
                })
            });
        })
    }

    disconnect(){
        this.connection.end()
    }

}

module.exports = {
    SshClient
}