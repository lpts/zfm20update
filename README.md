# zfm20update

Based on Grove C++ driver and @vadhack/zfm20.

**Installation**

`npm i zfm20update`

**Usage**
```javascript
const ZFM = require('zfm20update');
let zfm = new ZFM("/dev/ttyAMA0", 57600);
if (zfm) {
    zfm.connect().then(
        success => {
            zfm.debug("Found fingerprint sensor");
                 .then(ret => {
                     zfm.continuousEnroll(0,
                         () => {
                             console.log("Put your finger");
                         },
                         () => {
                             console.log("Remove your finger")
                         },
                         () => {
                             console.log("Put same finger")
                        },
                         () => {
                             console.log("Ok all done");
                         },
                         (error) => {
                             console.log("Error : ", error);
                         })
                 });
        },
        error => {
            zfm.debug("Fingerprint sensor not found");
        }
    );
}
```
