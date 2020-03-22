const raspi = require('raspi');
const SerialPort = require('serialport');

const FINGERPRINT_DEBUG = false;
const FINGERPRINT_OK = 0x00;
const FINGERPRINT_KO = -1;
const FINGERPRINT_NOFINGER = 0x02;
const FINGERPRINT_STARTCODE = 0xef01;
const FINGERPRINT_COMMANDPACKET = 0x1;
const FINGERPRINT_ACKPACKET = 0x7;
const FINGERPRINT_TIMEOUT = 0xff;
const FINGERPRINT_BADPACKET = 0xfe;
const FINGERPRINT_GETIMAGE = 0x01;
const FINGERPRINT_IMAGE2TZ = 0x02;
const FINGERPRINT_REGMODEL = 0x05;
const FINGERPRINT_STORE = 0x06;
const FINGERPRINT_DELETE = 0x0c;
const FINGERPRINT_EMPTY = 0x0d;
const FINGERPRINT_VERIFYPASSWORD = 0x13;
const FINGERPRINT_HISPEEDSEARCH = 0x1b;
const FINGERPRINT_TEMPLATECOUNT = 0x1d;

class ZFM {

    constructor(_port, _baudRate) {
        this.serial = new SerialPort(_port, {
            baudRate: _baudRate
        });
        this.fingerID = 0xffff;
        this.confidence = 0xffff;
        this.templateCount = 0;
        this.thePassword = 0;
        this.theAddress = 0xffffffff;
        this.parser = this.serial;
        this.onData = (data) => { };
    }

    async connect() {
        return new Promise((resolve, reject) => {
            try {
                raspi.init(() => {
                    this.parser.on("data", (data) => {
                        this.onData(data);
                    });
                    this.parser.on("open", () => {
                        zfm.verifyPassword().then(
                            ret => {
                                if (ret) {
                                    resolve();
                                } else {
                                    reject();
                                }
                            },
                        );
                    });
                    this.parser.on("error", (err) => {
                        if (err) {
                            console.log(err.message)
                            reject(err);
                        }
                    });
                    this.serial.open((err) => {
                        if (err) {
                            console.log(err.message)
                        }
                    });
                });
            } catch (error) {
                this.parser.close((err) => {
                    if (err) {
                        console.log("Error while closing : ", err);
                    } else {
                        console.log("Port closed");
                    }
                });
                reject(error);
            }
        });
    }


    async verifyPassword() {
        let result = false;
        try {
            let packet = [FINGERPRINT_VERIFYPASSWORD, this.thePassword >> 24, this.thePassword >> 16, this.thePassword >> 8, this.thePassword];
            this.writePacket(this.theAddress, FINGERPRINT_COMMANDPACKET, 7, packet);
            let len = await this.getReply(packet, 500);
            if ((len == 1) && (packet[0] == FINGERPRINT_ACKPACKET) && (packet[1] == FINGERPRINT_OK)) {
                result = true;
            }
        } catch (err) {
            this.decodeError(err);
        }
        return result;
    }

    async getImage() {
        try {
            let result = FINGERPRINT_OK;
            let packet = [FINGERPRINT_GETIMAGE];
            this.writePacket(this.theAddress, FINGERPRINT_COMMANDPACKET, 3, packet);
            let len = await this.getReply(packet);
            if ((len != 1) && (packet[0] != FINGERPRINT_ACKPACKET)) {
                result = FINGERPRINT_KO;
            } else {
                result = packet[1];
            }
            return result;
        } catch (err) {
            this.decodeError(err);
        }
    }

    async imaget2Tz(slot) {
        try {
            let result = FINGERPRINT_OK;
            let packet = [FINGERPRINT_IMAGE2TZ, slot];
            this.writePacket(this.theAddress, FINGERPRINT_COMMANDPACKET, 4, packet);
            let len = await this.getReply(packet, 1000);
            if ((len != 1) && (packet[0] != FINGERPRINT_ACKPACKET)) {
                result = FINGERPRINT_KO;
            } else {
                result = packet[1];
            }
            return result;
        } catch (err) {
            this.decodeError(err);
        }
    }

    async createModel() {
        try {
            let result = FINGERPRINT_OK;
            let packet = [FINGERPRINT_REGMODEL];
            this.writePacket(this.theAddress, FINGERPRINT_COMMANDPACKET, 3, packet);
            let len = await this.getReply(packet);
            if ((len != 1) && (packet[0] != FINGERPRINT_ACKPACKET)) {
                result = FINGERPRINT_KO;
            } else {
                result = packet[1];
            }
            return result;
        } catch (err) {
            this.decodeError(err);
        }
    }

    async storeModel(id) {
        try {
            let result = FINGERPRINT_OK;
            let packet = [FINGERPRINT_STORE, 0x01, id >> 8, id & 0xFF];
            this.writePacket(this.theAddress, FINGERPRINT_COMMANDPACKET, 6, packet);
            let len = await this.getReply(packet);
            if ((len != 1) && (packet[0] != FINGERPRINT_ACKPACKET)) {
                result = FINGERPRINT_KO;
            } else {
                result = packet[1];
            }
            return result;
        } catch (err) {
            this.decodeError(err);
        }
    }

