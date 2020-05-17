# Tests

## Dependencies

* Docker

## How it works

It uses a docker container running just transmission daemon. **Why?** Because a totally controlled 
environment is desirable to test each functionality. Dont mess up with my current transmission
you! -.-

Basically, when you run the tests, a container is created with a pristine transmission daemon to
talk to.

Each test uses that container services, and before ends it stop and removes the container.

## The container

The container is based on [this](https://github.com/linuxserver/docker-transmission) image. 
By default it maps ports in the container with ports in the host, your transmission daemon;
so in order to run, it is better to stop local daemon. If you don't want to stop your local
daemon, environment variables can be set to override the default ones(see below for 
environmental variables description)

The container also has by default the name: "transmission-promise-testing". Each time tests 
runs, if there is a container with that name it wipes out and start a fresh one. So If you
already have a container with that name and want to keep it you can:

- Rename that container.
- Set the name of the testing container in an environment variable.(see below for 
environmental variables descriptions)

## The docker daemon

The daemon is handled by [dockerode](https://github.com/apocas/dockerode). It instantiates
an api wrapper for a default docker installation. If you have special needs you can also override
that with environment variables.
Since all that configurations are handled by the modem part of dockerode. You may check in 
[modem-docker](https://github.com/apocas/docker-modem#readme) for options.


## Enviromental variables.

[dotenv](https://www.npmjs.com/package/dotenv) is available. So if you dont want to pollute your
environment you can use a .env file in the test folder.

### Image and container variables

| Name                           | description                  | default                               |
| ---                            | ---                          | --                                    |
| IMAGE\_NAME                    | name of the image to use     | linuxserver/transmission:2.94-r3-ls53 |
| CONTAINER\_NAME                | name of the container        | transmission-promise-testing          |
| TRANSMISSION\_HOST\_RPC\_PORT  | port to bind rpc in the host | 9091                                  |
| TRANSMISSION\_HOST\_PEER\_PORT | port to bind transmission    | 50143                                 |
|                                | peer on the host             |                                       |

