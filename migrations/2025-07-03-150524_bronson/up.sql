CREATE SCHEMA bronson;

CREATE TYPE bronson.device_type AS ENUM (
    'PROC',
    'PJ',
    'DISP',
    'WS',
    'TP',
    'CMIC'
);

CREATE TYPE bronson.hostname AS (
    "room" TEXT,
    "dev_type" bronson.device_type,
    "num" INTEGER
);

CREATE TYPE bronson.ip_address AS (
    "hostname" bronson.hostname,
    "ip" TEXT
);

CREATE TABLE IF NOT EXISTS bronson.buildings (
    abbrev   TEXT         PRIMARY KEY,
    name     TEXT         NOT NULL,
    lsm_name TEXT         NOT NULL,
    zone     SMALLINT     NOT NULL,

    CHECK (length(abbrev) <= 5),
    CHECK (length(name) <= 255),
    CHECK (length(lsm_name) <= 255)
);

CREATE TABLE IF NOT EXISTS bronson.rooms (
    abbrev        TEXT         NOT NULL,
    name          TEXT         PRIMARY KEY,
    checked       TEXT         NOT NULL,
    needs_checked BOOLEAN      NOT NULL,
    gp            BOOLEAN      NOT NULL,
    available     BOOLEAN      NOT NULL,
    until         TEXT         NOT NULL,
    ping_data     bronson.ip_address[] NOT NULL,
    schedule      TEXT[]       NOT NULL,

    CHECK (length(abbrev) <= 5), 
    CHECK (length(name) <= 10),
    CHECK (length(checked) <= 21),
    CHECK (length(until) <= 9),

    CONSTRAINT fk_abbrev
      FOREIGN KEY (abbrev)
      REFERENCES bronson.buildings(abbrev)
      ON DELETE CASCADE
      ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS bronson.users (
    username    TEXT PRIMARY KEY,
    permissions SMALLINT     NOT NULL DEFAULT 3
);

CREATE TABLE IF NOT EXISTS bronson.data (
    key TEXT         PRIMARY KEY,
    val TEXT         NOT NULL
);

