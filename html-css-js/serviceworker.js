this.onpush = (event) => {
    console.log(event);
}

function pushAPISubscribe() {
    if ("serviceWorker" in navigator) {
        navigator.serviceWorker
        .register("serviceworker.js")
        .then((reg) => {
            let sw;
            if (reg.installing) {
                sw = reg.installing;
            } else if (reg.waiting) {
                sw = reg.waiting;
            } else if (reg.active) {
                sw = reg.active;
            }

            if (sw) {
                console.log("Registered!:", sw);
                reg.pushManager.subscribe().then(
                    (pushSub) => {
                        let subObj = {
                            endpoint: pushSub.endpoint,
                            keys: {
                                p256dh: pushSub.getKey("p256dh"),
                                auth: pushSub.getKey("auth")
                            },
                            encoding: PushManager.supportedContentEncodings
                        };

                        fetch("/notifications/subscribe", {
                            method: "POST",
                            body: JSON.stringify(subObj)
                        });
                    },
                )
                .catch((error) => {
                    console.error(error);
                })
            }
        })
        .catch((error) => {
            console.error(error);
        })
    } else {
        console.error("Push API Registration not supported!")
    }
}
