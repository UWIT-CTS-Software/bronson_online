CREATE SCHEMA IF NOT EXISTS bronson;

CREATE TYPE bronson.device_type AS ENUM (
    'PROC',
    'PJ',
    'DISP',
    'WS',
    'TP',
    'CMIC'
);

CREATE TYPE bronson.hostname AS (
    "room" VARCHAR(10),
    "type" bronson.device_type,
    "num" INTEGER
);

CREATE TYPE bronson.ip_address AS (
    "hostname" bronson.hostname,
    "ip" VARCHAR(16)
);

CREATE TABLE bronson.buildings (
    abbrev   VARCHAR(5)   PRIMARY KEY,
    name     VARCHAR(255) NOT NULL,
    lsm_name VARCHAR(255) NOT NULL,
    zone     SMALLINT     NOT NULL
);

CREATE TABLE bronson.rooms (
    abbrev       VARCHAR(5)           PRIMARY KEY,
    name         VARCHAR(10)          NOT NULL,
    checked      BOOLEAN              NOT NULL,
    last_checked VARCHAR(21)          NOT NULL,
    gp           BOOLEAN              NOT NULL,
    available    BOOLEAN              NOT NULL,
    until        VARCHAR(9)           NOT NULL,
    hostnames    bronson.hostname[]   NOT NULL,
    ips          bronson.ip_address[] NOT NULL,

    CONSTRAINT fk_abbrev
      FOREIGN KEY (abbrev)
      REFERENCES buildings(abbrev)
      ON DELETE CASCADE
      ON UPDATE CASCADE
);

CREATE TABLE bronson.admins (
    admin VARCHAR(255) PRIMARY KEY
);

CREATE TABLE bronson.data (
    key VARCHAR(255) PRIMARY KEY,
    val TEXT         NOT NULL
);

