// Notifications 



// Register a service worker

if ('serviceWorker' in navigator && 'PushManager' in window) {
    navigator.serviceWorker.register('./service-worker.js').then(ServiceWorkerRegistration => {
        console.info('Service worker was registered');
        console.info({ServiceWorkerRegistration});
    }).catch(error => {
        console.error('An error occurred while registering the service worker.', error);
    });
    subscribeButton.disabled = false; 
} else {
    console.error('Browser does not support service workers or push messages.')
}

subscribeButton.addEventListener('click', subscribeButtonHandler);
unsubscribeButton.addEventListener('click', unsubscribeButtonHandler);

// Request permission 