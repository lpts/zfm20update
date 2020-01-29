const raspi = require('raspi');
const Serial = require('raspi-serial').Serial;
const Result = require("async-result");

const FINGERPRINT_DEBUG = true;
const FINGERPRINT_OK = 0x00;
const FINGERPRINT_PACKETRECIEVEERR = 0x01;
const FINGERPRINT_NOFINGER = 0x02;
const FINGERPRINT_IMAGEFAIL = 0x03;
const FINGERPRINT_IMAGEMESS = 0x06;
const FINGERPRINT_FEATUREFAIL = 0x07;
const FINGERPRINT_NOMATCH = 0x08;
const FINGERPRINT_NOTFOUND = 0x09;
const FINGERPRINT_ENROLLMISMATCH = 0x0a;
const FINGERPRINT_BADLOCATION = 0x0b;
const FINGERPRINT_DBRANGEFAIL = 0x0c;
const FINGERPRINT_UPLOADFEATUREFAIL = 0x0d;
const FINGERPRINT_PACKETRESPONSEFAIL = 0x0e;
const FINGERPRINT_UPLOADFAIL = 0x0f;
const FINGERPRINT_DELETEFAIL = 0x10;
const FINGERPRINT_DBCLEARFAIL = 0x11;
const FINGERPRINT_PASSFAIL = 0x13;
const FINGERPRINT_INVALIDIMAGE = 0x15;
const FINGERPRINT_FLASHERR = 0x18;
const FINGERPRINT_INVALIDREG = 0x1a;
const FINGERPRINT_ADDRCODE = 0x20;
const FINGERPRINT_PASSVERIFY = 0x21;
const FINGERPRINT_STARTCODE = 0xef01;
const FINGERPRINT_COMMANDPACKET = 0x1;
const FINGERPRINT_DATAPACKET = 0x2;
const FINGERPRINT_ACKPACKET = 0x7;
const FINGERPRINT_ENDDATAPACKET = 0x8;
const FINGERPRINT_TIMEOUT = 0xff;
const FINGERPRINT_BADPACKET = 0xfe;
const FINGERPRINT_GETIMAGE = 0x01;
const FINGERPRINT_IMAGE2TZ = 0x02;
const FINGERPRINT_REGMODEL = 0x05;
const FINGERPRINT_STORE = 0x06;
const FINGERPRINT_LOAD = 0x07;
const FINGERPRINT_UPLOAD = 0x08;
const FINGERPRINT_DELETE = 0x0c;
const FINGERPRINT_EMPTY = 0x0d;
const FINGERPRINT_VERIFYPASSWORD = 0x13;
const FINGERPRINT_HISPEEDSEARCH = 0x1b;
const FINGERPRINT_TEMPLATECOUNT = 0x1d;

class ZFM20 {


    constructor(_portConfig) {
        this.portConfig = _portConfig;
        this.fingerID = 0xffff;
        this.confidence = 0xffff;
        this.templateCount = 0;
        this.thePassword = 0;
        this.theAddress = 0xffffffff;
        this.onData = (data) => {
            console.log("No handler for data");
        };
    }

    get getSerial() {
        return this.serial;
    }
    /**
     * Permet de connecter le module de reconnaissance.
     * Le port serie doit avoir ete configure avec le constructeur.
     * A l'ouverture du port, le mot de passe est verifie.
     * Si pas le probleme la communication est ouverte.
     * Si le module est introuvable, le port est ferme.
     * 
     * Erreurs : 
     * -- Module introuvable
     * -- 
     *
     * @memberof ZFM20
     */
    connect() {
        raspi.init(() => {
            this.serial = new Serial(this.portConfig);
            this.serial.open(() => {
                this.verifyPassword()
                    .error((err) => {
                        if (err) {
                            console.log(err);
                        }
                        console.log("Error connecting with module");
                    })
                    .fail((err) => {
                        if (err) {
                            console.log(err);
                        }
                        console.log("Module not found");
                        this.serial.close((err) => {
                            if (err) {
                                console.log("Error while closing : ", err);
                            } else {
                                console.log("Port closed");
                            }
                        });
                    })
                    .ok(() => {
                        console.log("Module ready");
                        this.serial.on("data", (data) => {
                            this.onData(data);
                        });
                    });
            });
        });
    }

