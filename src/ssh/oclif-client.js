const {cli} = require("cli-ux");
const {SshClient} = require("./client");

class OclifSshClient extends SshClient {

    constructor(oclifCommand, ...args) {
        super(...args);
        this.command = oclifCommand
    }

    async connect() {
        try {
            return await super.connect();
        } catch(e) {
            const password = await cli.prompt(`Password for ${this.username}@${this.hostname}`, {type: "hide"})
            return await super.connect(password);
        }
    }

}

module.exports = {
    OclifSshClient
}