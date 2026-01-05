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
    "ip" TEXT,
    "last_ping" TEXT,
    "alert" INTEGER,
    "error_message" TEXT
);

CREATE TABLE IF NOT EXISTS bronson.buildings (
    abbrev        TEXT         PRIMARY KEY,
    name          TEXT         NOT NULL,
    lsm_name      TEXT         NOT NULL,
    zone          SMALLINT     NOT NULL,
    total_rooms   SMALLINT     NOT NULL,
    checked_rooms SMALLINT     NOT NULL,

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

CREATE TABLE IF NOT EXISTS bronson.keys (
    key_id  TEXT PRIMARY KEY,
    val TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS bronson.data (
    key TEXT PRIMARY KEY,
    val TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS bronson.tickets (
    ticket_id               INTEGER     PRIMARY KEY,
    type_name               TEXT        NOT NULL,
    type_category_name      TEXT        NOT NULL,
    title                   TEXT        NOT NULL,
    description             TEXT        NOT NULL,
    account_name            TEXT        NOT NULL,
    status_name             TEXT        NOT NULL,
    created_date            TEXT        NOT NULL,
    created_full_name       TEXT        NOT NULL,
    modified_date           TEXT        NOT NULL,
    modified_full_name      TEXT        NOT NULL,
    requestor_name          TEXT        NOT NULL,
    requestor_email         TEXT        NOT NULL,
    requestor_phone         TEXT        NOT NULL,
    days_old                SMALLINT    NOT NULL,
    responsible_full_name   TEXT        NOT NULL,
    responsible_group_name  TEXT        NOT NULL,

    CHECK (length(type_name) <= 51),
    CHECK (length(type_category_name) <= 51),
    CHECK (length(title) <= 201),
    CHECK (length(description) <= 501),
    CHECK (length(account_name) <= 128),
    CHECK (length(status_name) <= 32),
    CHECK (length(created_date) <= 32),
    CHECK (length(created_full_name) <= 32),
    CHECK (length(modified_date) <= 32),
    CHECK (length(modified_full_name) <= 32),
    CHECK (length(requestor_name) <= 64),
    CHECK (length(requestor_email) <= 64),
    CHECK (length(requestor_phone) <= 32),
    CHECK (length(responsible_full_name) <= 32),
    CHECK (length(responsible_group_name) <= 128)
);

