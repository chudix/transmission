/* global describe it afterEach */
/**
 * @todo: Move all setup logic to another script
 * leaving here just tests.
 */
const fs = require('fs')
const path = require('path')
const http = require('http')
const async = require('async')
const dotenv = require('dotenv')
const DockerManager = require('./docker.js');

dotenv.load()
const Transmission = require('../')
const clientOptions = {}
if (process.env.PORT) {
    clientOptions.port = process.env.PORT
}
if (process.env.HOST) {
    clientOptions.host = process.env.HOST
}

// USERNAME and USER aren"t overwritten by .env file and are used from the parent process
if (process.env.USERN) {
    clientOptions.username = process.env.USERN
}
if (process.env.PASSWORD) {
    clientOptions.password = process.env.PASSWORD
}
if (process.env.URL) {
    clientOptions.url = process.env.URL
}

const sampleUrl = 'http://releases.ubuntu.com/18.04/ubuntu-18.04.4-desktop-amd64.iso.torrent';
const sampleHash = '286d2e5b4f8369855328336ac1263ae02a7a60d5';
const tmpFilesDir = 'test/tmp';
const torrentName = path.basename(sampleUrl).replace('.torrent', '');
const torrentPath = path.resolve(tmpFilesDir,torrentName);

function setupEnvironment() {
    /**
     * Set up files in environment.
     *   - Creates temporary directory on fs
     *   - Downloads sample torrent from ubuntu source
     *     and places it in temporary directory.
     *
     */
    
    if (!fs.existsSync(path.resolve(tmpFilesDir))) {
        fs.mkdirSync(path.resolve(tmpFilesDir))
    }
    return new Promise((resolve,reject) => {
        http.get(sampleUrl, response => {
            const transmission = new Transmission(clientOptions)
            const writeStream = fs.createWriteStream(torrentPath)
            response.pipe(writeStream)
            response.on('error', error => {
                console.log(error)
                reject()
            })
            response.on('end', () => {
                console.log("Torrent downloaded and saved");
                resolve(response)
            })
        })
    })
}

function cleanUpEnvironment() {
    /**
     * Delete all files created in shared volumes and fs
     */

    try {
        fs.unlinkSync(torrentPath)
    } catch(error) {
        console.log(error)
    }
}

