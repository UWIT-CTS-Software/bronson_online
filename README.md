# Bronson Online

<img width="1170" height="119" alt="image" src="https://github.com/user-attachments/assets/c0540131-bed3-48c4-9019-2a8d716c8f23" />

`"All I do is eat oysters and speak six languages in three voices." - Action Bronson`

Bronson is a suite of diagnostic tools for the I.T. department. Looking to monitor classroom systems and help technicians organize where needs help today.

The frontend is written in JavaScript and the backend was written in Rust.

---

## Prerequisites

### Install Rust and Cargo (Linux)
First, Rust needs installed. <br>
`curl https://sh.rustup.rs -sSf | sh`<br>
You should see output stating "Rust is installed now. Great!"<br>

Cargo is included with this install. To verify that both rustc (the rust compiler) and cargo (package manager) were installed,
run the following commands to verify version information is returned.<br>
`rustc --version`<br>
`cargo --version`

## Installation Guide (Linux)
After installing the necessary cli tools, the repository can be cloned in with<br>
`git clone https://github.com/UWIT-CTS-Software/bronson_online.git`<br><br>
NOTE: The server will **not** compile without the necessary keys and device configuration archive. Please email *abryan9@uwyo.edu* for more information.

## Initialize Server
To start the server, navigate to the bronson_online folder in a terminal shell, then execute the following command:<br>
`cargo run -- -l`.<br>

The first flag tells the compiler that we aren't trying to pass it any arguments, then the -l argument gets collected by main.rs to initialize the server on the localhost ip.

From there, access the ip:port address that is outputted in the previous step in your browser to access the web application locally.

## What's included?

### Checkerboard

<img width="774" alt="checkerboard screenshot 7 3" src="https://github.com/user-attachments/assets/1f65306e-ea13-46cf-bab7-70528df27b04" />

Utilizes LSM RoomCheck history through their API and looks at C.T.S. Technician Schedules and classroom schedules to point techs to open rooms in need of checkups during their shift

### JackNet

<img width="566" alt="jacknet screenshot 7 3" src="https://github.com/user-attachments/assets/33d7d781-f638-44f2-a295-f2b3c44372b0" />

JackNet is a diagnostic tool to monitor the systems on campus. This tool will use a precompiled json file to pull information about each building on campus and which rooms we have systems in. JackNet will use this information to build a database of hostnames defined by our organization's system (ie: a processor example would be EN-1055-PROC1). Then return the user a comprehensive list/csv of all devices that are online and configured correctly. 

This can be used to find rooms that are not online that we did not know about. With some tinkering you can also utilize this to find specific devices in specific buildings that we are looking to remove/find.

### CamCode

![image](https://github.com/user-attachments/assets/a6a269c8-a9c2-443a-9c3d-c7a1b713da71)

A classroom programming helper. Given a specific set of parameters describing a specific room configuration, CamCode will present the user with files to be uploaded to the system to expedite configuration time.

This is intended to help program Q-SYS systems.

---

## To-Do List
- [ ] Expand camcode functionality to include netgear switch configuration details
- [ ] Either as part of camcode or as its own app, allow users to fill out a form that will then deliver the most appropriate Q-SYS config file for the desired room layout
- [ ] Lean out when and how API calls are being made
  - [ ] Cache recent calls for immediate retrieval
  - [ ] Schedule API calls instead of performing on user request
