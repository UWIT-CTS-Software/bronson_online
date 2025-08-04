# Bronson Online

<img width="1170" height="119" alt="image" src="https://github.com/user-attachments/assets/c0540131-bed3-48c4-9019-2a8d716c8f23" />

`"All I do is eat oysters and speak six languages in three voices." - Action Bronson`

Bronson is a suite of diagnostic tools for the I.T. department. Looking to monitor classroom systems and help technicians organize where needs help today.

The frontend is written in JavaScript and the backend was written in Rust.

---

## Prerequisites

### Install Rust and Cargo
First, Rust needs installed. <br>
`curl https://sh.rustup.rs -sSf | sh`<br>
You should see output stating "Rust is installed now. Great!"<br>

Cargo is included with this install. To verify that both rustc (the rust compiler) and cargo (package manager) were installed,
run the following commands to verify version information is returned.<br>
`rustc --version`<br>
`cargo --version`

### Install PostgreSQL
First, update your package index and install the prerequisite packages. <br>
**Debian** <br>
`sudo apt update` <br>
`sudo apt install gnupg2 wget`

**Arch** <br>
`sudo pacman -Syu` <br> 
`sudo pacman -S gnupg wget`

### Fetch PostgreSQL repository
After the necessary packages are installed, the PostgreSQL repository can be fetched. <br>
`sudo sh -c 'echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs).pgdg main" > /etc/apt/sources.list.d/pgdg.list'`

Now that apt knows about the repository, the signing key is necessary for an authorized transaction. <br>
`curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc | sudo gpg --dearmor -o /etc/apt/trusted.gpg.d/postgresql.gpg`

Update the package list. <br> 
`sudo apt update` (Debian) <br>
`sudo pacman -Syu` (Arch)

Install PostgreSQL 16 and its contrib modules. <br>
`sudo apt install postgresql-16 postgresql-contrib-16` (Debian) <br>
`sudo pacman -S postgresql postgresql-libs` (Arch)

### Mount and configure the PostgreSQL server
Start and enable the PostgreSQL service. <br>
`sudo systemctl start postgresql` <br>
`sudo systemctl enable postgresql`

Configure the PostgreSQL server. (Any text editor will work) <br>
`sudo nano /etc/postgresql/16/main/postgresql.conf` (Debian) <br>
`sudo nano /var/lib/postgresql/data/postqresql.conf` (Arch)

Set listen_adresses to allow remote connectivity. <br>
`listen_addresses = '*'` <br>
Save and exit.

Configure PostgreSQL to use MD5 password authentication in the pg_hba.conf file. This is required when enabling remote connections. <br>
**Debian** <br>
`sudo sed -i '/^host/s/ident/md5/' /etc/postgresql/16/main/pg_hba.conf` <br>
`sudo sed -i '/^local/s/peer/trust/' /etc/postgresql/16/main/pg_hba.conf` <br>
`echo "host all all 0.0.0.0/0 md5" | sudo tee -a /etc/postgresql/16/main/pg_hba.conf` <br>

**Arch**<br>
`sudo sed -i '/^host/s/ident/md5' /var/lib/postgresql/data/pg_hba.conf` <br>
`sudo sed -i '/^local/s/peer/trust' /var/lib/postgresql/data/pg_hba.conf` <br>
`echo "host all all 0.0.0.0/0 md5" | sudo tee -a /var/lib/postgresql/data/pg_hba.conf` <br>

Restart the PostgreSQL server to adopt these changes. <br>
`sudo systemctl restart postgresql`

Allow the PostgreSQL port to pass through the firewall. <br>
`sudo ufw allow 5432/tcp`

Connect to the PostgreSQL database server with the default "postgres" user. <br>
`sudo -u postgres psql`

Set a password for the postgres user. <br>
`ALTER USER postgres PASSWORD '<password>'` <br>
where `<password>` is the password you'd like to set.

Quit psql. <br>
`\q`

## Installation Guide (Linux)

### Clone the repository
After installing the necessary cli tools, the repository can be cloned in with<br>
`git clone https://github.com/UWIT-CTS-Software/bronson_online.git`<br>
NOTE: The server will **not** compile without the necessary keys and device configuration archive. Please email *abryan9@uwyo.edu* for more information.

Now, navigate to the newly installed repository <br>
`cd bronson`

### Install diesel CLI
Not only does rust's diesel ORM manage server-side database querying, but it also has a CLI that can be used to easily migrate the necessary tables. Before adding this CLI, it is important that rust is on its latest stable release.

`rustup update stable` <br>
`curl --proto '=https' --tlsv1.2 -LsSf https://github.com/diesel-rs/diesel/releases/download/v2.2.11/diesel_cli-installer.sh | sh`

Once diesel's CLI is successfully installed, the environment needs to be able to access PostgreSQL with the appropriate credentials. <br>
`echo DATABASE_URL=postgres://postgres:<password>@localhost/bronson_online > .env` <br>
where `<password>` is the password provided when setting up postgreSQL above.

Diesel now has the proper resources, so it will be able to handle the setup and management of necessary database shemas. <br>
`diesel setup` <br>
`diesel migration run` <br>

## Initialize Server
To start the server, navigate to the bronson_online folder in a terminal shell, then execute the following command:<br>
`cargo run`.<br>

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