let containerManager = new DockerManager();
describe('transmission', () => {
    const chai = require('chai');
    const expect = chai.expect;
    let transmission;

    const sampleUrl = 'http://releases.ubuntu.com/18.04/ubuntu-18.04.4-desktop-amd64.iso.torrent';
    const sampleHash = '286d2e5b4f8369855328336ac1263ae02a7a60d5';

    chai.config.includeStack = true
    before(function(done) {
        // TODO: run setup environment and container initialize in parallel
        this.timeout(100000);
        containerManager.initialize()
            .then(response => {
                console.log("Container initialized and fully functional\n\r");
            })
            .then(response => {
                return setupEnvironment()
            })
            .then(r => {
                // add torrent in client
                console.log("adding Torrent to container");
                return containerManager.addTorrentByUrl(sampleUrl)
            })
            .then(r => {
                done();
            })
    });

    after(function(done) {
        this.timeout(10000);
        containerManager.wipeout()
            .then(response => {
                console.log("Wiped out container");
                return response;
            })
            .then(response => {
                cleanUpEnvironment()
                return response;
            })
            .then(_ => {
                console.log("Cleaned up environment");
                done()
            });
    });
    
    it('can instantiate a new instance', done => {
        try {
            transmission = new Transmission(clientOptions)
            done()
        } catch (err) {
            done(err)
        }
    });
    
    describe('status definition is the used by RPC spec', () => {
        it('should have correct status', (done) => {
            expect(transmission.status.STOPPED).to.equal(0)
            expect(transmission.status.CHECK_WAIT).to.equal(1)
            expect(transmission.status.CHECK).to.equal(2)
            expect(transmission.status.DOWNLOAD_WAIT).to.equal(3)
            expect(transmission.status.DOWNLOAD).to.equal(4)
            expect(transmission.status.SEED_WAIT).to.equal(5)
            expect(transmission.status.SEED).to.equal(6)
            expect(transmission.status.ISOLATED).to.equal(7)
            done();
        });
    });
    describe('methods',function() {
        
        describe('#get', function() {
            this.timeout(30000);
            let methodResponse;
            before(function(done) {
                transmission.get()
                    .then(response => {
                        methodResponse = response;
                        done();
                    })
                    .catch(done);
            });
            it('returns an array', done => {
                expect(methodResponse.torrents).to.be.an('array');
                done();
            });

            it('returns current amount of torrents', done => {
                // currently it should be one torrent(the sample one)
                expect(methodResponse.torrents.length).to.equal(1);
                done();
            })

            it.skip('returns all torrent props in current spec', done => {
                //@TODO Should return all props in current spec
            });
            // TODO: call get with fields and test it returns
            it.skip('returns only specified fields in get call', done => {}) 
            

        }); //<- #get
        describe('#remove', function() {
            it('Can remove from list(no local data)', done => {
                transmission.get()
                    .then(response => {
                        return transmission.remove([response.torrents.pop().id])
                    })
                    .then(response => {
                        return transmission.get();
                    })
                    .then(response => {
                        expect(response.torrents.length).to.equal(0);
                        done();
                    })
                    .catch(done);
            });

            // TODO
            it.skip('Can fully remove(local data included)', done => {})
        });// <- #remove

        describe('#add', function() {
            // after each test is performed remove the added torrent
            // from tranmission.
            // Note: remove method should work (tested above)
            // TODO: move internal logic to a function
            afterEach(done => {
                transmission.get().then(res => {
                    async.each(res.torrents, (torrent, callback) => {
                        if (torrent.hashString !== sampleHash) {
                            return callback();
                        }
                        transmission.remove(torrent.id, true).then(() => done());
                    });
                },
                err => {
                    done(err);
                });
            });
            let addedTorrentId = 2;
            describe('#addUrl', function() {
                const torrentUrl = sampleUrl
                // check if get returns the torrent added.
                // Currently checks only for lenght because testing
                // is done with just one torrent
                it('Adds a torrent from url', done => {

                    transmission.addUrl(torrentUrl)
                        .then(response => {
                            addedTorrentId++;
                            return transmission.get()
                        })
                        .then(response => {
                            expect(response.torrents.length).to.equal(1)
                            done()
                        })
                        .catch(done)
                })
                it('Returns response as Rpc spec states', done => {
                    const expected = {
                        id: addedTorrentId,
                        hashString: sampleHash,
                        name: torrentName
                    }
                    transmission.addUrl(torrentUrl)
                        .then(response => {
                            expect(response).to.deep.equal(expected);
                            addedTorrentId++;
                            done();
                        })
                        .catch(done)
                })

                
            }) //<- #addUrl
            
            describe('#addFile', function () {
                // NOTE: should use node streams? 
                const torrentFile = torrentPath;
                // TODO: it returns what spec says it should
                it.skip('Returns response as Rpc spec states', done => {})
                // TODO: add a torrent and check if get returns it.
                it.skip('Add torrent from file path', done => {})
                
            })
            
        })
    }); //methods
    
    
    it.skip('should add torrent from url', function (done) {
        transmission.addUrl(sampleUrl).then(info => {
            console.log("addUrl response", info)
            th = info.id
            return transmission.get(info.id)
        }).then(got => {
            if (got.torrents.length === 0) {
                done(new Error('add torrent failure'))
            }

            done()
        }).catch(done)
    })

    it.skip('should set properties', done => {
        done()
    })



    it.skip('should get all active torrents', done => {
        transmission.active().then(res => {
            expect(res.torrents).to.be.an('array')
            done()
        }).catch(done)
    });



    it.skip('should stop all torrents', done => {
        transmission.addUrl(sampleUrl).then(info => {
            return transmission.waitForState(info.id, 'DOWNLOAD')
        }).then(info => {
            return transmission.stopAll()
        }).then(info => {
            setTimeout(() => {
                transmission.get().then(got => {
                    async.each(got.torrents, (torrent, callback) => {
                        if (torrent.status !== transmission.status.STOPPED) {
                            return callback(new Error('Stop torrent failure'))
                        }

                        callback()
                    }, err => {
                        if (err) {
                            return done(err)
                        }

                        done()
                    })
                }).catch(done)
            }, 2000)
        }).catch(done)
        

        it.skip('should stop a torrent', done => {
            transmission.get().then(info => {
                transmission.stop(info.torrents[0].id).then(info => {
                    done()
                })
            })
        })

        it.skip('should start working torrents', function () {
            // transmission.start
        })

        it.skip('should start working torrents immediately', function () {
            // transmission.startNow
        })

        it.skip('should reannounce to the tracker', function () {
            // transmission.verify
        })

        it.skip('should set client session info', function () {
            // transmission.session
        })

        it.skip('should get client session info', done => {
            transmission.session().then(res => {
                expect(res).to.have.property('config-dir')
                expect(res).to.have.property('peer-port')
                expect(res).to.have.property('download-dir')
                done()
            }).catch(done)
        })

        it.skip('should get client session stats', done => {
            transmission.sessionStats().then(res => {
                expect(res).to.have.property('downloadSpeed')
                expect(res).to.have.property('uploadSpeed')
                expect(res).to.have.property('torrentCount')
                done()
            }).catch(done)
        })
    });


});
