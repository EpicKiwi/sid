const {Command, flags} = require("@oclif/command")
const path = require("path")
const {ClientConfig} = require("../config/client")
const {ServerConfig} = require("../config/server")
const {NginxConfig} = require("../config/nginx");
const chalk = require("chalk")
const {OclifSshClient} = require("../ssh/oclif-client");
const Listr = require("listr")
const fs = require("fs-extra")
const uuid = require("uuid")
const os = require("os")
const tar = require("tar")

class DeployCommand extends Command {

    async run() {

        const args = this.parse(DeployCommand)

        const config = new ClientConfig(this.config.configDir)
        await config.readFromFile()

        const serverConfig = new ServerConfig(this.config.cacheDir)

        const nginxConfig = new NginxConfig()

        if(!config.content.deploymentServer){
            this.error( "No deployment server configured\n" +
                        "please login to your server with\n" +
                        "\n" +
                        "   sid login user@example.org:22\n", {exit: 1})
        }

        const {username, hostname, port} = config.content.deploymentServer

        const id = uuid.v4().replace(/^.+-([^-]+)$/, "$1");

        const projectFolder = args.args.deployDirectory
        const dirname = path.basename(args.args.deployDirectory)
        const projectFolderSlug = dirname.toLowerCase().replace(/\s/ig, "-")
        const dockerfileName = args.flags.dockerfile
        const dockerfile = path.join(projectFolder, dockerfileName)
        const tempFolderName = `sid-${projectFolderSlug}-${id}`
        const tempFolder = path.join(os.tmpdir(), tempFolderName)
        const imageTag = `sid-${username}/${projectFolderSlug}:${id}`
        const deploymentDate = new Date()
        const deploymentName = `sid-${username}-${projectFolderSlug}-${deploymentDate.getFullYear()}-${deploymentDate.getMonth()}-${deploymentDate.getDay()}-${id}`

        serverConfig.vars = {
            name: projectFolderSlug,
            id: id,
            username: username,
            date: `${deploymentDate.getFullYear()}-${deploymentDate.getMonth()}-${deploymentDate.getDay()}`
        }

        this.log(`Deploying ${chalk.bold(dirname)} to ${chalk.bold(`${username}@${hostname}:${port}`)}`)

        let ssh = new OclifSshClient(this, hostname, username, port)
        try {
            await ssh.connect()
        } catch(e) {
            this.error(`Login failed with provided Key or Password (${e.message})`, {exit:1})
        }

        this.log("")

        const cleanupTasks = {
            title: "Cleaning up",
                task: (ctx, task) => {
                    if(args.flags["no-cleanup"]){
                        return task.skip("Cleanup skipped by flag")
                    }
                    return new Listr([

                {title: "Cleaning up cache files",
                    task: async () => await fs.remove(path.join(this.config.cacheDir, `${id}-server-config.conf`))},

                {title: "Cleaning local directories",
                    task: async (ctx, task) => {
                        if(args.flags["no-local-cleanup"]){
                            return task.skip("Local cleanup skipped by flag")
                        }
                        return await fs.remove(tempFolder)
                    }},

                {title: `Cleaning up remote directories`,
                    task: async () => {
                        if(args.flags["no-remote-cleanup"]){
                            return task.skip("Remote cleanup skipped by flag")
                        }
                        await ssh.exec(`rm -rf "/tmp/${tempFolderName}"`)
                    }},

                ])
            }
        }

        const tasks = new Listr([
            {title: `Checking ${chalk.bold(dirname)} structure`,
             task: () => new Listr([

                 {title: `Checking Dockerfile`,
                  task: async () => {
                    let exists = await fs.pathExists(dockerfile)
                     if(!exists)
                         throw new Error("Project must contain a Dockerfile")
                 }},

                 {title: `Downloading server configuration`,
                     task: async (ctx, task) => {
                         const remoteConfigPath = "/etc/sid/server.json"
                         task.title = `${task.title} (${chalk.bold(remoteConfigPath)})`
                         await fs.ensureDir(this.config.cacheDir)
                         await ssh.getFile(remoteConfigPath, path.join(this.config.cacheDir, "server.json"))
                         await serverConfig.readFromFile()
                     }},

                 {title: `Checking server permission`,
                     task: async (ctx, task) => {
                         const remoteConfigPath = serverConfig.varContent.nginxConfigFile
                         task.title = `${task.title} (${chalk.bold(remoteConfigPath)})`
                         try {
                             await ssh.getFile(remoteConfigPath, path.join(this.config.cacheDir, `${id}-server-config.conf`))
                         } catch(e) {
                             await ssh.exec(`touch "${remoteConfigPath}"`)
                             return
                         }
                         await ssh.sendFile(path.join(this.config.cacheDir, `${id}-server-config.conf`), remoteConfigPath)
                     }}

             ])},

            {title: "Preparing deployment",
             task: () => new Listr([

                 {title: `Creating temp folder`,
                  task: async () => {
                      await fs.ensureDir(tempFolder)
                      await fs.ensureDir(path.join(tempFolder, "project"))
                  }},

                 {title: `Project name ${chalk.bold(projectFolderSlug)}`,
                     task: async () => await fs.writeFile(path.join(tempFolder, "project", `sid-project.txt`), projectFolderSlug)},

                 {title: `Project id ${chalk.bold(id)}`,
                     task: async () => await fs.writeFile(path.join(tempFolder, "project", `sid-id.txt`), id)},

                 {title: `Copying project`,
                     task: async () => await fs.copy(projectFolder, path.join(tempFolder, "project"), {
                         filter: src => !path.basename(src).startsWith(".")
                     })},

                 {title: `Compressing project`,
                     task: async () => await tar.create({
                         gzip: true,
                         file: path.join(tempFolder, "project.tar.gz"),
                         cwd: tempFolder
                     }, ["project"] )
                 },

                 {title: `Preparing server`,
                  task: async () => ssh.exec(`mkdir -p "/tmp/${tempFolderName}"`)},

             ])},

            {title: "Deployment",
             task: () => new Listr([

                 {title: "Transmitting project",
                  task: async () => await ssh.sendFile(path.join(tempFolder, "project.tar.gz"), `/tmp/${tempFolderName}/project.tar.gz`)},

                 {title: "Extracting project",
                     task: async () => await ssh.exec(`tar -xf /tmp/${tempFolderName}/project.tar.gz -C /tmp/${tempFolderName}`)},

                 {title: "Building docker image",
                     task: async () => await ssh.exec(`docker build "/tmp/${tempFolderName}/project" -f "/tmp/${tempFolderName}/project/${dockerfileName}" -t "${imageTag}"`)},

                 {title: "Starting container",
                     task: async () => await ssh.exec(`docker run -d \\
                                                            --name "${deploymentName}" \\
                                                            -l "sid-deployment=true" \\
                                                            -l "sid-date=${deploymentDate.toJSON()}" \\
                                                            -l "sid-project=${projectFolderSlug}" \\
                                                            -l "sid-deployment-id=${id}" \\
                                                            -l "sid-user=${username}" \\
                                                            --restart on-failure:3 \\
                                                            --network "${serverConfig.varContent.dockerNetwork}" \\
                                                            "${imageTag}"`)},

                 {title: "Checking container status",
                     task: async () => {
                         await new Promise(res => setTimeout(res, args.flags["check-time"]*1000));
                         let res = await ssh.exec(`docker inspect "${deploymentName}"`)
                         let deploymentResult = JSON.parse(res.stdout)
                         if(!deploymentResult[0].State.Running){
                             let err = new Error("Deployment failed, container crashed")
                             let res = await ssh.exec(`docker logs "${deploymentName}"`)
                             err.log = res.log
                             err.code = deploymentResult[0].State.ExitCode
                             throw err
                         }
                     }},

                 {title: "Registering service",
                    task: async () => {
                        const localFolder = path.join(tempFolder, `server-config.conf`)
                        await ssh.exec(`cp "${serverConfig.varContent.nginxConfigFile}" "/tmp/${tempFolderName}/server-config.conf.old"`)
                        await ssh.getFile(serverConfig.varContent.nginxConfigFile, localFolder)
                        await nginxConfig.readFromFile(localFolder)
                        nginxConfig.addServer(deploymentName, serverConfig.varContent.domainName)
                        await nginxConfig.writeToFile(localFolder)
                        await ssh.sendFile(localFolder, serverConfig.varContent.nginxConfigFile)
                    }},

                 {title: "Checking registration",
                     task: async () => {
                         await ssh.exec(`docker container exec "${serverConfig.content.nginxContainerName}" nginx -t`)
                     }},

                 {title: "Reloading config",
                     task: async () => {
                         await ssh.exec(`docker container exec "${serverConfig.content.nginxContainerName}" nginx -s reload`)
                     }}

             ])},
            cleanupTasks
        ])

        try {
            await tasks.run()
        } catch(e) {

            const errorCleanup = new Listr([
                cleanupTasks,
                {title: "Deployment cleanup",
                 task: () => new Listr([
                     {title: "Unregistering service",
                         task: async () => {
                             //await ssh.exec(`cat "/tmp/${tempFolderName}/server-config.conf.old" > "${serverConfig.varContent.nginxConfigFile}"`)
                         }},
                     {title: "Removing container",
                      task: async () => {
                         try {
                             await ssh.exec(`docker inspect "${deploymentName}"`)
                         } catch(e){
                             return;
                         }
                         await ssh.exec(`docker rm -f "${deploymentName}"`)
                      }}
                 ])}
            ])

            this.log("\nAn error occurred, error cleanup...\n")

            await errorCleanup.run()
            this.log("")

            ssh.disconnect()
            if(e.cmd || e.log){
                this.log(`\n============ Error log of the failed task ===========`)
            }
            if(e.cmd){
                this.log(`\n> ${e.cmd}`)
            }
            if(e.log){
                this.log(`\n${e.log}`)
            }
            if(e.cmd || e.log){
                this.log(`============       End of error log       ===========\n`)
            }
            this.error(e, {exit: 2})
            //this.error(`An error occurred in the failed task marked above\n\n${e.message}`, {exit: 2})
        }

        this.log(`\nla  Deployment succeed, your service is now available at the following URL\n`)
        this.log(`\thttp://${serverConfig.varContent.domainName}\n`)

        ssh.disconnect()
    }

}

DeployCommand.description = `Deploy the current directory to a server logged in

Deploy the selected directory to a server configured with the "login" command.
Server must be configured with the "login" command before any deployment.`

DeployCommand.args = [
    {
        name: "deployDirectory",
        required: false,
        description: "Directory to deploy to the server",
        default: () => process.cwd()
    }
]

DeployCommand.flags = {
    dockerfile: flags.string({
        description: "Name of the Dockerfile",
        default: "Dockerfile"
    }),
    ["no-cleanup"]: flags.boolean({
        description: "Skip cleanup step, cleaning temp folders locally and remote"
    }),
    ["no-local-cleanup"]: flags.boolean({
        description: "Skip cleanup step for local temp folder"
    }),
    ["no-remote-cleanup"]: flags.boolean({
        description: "Skip cleanup step for distant temp folder"
    }),
    ["check-time"]: flags.integer({
        description: "Time to wait after container's deployment before checking it's status and registering it (is seconds)",
        default: 5
    })
}

module.exports = DeployCommand