/*
camcode.js

This file contains all code relating to camcode and will manipulate the DOM in index.html accordingly
*/
function setCamCode() {
    console.log('Switching to camcode')
    let progGuts = document.querySelector('.program_board .program_guts')
    let p = document.createElement('p')
    p.innerHTML = 'hello world - CamCode'
    p.classList.add('program_guts')
    progGuts.replaceWith(p)
    return
  }