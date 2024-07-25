//test.js 
/*
test the dns ping functionality
*/
const dns = require('dns');

function getIpAddress(hostname) {
    return new Promise((resolve, reject) => {
      dns.lookup(hostname, (err, address) => {
        if (err) {
          reject(err);
        } else {
          resolve(address);
        }
      });
    });
  }
  
  getIpAddress("EN-1055-PROC1")
    .then(address => console.log(`The IP address of EN-1055-PROC1 is ${address}`))
    .catch(err => console.error(`Error: ${err}`));


//console.log(ping());