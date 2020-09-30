const fs = require("fs-extra")
const nodepath = require("path")

class Config {
    constructor() {
        this.content = this.defaultContent
    }

    get defaultContent() {
        return null
    }


    get defaultPath(){
        return null
    }

    get fileExtension(){
        return ".json"
    }

    async readFromFile(path = null){

        if(!(path || this.defaultPath)){
            throw new Error("Config file path must be provided or `get defaultPath()` must be defined")
        }

        if(!path){
            path = this.defaultPath
        }

        try {
            const rawContent = await fs.readFile(path)

            await this.parse(rawContent)
        } catch (e){
            if(e.code !== "ENOENT"){
                throw e
            }
        }

    }

    async parse(content){
        return this.content = JSON.parse(content)
    }

    async stringify(){
        return JSON.stringify(this.content, null, 4)
    }

    async writeToFile(path = null){

        if(!(path || this.defaultPath)){
            throw new Error("Config file path must be provided or `get defaultPath()` must be defined")
        }

        if(!path){
            path = this.defaultPath
        }

        await fs.mkdirp(nodepath.dirname(path))
        await fs.writeFile(path, await this.stringify())
    }
}

module.exports = {
    Config
}