    /**
     * Permet de creer une empreinte et la sauvegarder.
     * La fonction wait permet de gerer une sortie de dialogue (ie : LCD I2C).
     * Par defaut on affiche juste un texte sur la console.
     *
     * @param {*} id
     * @param {string} [wait=() => {
     *         console.log("Waiting for finger");
     *     }]
     * @returns : un objet result
     * @memberof ZFM20
     */
    enroll(id, wait = () => {
        console.log("Waiting for finger");
    }) {
        var result = new Result();
        var fp = this;

        result.wait = (cb) => {
            wait = cb;
        };

        var takeImage_1 = () => {
            wait();
            fp.getImage()
                .fail(result.fail)
                .ok((code) => {
                    fp.evaluateCode(code, takeImage2tz_1, takeImage_1, result.fail);
                });
        };
        var takeImage2tz_1 = () => {
            wait();
            fp.image2Tz(1)
                .fail(result.fail)
                .ok((code) => {
                    fp.evaluateCode(code, takeImage_2, takeImage2tz_1, result.fail);
                });
        };
        var takeImage_2 = () => {
            wait();
            fp.getImage()
                .fail(result.fail)
                .ok((code) => {
                    fp.evaluateCode(code, takeImage2tz_2, takeImage_2, result.fail);
                });
        };
        var takeImage2tz_2 = () => {
            wait();
            fp.image2Tz(2)
                .fail(result.fail)
                .ok((code) => {
                    fp.evaluateCode(code, createModelImage, takeImage2tz_2, result.fail);
                });
        };
        var createModelImage = () => {
            fp.createModel()
                .fail(result.fail)
                .ok((code) => {
                    fp.evaluateCode(code, storeModelImage, null, result.fail);
                });
        };
        var storeModelImage = () => {
            fp.storeModel(id)
                .fail(result.fail)
                .ok((code) => {
                    fp.evaluateCode(
                        code,
                        () => {
                            result.ok(id, "Fingerprint stored");
                        },
                        null,
                        result.fail
                    );
                });
        };
        takeImage_1();
        return result;
    }
    /**
     * Permet de chercher une empreinte prealablement enregistree.
     * 
     *
     * @param {string} [wait=() => {
     *         console.log("Waiting for finger");
     *     }]
     * @returns : un objet result
     * @memberof ZFM20
     */
    read(wait = () => {
        console.log("Waiting for finger");
    }) {
        var result = new Result();
        var fp = this;

        result.wait = function (cb) {
            wait = cb;
        };

        var takeImage_1 = () => {
            wait();
            fp.getImage()
                .error(result.error)
                .fail(result.fail)
                .ok(function (code) {
                    fp.evaluateCode(code, takeImage2tz_1, takeImage_1, result.fail);
                });
        };
        var takeImage2tz_1 = () => {
            wait();
            fp.image2Tz(1)
                .error(result.error)
                .fail(result.fail)
                .ok(function (code) {
                    fp.evaluateCode(code, find, takeImage2tz_1, result.fail);
                });
        };
        var find = () => {
            fp.fingerFastSearch()
                .fail(result.fail)
                .error(result.error)
                .ok(function (code) {
                    fp.evaluateCode(
                        code,
                        () => {
                            result.ok(fingerID, "fingerprint found");
                        },
                        null,
                        result.fail
                    );
                });
        };
        takeImage_1();
        return result;
    }
    /**
     * Permet d'effacer une empreinte prealablement enregistree.
     *
     * @param {*} id
     * @returns : un objet result
     * @memberof ZFM20
     */
    delete(id) {
        var result = new Result();
        this.deleteModel(id)
            .fail(result.fail)
            .error(result.error)
            .ok(function (code) {
                this.evaluateCode(
                    code,
                    () => {
                        result.ok(id, "Fingerprint ID " + id + " deleted.");
                    },
                    null,
                    result.fail
                );
            });
        return result;
    }
    /**
     * Permet de charger une empreinte (TODO : a voir pas clair)
     *
     * @param {*} id
     * @returns
     * @memberof ZFM20
     */
    load(id) {
        var result = new Result();
        var fp = this;
        fp.loadModel(id)
            .error(result.error)
            .fail(result.fail)
            .ok((code) => {
                fp.evaluateCode(code, getfp, null, result.fail);
            });
        var getfp = () => {
            fp.getModel()
                .error(result.error)
                .fail(result.fail)
                .ok((code, packet) => {
                    fp.evaluateCode(
                        code,
                        () => {
                            result.ok(packet, "Fingerprint loaded");
                        },
                        null,
                        result.fail
                    );
                });
        };
        return result;
    }

