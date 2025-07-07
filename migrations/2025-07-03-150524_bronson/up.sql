CREATE TABLE buildings (
    abbrev   VARCHAR(5)   PRIMARY KEY,
    name     VARCHAR(255) NOT NULL,
    lsm_name VARCHAR(255) NOT NULL,
    zone     SMALLINT     NOT NULL
);

CREATE TABLE rooms (
    abbrev       VARCHAR(5)  PRIMARY KEY,
    name         VARCHAR(10) NOT NULL,
    checked      BOOLEAN     NOT NULL,
    last_checked VARCHAR(21) NOT NULL,
    gp           BOOLEAN     NOT NULL,
    available    BOOLEAN     NOT NULL,
    until        VARCHAR(9)  NOT NULL,
    hostnames    TEXT[][]    NOT NULL,
    ips          TEXT[][]    NOT NULL,

    CONSTRAINT fk_abbrev
      FOREIGN KEY (abbrev)
      REFERENCES buildings(abbrev)
      ON DELETE CASCADE
      ON UPDATE CASCADE
);

CREATE TABLE admins (
    admin VARCHAR(255) PRIMARY KEY
);

CREATE TABLE data (
    key VARCHAR(255) PRIMARY KEY,
    val TEXT         NOT NULL
);

