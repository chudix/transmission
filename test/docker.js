require('dotenv').load();
const USER_INFO = require('os').userInfo();
const PWD = process.env.PWD;
const TRANSMISSION_IMAGE_NAME = "linuxserver/transmission";
const TRANSMISSION_IMAGE_TAG = "2.94-r3-ls53"
const IMAGE_NAME = `${TRANSMISSION_IMAGE_NAME}:${TRANSMISSION_IMAGE_TAG}`
const CONTAINER_NAME = "transmission-promise-testing"
const TRANSMISSION_HOST_RPC_PORT = "9091"
const TRANSMISSION_HOST_PEER_PORT = "50143"

const CONTAINER_OPTIONS = {
    name: process.env.CONTAINER_NAME || CONTAINER_NAME,
    Image: process.env.IMAGE_NAME || IMAGE_NAME,
    Env: [
        `PUID=${USER_INFO.uid}`,
        `PGID=${USER_INFO.gid}`,
        "TZ=Europe/London"
    ],
    ExposedPorts: {
        "9091/tcp":{},
        "50143/tcp":{},
        "50143/udp":{}
    },
    Volumes: {
        "/config":{},
        "/downloads":{},
        "/watch":{}
    },
    HostConfig: {
        Binds: [
            `${PWD}/transmission/volumes/config:/config`,
            `${PWD}/transmission/volumes/downloads:/downloads`,
            `${PWD}/transmission/volumes/watch:/watch`
        ],
        PortBindings: {
            "9091/tcp": [{"HostPort":`${process.env.TRANSMISSION_HOST_RPC_PORT || TRANSMISSION_HOST_RPC_PORT}`}],
            "50143/tcp": [{"HostPort":`${process.env.TRANSMISSION_HOST_PEER_PORT || TRANSMISSION_HOST_PEER_PORT}/tcp`}],
            "50143/udp": [{"HostPort":`${process.env.TRANSMISSION_HOST_PEER_PORT || TRANSMISSION_HOST_PEER_PORT}/udp`}],
        },
        RestartPolicy: {Name: "unless-stopped"}
    }
};

const DOCKER_OPTIONS = {
    socketPath: process.env.SOCKET_PATH || '/var/run/docker.sock',
    port: process.env.PORT,
    username: process.env.USERNAME,
    password: process.env.PASSWORD,
    version: process.env.VERSION,
    key: process.env.KEY,
    cert: process.env.CERT,
    ca: process.env.CA,
    timeout: process.env.TIMEOUT,
    connectionTimeout: process.env.CONNECTION_TIMEOUT,
    checkServerIdentity: process.env.CHECK_SERVER_IDENTITY,
    agent: process.env.AGENT,
    agentForward: process.env.AGENT_FORWARD,
    sshAuthAgent: process.env.SSH_AUTH_AGENT,
}

var Docker = require('dockerode');

class DockerManager {
    /**
     * Represents a docker instance and container manager.
     * It has the responsibility to creation, removal
     * and setup of containers to prepare ground for
     * testing scripts.
     */
    constructor() {
        this.docker = new Docker(DOCKER_OPTIONS);
        this.currentContainer = undefined;

    }

    initialize() {
        /**
         * Initializes DockerManager instance. That means:
         *   - If no source image is present -> Fetches it.
         *   - If another container with CONTAINER_NAME is present -> wipe out
         *   - Creates the container
         *   - Finally starts it.
         * @return {Promise} Holding the reponse from the docker api.
         */
        return this.createContainer()
            .catch(error => {
                if (error.statusCode == 404 && error.json.message.split(':')[0] == 'No such image')
                {
                    // image doesnt exists. Pull image, create container and start it
                    console.log("-> Image not found.");
                    return this.getImage().then(response => this.createContainer())
                }
                else if (error.statusCode == 409)
                {
                    // container with CONTAINER_NAME exists
                    let containerId = this.getContainerIdFromError(error);
                    console.log(`-> Found ${CONTAINER_NAME}:${containerId}`)
                    this.setCurrentContainer(this.getContainerIdFromError(error));
                    return this.removeContainer().then(response => this.createContainer())
                }
                else
                {
                    // another error arised. Log it
                    return console.log(error)
                }
            })
            .finally( _ => this.startContainer());
    }
    
    resetCurrentContainer() {
        /**
         * Resets current container prop
         */
        this.currentContainer = undefined
    }

    removeContainer() {
        /**
         * Removes current container and reset currentContainer
         * @return {Promise} response from dockerode method remove.
         *   wich is the response of docker api
         */
        console.log(`Removing ${CONTAINER_NAME}: ${this.currentContainer.id}`)
        return this.currentContainer.remove({force:true}).then(response => {
            this.resetCurrentContainer();
            return response;
        })
    }

    createContainer() {
        /**
         * Creates a container based on CONTAINER_OPTIONS.
         * @return {Promise} Passes along response from dockerode
         *   createContainer method wich is the reponse from docker api.
         */
        console.log(`Creating pristine new container named ${CONTAINER_NAME}`)
        return this.docker
            .createContainer(CONTAINER_OPTIONS)
            .then(response => {
                this.setCurrentContainer(response.id)
                return response
            })
        
    }

    getImage() {
        /**
         * Used to pull an image from the internet. Uses dockerode method.
         * @return {Promise} A promise resolved when streaming finishes
         *   [refer to dockerode docs for docker.modem.followProgress]
         */
        console.log(`Pulling image ${IMAGE_NAME}...`);
        return new Promise((resolve, reject) => {
            this.docker.pull(IMAGE_NAME, (error, stream) => {
                this.docker.modem.followProgress(stream,(error, output) => {
                    // onFinished streams resolve promise to continue execution
                    resolve(true);
                })
            })
        })
    }

    startContainer() {
        /**
         * Starts the container stored on currentContainer
         * @return {Promise} response from docker api start
         */
        console.log(`Starting container ${CONTAINER_NAME}`)
        return this.currentContainer.start()
    }

    setCurrentContainer(id) {
        /**
         * Set current container based on a container id.
         * @param {string} docker container id.
         * @return void
         */
        this.currentContainer = this.getContainer(id);
    }

    getCurrentContainer() {
        return this.currentContainer;
    }
    
    getContainer(id) {
        /**
         * @param {string} docker container id
         * @return {object} dockerode representation of a container
         *   named CONTAINER_NAME
         */
        return this.docker.getContainer(id);
    }

    getContainerIdFromError(error) {
        /**
         * Extract container id from docker api error message.
         * @param {Object} An error object returned by the docker api.
         * @return {string} docker container id
         */
        return error.json.message.split('.')[1].split(' ').pop().replace(/"/g,'');
    }

    wipeout() {
        /**
         * Removes current container from sistem.
         * Intended to use from outside the class before destroy.
         */
        return this.removeContainer();
    }
}