    getImage() {
        var packet = [FINGERPRINT_GETIMAGE],
            result = new Result();
        this.writePacket(this.theAddress, FINGERPRINT_COMMANDPACKET, 3, packet);
        this.onReply(result, packet);
        return result;
    }

    image2Tz(slot) {
        var packet = [FINGERPRINT_IMAGE2TZ, slot],
            result = new Result();
        this.writePacket(
            this.theAddress,
            FINGERPRINT_COMMANDPACKET,
            packet.length + 2,
            packet
        );
        this.onReply(result, packet);
        return result;
    }

    createModel() {
        var packet = [FINGERPRINT_REGMODEL],
            result = new Result();
        this.writePacket(
            this.theAddress,
            FINGERPRINT_COMMANDPACKET,
            packet.length + 2,
            packet
        );
        this.onReply(result, packet);
        return result;
    }

    storeModel(id) {
        var packet = [FINGERPRINT_STORE, 0x01, id >> 8, id & 0xff],
            result = new Result();
        this.writePacket(
            this.theAddress,
            FINGERPRINT_COMMANDPACKET,
            packet.length + 2,
            packet
        );
        this.onReply(result, packet);
        return result;
    }

    loadModel(id) {
        var packet = [FINGERPRINT_LOAD, 0x01, id >> 8, id & 0xff],
            result = new Result();
        this.writePacket(
            this.theAddress,
            FINGERPRINT_COMMANDPACKET,
            packet.length + 2,
            packet
        );
        this.onReply(result, packet);
        return result;
    }

    getModel() {
        var packet = [FINGERPRINT_UPLOAD, 0x01],
            result = new Result();
        this.writePacket(
            this.theAddress,
            FINGERPRINT_COMMANDPACKET,
            packet.length + 2,
            packet
        );
        this.onReply(result, packet);
        return result;
    }

    deleteModel(id) {
        var packet = [FINGERPRINT_DELETE, id >> 8, id & 0xff, 0x00, 0x01],
            result = new Result();
        this.writePacket(
            this.theAddress,
            FINGERPRINT_COMMANDPACKET,
            packet.length + 2,
            packet
        );
        this.onReply(result, packet);
        return result;
    }

    emptyDatabase() {
        var packet = [FINGERPRINT_EMPTY],
            result = new Result();
        this.writePacket(
            this.theAddress,
            FINGERPRINT_COMMANDPACKET,
            packet.length + 2,
            packet
        );
        this.onReply(result, packet);
        return result;
    }

    fingerFastSearch() {
        this.fingerID = 0xffff;
        this.confidence = 0xffff;
        // high speed search of slot #1 starting at page 0x0000 and page #0x00A3
        var packet = [FINGERPRINT_HISPEEDSEARCH, 0x01, 0x00, 0x00, 0x00, 0xa3],
            result = new Result();
        this.writePacket(
            this.theAddress,
            FINGERPRINT_COMMANDPACKET,
            packet.length + 2,
            packet
        );
        this.onReply(result, packet, () => {
            this.fingerID = packet[2];
            this.fingerID <<= 8;
            this.fingerID |= packet[3];
            this.confidence = packet[4];
            this.confidence <<= 8;
            this.confidence |= packet[5];
        });
        return result;
    }