    async deleteModel(id) {
        try {
            let result = FINGERPRINT_OK;
            let packet = [FINGERPRINT_DELETE, id >> 8, id & 0xFF, 0x00, 0x01];
            this.writePacket(this.theAddress, FINGERPRINT_COMMANDPACKET, 7, packet);
            let len = await this.getReply(packet);
            if ((len != 1) && (packet[0] != FINGERPRINT_ACKPACKET)) {
                result = FINGERPRINT_KO;
            } else {
                result = packet[1];
            }
            return result;
        } catch (err) {
            this.decodeError(err);
        }
    }

    async emptyDatabase() {
        try {
            let result = FINGERPRINT_OK;
            let packet = [FINGERPRINT_EMPTY];
            this.writePacket(this.theAddress, FINGERPRINT_COMMANDPACKET, 3, packet);
            let len = await this.getReply(packet);
            if ((len != 1) && (packet[0] != FINGERPRINT_ACKPACKET)) {
                result = FINGERPRINT_KO;
            } else {
                result = packet[1];
            }
            return result;
        } catch (err) {
            this.decodeError(err);
        }
    }

    async fingerFastSearch() {
        try {
            let result = FINGERPRINT_OK;
            this.fingerID = 0xffff;
            this.confidence = 0xffff;
            let packet = [FINGERPRINT_HISPEEDSEARCH, 0x01, 0x00, 0x00, 0x00, 0xA3];
            this.writePacket(this.theAddress, FINGERPRINT_COMMANDPACKET, 8, packet);
            let len = await this.getReply(packet);
            if ((len != 1) && (packet[0] != FINGERPRINT_ACKPACKET)) {
                result = FINGERPRINT_KO;
            } else {
                this.fingerID = packet[2];
                this.fingerID <<= 8;
                this.fingerID |= packet[3];

                this.confidence = packet[4];
                this.confidence <<= 8;
                this.confidence |= packet[5];
                result = packet[1];
            }
            return result;
        } catch (err) {
            this.decodeError(err);
        }
    }

    async getTemplateCount() {
        try {
            let result = FINGERPRINT_OK;
            this.templateCount = 0xFFFF;
            let packet = [FINGERPRINT_TEMPLATECOUNT];
            this.writePacket(this.theAddress, FINGERPRINT_COMMANDPACKET, 3, packet);
            let len = await this.getReply(packet);
            if ((len != 1) && (packet[0] != FINGERPRINT_ACKPACKET)) {
                result = FINGERPRINT_KO;
            } else {
                this.templateCount = packet[2];
                this.templateCount <<= 8;
                this.templateCount |= packet[3];
                result = packet[1];
            }
            return result;
        } catch (err) {
            this.decodeError(err);
        }
    }

    async getFingerprintIDez(onSuccessCb) {
        let code = await this.getImage();
        if (code == FINGERPRINT_OK) {
            code = await this.imaget2Tz(1);
            if (code == FINGERPRINT_OK) {
                code = await this.fingerFastSearch();
                if (code == FINGERPRINT_OK) {
                    onSuccessCb && onSuccessCb(this.fingerID, this.confidence);
                }
            }
        }
        return code;
    }

    async waitForRegisteredFingerPrint(onSuccessCb) {
        let code = await this.getFingerprintIDez(onSuccessCb);
        while (code != FINGERPRINT_OK) {
            this.decodeError(code);
            code = await this.getFingerprintIDez(onSuccessCb);
        }
    }

    async continuousFingerScan(onSuccessCb) {
        while (1) {
            await this.waitForRegisteredFingerPrint(onSuccessCb);
        }
    }

    async getFingerprintEnroll(id, waitMsgCb, removeFingerMsgCb, sameFingerMsgCb, onStoreOk, errorMsgCb) {
        waitMsgCb && waitMsgCb();
        let code = await this.getImage();
        while (code != FINGERPRINT_OK) {
            code = await this.getImage();
            switch (code) {
                case FINGERPRINT_OK:
                case FINGERPRINT_NOFINGER:
                    break;
                default:
                    this.decodeError(code, errorMsgCb);
                    break;
            }
        }

        code = await this.imaget2Tz(1);
        switch (code) {
            case FINGERPRINT_OK:
                break;
            default:
                this.decodeError(code, errorMsgCb);
                break;
        }

        removeFingerMsgCb && removeFingerMsgCb();
        code = await this.getImage();
        while (code != FINGERPRINT_NOFINGER) {
            code = await this.getImage();
        }

        sameFingerMsgCb && sameFingerMsgCb();
        code = -1;
        while (code != FINGERPRINT_OK) {
            code = await this.getImage();
            switch (code) {
                case FINGERPRINT_OK:
                case FINGERPRINT_NOFINGER:
                    break;
                default:
                    this.decodeError(code, errorMsgCb);
                    break;
            }
        }

        code = await this.imaget2Tz(2);
        switch (code) {
            case FINGERPRINT_OK:
                break;
            default:
                this.decodeError(code, errorMsgCb);
                break;
        }

        code = await this.createModel();
        switch (code) {
            case FINGERPRINT_OK:
                break;
            default:
                this.decodeError(code, errorMsgCb);
                break;
        }

        code = await this.storeModel(id);
        switch (code) {
            case FINGERPRINT_OK:
                fingerOkMsgCb && fingerOkMsgCb();
                onStoreOk && onStoreOk();
                break;
            default:
                this.decodeError(code, errorMsgCb);
                break;
        }
    }

