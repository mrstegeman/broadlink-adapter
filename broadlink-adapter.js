/**
 *
 * BroadlinkAdapter - Adapter which manages ir devices with Broadlink.
 *
 */

'use strict';

const EventEmitter = require('events').EventEmitter;
const Queue = require('promise-queue');
const BroadlinkJS = require('broadlinkjs-rm');
const IRDevice = require('./ir-device');
const fs = require('fs');

var DEBUG = true;

const Adapter = require('../adapter');

function validateJSON(text) {
    var obj = null;

    try {
        obj = JSON.parse( text );
        return obj;
    } catch (O_o) {
        ;
    }

    try {
        obj = eval("(" + text + ")");
    } catch (o_O) {
        console.log("ERROR. JSON.parse failed");
        return null;
    }
    console.log("WARN. As a result of JSON.parse, a trivial problem has occurred");
    return obj;
}

class BroadlinkAdapter extends Adapter {
    constructor(addonManager, manifest, broadlink) {
        super(addonManager, 'broadlink-' + broadlink.mac, manifest.name);

        this._broadlink = broadlink;
        this._queue = new Queue(1, Infinity);
        this.manager.addAdapter(this);
    }

    sendData(hexData) {
        if (!hexData) {
            console.log('Missing params, sendData failed', typeof device, typeof hexData);
            return;
        }

        const hexDataBuffer = new Buffer(hexData, 'hex');

        this._queue.add(function () {
            this._broadlink.sendData(hexDataBuffer);
            return new Promise((resolve, reject) => {
                setTimeout(() => {
                    resolve();
                }, 200);
            });
        }.bind(this));
    }

    waitSendSequenceResolve(property) {
        this._queue.add(function () {
            return new Promise((resolve, reject) => {
                var deferredSet = property.deferredSet;
                if (deferredSet) {
                    property.deferredSet = null;
                    deferredSet.resolve(property.value);
                }
                resolve();
            });
        });
    }

    sendSequence(property, sequence) {
        for (var i in sequence) {
            const data = sequence[i];
            this.sendData(data);
        }
        this.waitSendSequenceResolve(property);
    }

    _createDeviceFromJson(json){
        const config = validateJSON(json);

        if(!config || config.mac != this._broadlink.mac) return;

        // ToDo check config


    }

    _createDeviceFromFile(file) {
        fs.stat(file, function (err, stat) {
            if (err) return;

            fs.readFile('file', 'utf8', function (err, data) {
                if (err) throw err;

                this._createDeviceFromJson(data);
            }.bind(this));
        }.bind(this))
    }

    _readDeviceFiles() {
        fs.readdir(__dirname + '/devices', function (err, files) {
            if (err) throw err;
            files.forEach(this._createDeviceFromFile.bind(this));
        });
    }

    startPairing(timeoutSeconds) {
        this._readDeviceFiles();
    }

    cancelPairing() {
        //Do nothing
    }

    removeThing(device) {
        if (DEBUG) console.log('removeThing(' + device.id + ')');

        handleDeviceRemoved(device);
    }

    cancelRemoveThing(node) {
        // Nothing to do.
    }
}

class BroadlinkManager extends Adapter {
    constructor(addonManager, manifest) {
        super(addonManager, 'broadlink-adapter', manifest.name);

        this._destaddr = manifest.address || '255.255.255.255';
        this._port1 = manifest.port1 || 0;
        this._port2 = manifest.port2 || 0;
        this._isPairing = false;
        this._broadlinkFinder = new BroadlinkJS();

        this.event = new EventEmitter();
        this._discoveredDevices = {};
        this._broadlinkFinder.on('deviceReady', this._onDeviceReady.bind(this));
        this.startPairing(10);
        this.manager.addAdapter(this);
    }

    _onDeviceReady(device) {
        const macAddressParts = device.mac.toString('hex').match(/[\s\S]{1,2}/g) || []
        const macAddress = macAddressParts.join(':')
        device.host.macAddress = macAddress

        if (this._discoveredDevices[device.host.address] || this._discoveredDevices[device.host.macAddress]) return;

        if (DEBUG) console.log(`Discovered Broadlink RM device at ${device.host.address} (${device.host.macAddress})`)

        this._discoveredDevices[device.host.address] = device;
        this._discoveredDevices[device.host.macAddress] = device;

        this.event.emit('deviceReady', device);
    }

    _discoverDevices(timeoutSeconds) {
        if (this._isPairing == false) {

            return;
        }

        if (timeoutSeconds <= 0) {
            this._isPairing = false;

            return;
        }

        this._broadlinkFinder.discover(this._port1, this._port2, this._destaddr);

        setTimeout(function () {
            this._discoverDevices(timeoutSeconds - 5);
        }.bind(this), 5 * 1000);
    }

    startPairing(timeoutSeconds) {
        this._isPairing = true;
        console.log('Pairing mode started, timeout =', timeoutSeconds);
        this._discoverDevices(timeoutSeconds);
    }

    cancelPairing() {
        console.log('Cancelling pairing mode');
        this.isPairing = false;
    }

    getDevice(host, learnOnly) {
        let device;

        const hosts = Object.keys(this._discoveredDevices);

        if (host) {
            device = this._discoveredDevices[host];
        } else if (learnOnly) {
            for (let i = 0; i < hosts.length; i++) {
                const currentDevice = this._discoveredDevices[hosts[i]];
                if (currentDevice.enterLearning) {
                    device = currentDevice

                    break;
                }
            }
        } else {
            device = discoveredDevices[hosts[0]];
        }

        if (!device && !discovering) {
            console.log(`Attempting to discover RM devices for 5s`);

            this._discoverDevices(5);
        }

        return device;
    }
}

function loadBroadlinkAdapters(addonManager, manifest, errorCallback) {
    const broadlinkManager = new BroadlinkManager(addonManager, manifest);

    broadlinkManager.event.on('deviceReady', function (device) {
        new BroadlinkAdapter(addonManager, manifest, device);
    })
}

module.exports = loadBroadlinkAdapters;