    getTemplateCount() {
        this.templateCount = 0xffff;
        var packet = [FINGERPRINT_TEMPLATECOUNT],
            result = new Result();
        this.writePacket(
            this.theAddress,
            FINGERPRINT_COMMANDPACKET,
            packet.length + 2,
            packet
        );
        this.onReply(result, packet, () => {
            this.templateCount = packet[2];
            this.templateCount <<= 8;
            this.templateCount |= packet[3];
        });
        return result;
    }


    writePacket(addr, packettype, len, packet, callback) {
        var buffer = [];

        buffer.push(FINGERPRINT_STARTCODE >> 8);
        buffer.push(FINGERPRINT_STARTCODE);
        buffer.push(addr >> 24);
        buffer.push(addr >> 16);
        buffer.push(addr >> 8);
        buffer.push(addr);
        buffer.push(packettype);
        buffer.push(len >> 8);
        buffer.push(len);

        var sum = (len >> 8) + (len & 0xff) + packettype;
        for (var i = 0; i < len - 2; i++) {
            buffer.push(packet[i]);
            sum += packet[i];
        }

        buffer.push(sum >> 8);
        buffer.push(sum);
        buffer = Buffer.from(buffer);
        if (FINGERPRINT_DEBUG) {
            console.log("\nSending: ", buffer);
        }
        this.serial.write(buffer, callback);
    }

    getReply(reply, packet) {
        FINGERPRINT_DEBUG && console.log("\nReply: ", reply);
        if (
            reply[0] !== FINGERPRINT_STARTCODE >> 8 &&
            reply[1] !== (FINGERPRINT_STARTCODE & 0xff)
        )
            return FINGERPRINT_BADPACKET;
        var len = reply[7],
            end = reply.length - 2,
            packettype = reply[6];
        len <<= 8;
        len |= reply[8];
        len -= 2;

        packet[0] = packettype;
        for (var i = 0; i < end; i++) {
            packet[1 + i] = reply[9 + i];
        }

        return len;
    }

    onReply(result, packet, onok, timeout) {
        var reply = Buffer.from([]);
        timeout = timeout || 500;
        setTimeout(function () {
            if (reply.length == 0) {
                return result.fail(
                    "Timeout receiving packet " + timeout + " ms"
                );
            }
            var len = this.getReply(reply, packet);
            if (len != 1 && packet[0] != FINGERPRINT_ACKPACKET) {
                return result.fail(-1);
            }
            onok && onok();
            return result.ok(packet[1], packet);
        }, timeout);

        this.onData = (rbuffer) => {
            if (FINGERPRINT_DEBUG) {
                console.log("Receiving part of buffer: ", rbuffer);
            }
            reply = Buffer.concat([reply, rbuffer]);
        };
    }

    verifyPassword() {
        var packet = [
            FINGERPRINT_VERIFYPASSWORD,
            this.thePassword >> 24,
            this.thePassword >> 16,
            this.thePassword >> 8,
            this.thePassword
        ],
            result = new Result();
        this.writePacket(this.theAddress, FINGERPRINT_COMMANDPACKET, 7, packet);
        this.onReply(result, packet);
        return result;
    }

    evaluateCode(code, onok, repeat, onfail) {
        switch (code) {
            case FINGERPRINT_OK:
                onok();
                break;
            case FINGERPRINT_PACKETRECIEVEERR:
                onfail && onfail(code, "Communication error");
                break;
            case FINGERPRINT_NOFINGER:
                repeat && repeat();
                break;
            case FINGERPRINT_IMAGEFAIL:
                onfail && onfail(code, "Imaging error");
                break;
            case FINGERPRINT_FEATUREFAIL:
                onfail && onfail(code, "Feature fail");
                break;
            case FINGERPRINT_INVALIDIMAGE:
                onfail && onfail(code, "Invalid image");
                break;
            case FINGERPRINT_BADLOCATION:
                onfail && onfail(code, "Could not delete in that location");
                break;
            case FINGERPRINT_FLASHERR:
                onfail && onfail(code, "Error writing to flash");
                break;
            case FINGERPRINT_NOTFOUND:
                onfail && onfail(code, "Not found");
                break;
            default:
                onfail && onfail(code, "Unknown error");
                break;
        }
    }
}

exports.ZFM20 = ZFM20;