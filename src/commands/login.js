const os = require("os")
const {Command} = require("@oclif/command")
const {OclifSshClient} = require("../ssh/oclif-client")
const {ClientConfig} = require("../config/client")
const {cli} = require("cli-ux")

class LoginCommand extends Command {
    async run(){
        const args = this.parse(LoginCommand)
        const {username, hostname, port} = args.args.loginString

        // Loading config end checking already existing config
        let config = new ClientConfig(this.config.configDir)
        await config.readFromFile()

        if(config.content.deploymentServer){
            let {username, hostname, port} = config.content.deploymentServer
            this.warn(`A deployment server (${username}@${hostname}:${port}) is already configured and will be overwritten`)
            let overwrite = await cli.confirm("Do you want to continue [y/N]")
            if(!overwrite){
                this.exit(1)
            }
        }

        // checking connection to the server
        this.log(`Logging in to ${username}@${hostname}:${port}...`)
        let ssh = new OclifSshClient(this, hostname, username, port)
        try {
            await ssh.connect()
        } catch(e){
            this.error(`Login failed with provided Key or Password (${e.message})`, {exit:1})
        }
        ssh.disconnect()

        // Saving config
        config.content.deploymentServer = {
            username,
            hostname,
            port
        }
        await config.writeToFile()

        this.log(`Successfully logged in, configuration saved`)
    }
}

LoginCommand.description = `Login to deployment server and save it for future deployments

Login using SSH to a deployment server running Docker and Nginx.
Save this login for the current user for future deployment.
`

LoginCommand.args = [
    {
        name: "loginString",
        required: true,
        description: "String describing the server to log in to (format: [username]@[hostname]:[port])",
        parse(content){
            const match = content.match(/^(?:([^@]+)@)?([^:]+)(?::([0-9]+))?$/)
            if(!match)
                throw new Error("Parameter must be in the format  [username]@[hostname]:[port]")
            return {
                username: match[1] ? match[1] : os.userInfo().username,
                hostname: match[2],
                port: match[3] ? parseInt(match[3]) : 22
            }
        }
    }
]

module.exports = LoginCommand