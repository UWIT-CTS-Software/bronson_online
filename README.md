# Bronson Online

`"All I do is eat oysters and speak six languages in three voices." - Action Bronson`

Bronson is a suite of diagnostic tools for the I.T. department. Looking to monitor classroom systems and help technicians organize where needs help today.

The frontend is written in JavaScript and the backend was written in Rust.

---

### Checkerboard

Utilizes LSM RoomCheck history through their API and looks at C.T.S. Technician Schedules and classroom schedules to point techs to open rooms in need of checkups during their shift

#### TODO's:

    [ ] - LSM API talking to Rust Backend

---

### JackNet

JackNet is a diagnostic tool to monitor the systems on campus. This tool will use a precompiled json file to pull information about each building on campus and which rooms we have systems in. JackNet will use this information to build a database of hostnames defined by our organization's system (ie: a processor example would be EN-1055-PROC1). Then return the user a comprehensive list/csv of all devices that are online and configured correctly. 

This can be used to find rooms that are not online that we did not know about. With some tinkering you can also utilize this to find specific devices in specific buildings that we are looking to remove/find.

#### TODO's:

    [ ] - CSV Exports
    [ ] - Server-Side CLI Debug Functionality
    [ ] - EC: Cool Visualizations w/ Building Floor Layouts.

 
---

### CamCode

A classroom programming helper. Given a specific set of parameters describing a specific room configuration, CamCode will present the user with files to be uploaded to the system to expedite configuration time.

This is intended to help program Q-SYS systems.

#### TODO's:

    [ ] - Setting a DOM
    [ ] - Defining the classroom parameters
    [ ] - Assemble Pre-built programs for these parameters


---

