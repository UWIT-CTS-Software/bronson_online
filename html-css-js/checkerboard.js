/*
checkboard.js

This file contains all code relating to checkboard and will manipulate the DOM in index.html accordingly
*/


function setChecker() {
    console.log('Switching to checkerboard');
    let progGuts = document.querySelector('.program_board .program_guts');

    let main_container = document.createElement('div');
    main_container.classList.add('cb_container');

    let header = document.createElement('p');
    header.classList.add('cb_header');
    header.innerHTML = 'hello world - checkerboard';

    let list_container = document.createElement('div');
    list_container.innerHTML = 'another child<br>';

    let room_list, available_list, schedule_list, checked_list, needs_checked_list, comments_list;
    let container_list = [room_list, available_list, schedule_list, checked_list, needs_checked_list, comments_list];

    for (list in container_list) {
      list = document.createElement('div');
      list.classList.add('cb_contents')
      let inner_string = '';
      for (i=0; i<10; i++) {
        inner_string += 'test <br>';
      }
      list.innerHTML = inner_string + '!';
      list_container.append(list);
    }

    main_container.append(header, list_container);
    main_container.classList.add('program_guts');
    console.log(main_container)
    progGuts.replaceWith(main_container);
    return;
  }
