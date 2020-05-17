require('dotenv').load();
const USER_INFO = require('os').userInfo();
const PWD = process.env.PWD;
const TRANSMISSION_IMAGE_NAME = "linuxserver/transmission";
const TRANSMISSION_IMAGE_TAG = "2.94-r3-ls53"
const IMAGE_NAME = `${TRANSMISSION_IMAGE_NAME}:${TRANSMISSION_IMAGE_TAG}`
const CONTAINER_NAME = "transmission-promise-testing"

const CONTAINER_OPTIONS = {
    name: CONTAINER_NAME,
    Image: IMAGE_NAME,
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
            "9091/tcp": [{"HostPort":"9091"}],
            "50143/tcp": [{"HostPort":"50143/tcp"}],
            "50143/udp": [{"HostPort":"50143/udp"}],
        },
        RestartPolicy: {Name: "unless-stopped"}
    }
};
    


var Docker = require('dockerode');
var docker = new Docker();
                                                
// TODO: use api errors(when possible) and catch to get rid of conditionals and nested calls
docker.listContainers({all:true, filters: {"name":[CONTAINER_NAME]}})
    .then(containers => {
        if (!!containers.length) {
            // Container already exists.
            console.log("container exists...killing and removing");
            // get container -> then remove it -> then create a new one
            docker.getContainer(containers[0].Id)
                .remove({force: true})
                .then(response => {
                    console.log("removed container... creating a new one");
                    docker.createContainer(CONTAINER_OPTIONS)
                        .then(response => {
                            console.log(`Created brand new container named ${CONTAINER_NAME}. Starting it...`);
                            docker.getContainer(response.id).start();
                        })
                        .catch(error => console.log(error));
                })
                .catch(error => console.log(error));
        } else {
            // if container does not exists it may be because image is not present
            // check for image if present just create container and start it
            //                 if not pull and create
            // create new container
            console.log("Container not found. Checking for images...")
            docker.listImages({filters: {"reference": [IMAGE_NAME]}})
                .then(images => {
                    if(!!images.length) {
                        // image found -> create
                        console.log("Image found.Creating container...")
                        docker.createContainer(CONTAINER_OPTIONS)
                            .then(response => {
                                console.log("Created container. Starting it...")
                                docker.getContainer(response.id).start()
                                    .then(response => console.log("Started container"))
                                    .catch(error => console.log(error));
                            })
                            .catch(error => console.log(error))
                    }else {
                        // no image found -> pull and create
                        console.log("Image not found. Pulling and creating container...")
                        docker.pull(IMAGE_NAME, (error, stream) => {
                            docker.modem.followProgress(stream,(error, output) => {
                                // onFinished streams
                                console.log("Image pulled. Creating container")
                                docker.createContainer(CONTAINER_OPTIONS)
                                    .then(response => {
                                        console.log("Created container. Starting it...")
                                        docker.getContainer(response.id).start()
                                            .then(response => console.log("Started container"))
                                            .catch(error => console.log(error));
                                    })
                                    .catch(error => console.log(error))
                            })
                        })
                    }
                })
        }
    })
    .catch(error => console.log(error))