    async continuousEnroll(id, waitMsgCb,removeFingerMsgCb, sameFingerMsgCb, onStoreOk, errorMsgCb) {
        while (true) {
            await this.getFingerprintEnroll(id, waitMsgCb,removeFingerMsgCb, sameFingerMsgCb, onStoreOk, errorMsgCb);
            await this.timeout(3000);
            id++;
        }
    }

    checkReply(reply, packet) {
        let result = FINGERPRINT_BADPACKET;
        this.debug("\nReply: ", reply);
        if (
            reply[0] !== FINGERPRINT_STARTCODE >> 8 &&
            reply[1] !== (FINGERPRINT_STARTCODE & 0xff)
        ) {
            result = FINGERPRINT_BADPACKET;
        } else {
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

            result = len;
        }
        return result;
    }

    getReply(packet, timeout) {
        return new Promise((resolve, reject) => {
            timeout = timeout || 500;
            let result = 0;
            let reply = Buffer.from([]);
            this.onData = (data) => {
                this.debug("Receiving part of buffer: ", data);
                reply = Buffer.concat([reply, data]);
            };
            setTimeout(() => {
                if (reply.length == 0) {
                    reject(FINGERPRINT_TIMEOUT);
                } else {
                    result = this.checkReply(reply, packet);
                    this.onData = () => { };
                    if (result == FINGERPRINT_BADPACKET) {
                        reject(FINGERPRINT_BADPACKET);
                    } else {
                        resolve(result);
                    }
                }
            }, timeout);
        });
    }

    writePacket(addr, packetType, len, packet) {
        var buffer = [];

        buffer.push(FINGERPRINT_STARTCODE >> 8);
        buffer.push(FINGERPRINT_STARTCODE);
        buffer.push(addr >> 24);
        buffer.push(addr >> 16);
        buffer.push(addr >> 8);
        buffer.push(addr);
        buffer.push(packetType);
        buffer.push(len >> 8);
        buffer.push(len);

        var sum = (len >> 8) + (len & 0xff) + packetType;
        for (var i = 0; i < len - 2; i++) {
            buffer.push(packet[i]);
            sum += packet[i];
        }

        buffer.push(sum >> 8);
        buffer.push(sum);
        buffer = Buffer.from(buffer);
        this.debug("\nSending: ", buffer);
        this.serial.write(buffer);
    }

    timeout(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    decodeError(code, errorMsgCb) {
        let result;
        switch (code) {
            case 0x00: result = "Command execution complete"; break;
            case 0x01: result = "Error when receiving data package"; break;
            case 0x02: result = "No finger on the sensor"; break;
            case 0x03: result = "Fail to enroll the finger"; break;
            case 0x06: result = "Fail to generate character file due to the over-disorderly fingerprint image"; break;
            case 0x07: result = "Fail to generate character file due to lackness of character point or over-smallness of fingerprint image"; break;
            case 0x08: result = "Finger doesn't match"; break;
            case 0x09: result = "Fail to find the matching finger"; break;
            case 0x0A: result = "Fail to combine the character files"; break;
            case 0x0B: result = "Addressing PageID is beyond the finger library"; break;
            case 0x0C: result = "Error when reading template from library or the template is invalid"; break;
            case 0x0D: result = "Error when uploading template"; break;
            case 0x0E: result = "Module cant receive the following data packages."; break;
            case 0x0F: result = "Error when uploading image"; break;
            case 0x10: result = "Fail to delete the template"; break;
            case 0x11: result = "Fail to clear finger library"; break;
            case 0x15: result = "Fail to generate the image for the lackness of valid primary image"; break;
            case 0x18: result = "Error when writing flash"; break;
            case 0x19: result = "No definition error"; break;
            case 0x1A: result = "Invalid register number"; break;
            case 0x1B: result = "Incorrect configuration of register"; break;
            case 0x1C: result = "Wrong notepad page number"; break;
            case 0x1D: result = "fail to operate the communication port"; break;
            case 0xFF: result = "Response timeout"; break;
            default: result = "Unknow error"; break;
        }
        if (errorMsgCb) {
            errorMsgCb(result);
        } else {
            this.debug(result);
        }
    }

    debug(msg, code) {
        if (FINGERPRINT_DEBUG) {
            if (code) {
                console.log(msg, code);
            } else {
                console.log(msg);
            }
        }
    }
}