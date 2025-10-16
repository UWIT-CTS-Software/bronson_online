use crate::schema::bronson::{
    users,
    data,
    buildings,
    rooms,
    keys,
    sql_types::{
        IpAddress,
    }
};
use std::io::Write;
use serde::{
    Serialize,
    Deserialize,
};
use diesel::{
    prelude::*,
    pg::{
        Pg,
        PgValue,
    },
    sql_types::{
        Integer,
        Text,
        Record,
    },
    serialize,
    serialize::{
        ToSql,
        Output,
        IsNull,
    },
    deserialize,
    deserialize::{
        FromSql,
    },
    SqlType,
    AsExpression,
    FromSqlRow,
};

#[allow(non_camel_case_types)]
#[derive(SqlType)]
#[diesel(postgres_type(name = "device_type", schema = "bronson"))]
pub struct DB_DeviceType;

#[derive(Serialize, Deserialize, Debug, Clone, FromSqlRow, AsExpression, PartialEq, Eq)]
#[diesel(sql_type = DB_DeviceType)]
pub enum DeviceType {
    PROC,
    PJ,
    DISP,
    WS,
    TP,
    CMIC,
    UNKNOWN,
}

impl ToSql<DB_DeviceType, Pg> for DeviceType {
    fn to_sql<'b>(&'b self, out: &mut Output<'b, '_, Pg>) -> serialize::Result {
        match *self {
            DeviceType::PROC => out.write_all(b"PROC")?,
            DeviceType::PJ   => out.write_all(b"PJ")?,
            DeviceType::DISP => out.write_all(b"DISP")?,
            DeviceType::WS   => out.write_all(b"WS")?,
            DeviceType::TP   => out.write_all(b"TP")?,
            DeviceType::CMIC => out.write_all(b"CMIC")?,
            DeviceType::UNKNOWN => out.write_all(b"UNKNOWN")?,
        }
        Ok(IsNull::No)
    }
}

impl FromSql<DB_DeviceType, Pg> for DeviceType {
    fn from_sql(bytes: PgValue<'_>) -> deserialize::Result<Self> {
        match bytes.as_bytes() {
            b"PROC" => Ok(DeviceType::PROC),
            b"PJ"   => Ok(DeviceType::PJ),
            b"DISP" => Ok(DeviceType::DISP),
            b"WS"   => Ok(DeviceType::WS),
            b"TP"   => Ok(DeviceType::TP),
            b"CMIC" => Ok(DeviceType::CMIC),
            _       => Err(format!(
                "Unrecognized enum variant: {:?}",
                String::from_utf8_lossy(bytes.as_bytes())
            )
            .into()),
        }
    }
}

#[allow(non_camel_case_types)]
#[derive(Serialize, Deserialize, Debug, Clone, FromSqlRow, PartialEq, Eq, SqlType)]
#[diesel(postgres_type(name = "hostname", schema = "bronson"))]
pub struct DB_Hostname {
    pub room: String,
    pub dev_type: DeviceType,
    pub num: i32
}

impl ToSql<DB_Hostname, Pg> for DB_Hostname {
    fn to_sql<'b>(&'b self, out: &mut Output<'b, '_, Pg>) -> serialize::Result {
        <dyn serialize::WriteTuple::<(Text, DB_DeviceType, Integer)>>::write_tuple(
            &(
                &self.room,
                &self.dev_type,
                &self.num,
            ),
            &mut out.reborrow(),
        )
    }
}

impl FromSql<DB_Hostname, Pg> for DB_Hostname {
    fn from_sql(bytes: PgValue) -> deserialize::Result<Self> {
        let (room, dev_type, num) = FromSql::<Record<(Text, DB_DeviceType, Integer)>, Pg>::from_sql(bytes)?;

        Ok(DB_Hostname {
            room,
            dev_type,
            num,
        })
    }
}

impl DB_Hostname {
    pub fn to_string(&self) -> String {
        format!(
            "{}-{:?}{}",
            self.room.replace(" ", "-"),
            self.dev_type,
            self.num
        ).to_string()
    }
}

#[allow(non_camel_case_types)]
#[derive(Serialize, Deserialize, Debug, Clone, FromSqlRow, AsExpression, PartialEq, Eq)]
#[diesel(sql_type = IpAddress)]
pub struct DB_IpAddress {
    pub hostname: DB_Hostname,
    pub ip: String,
    pub last_ping: String,
    pub alert: i32,
    pub error_message: String,
}

impl ToSql<IpAddress, Pg> for DB_IpAddress {
    fn to_sql<'b>(&'b self, out: &mut Output<'b, '_, Pg>) -> serialize::Result {
        <dyn serialize::WriteTuple::<(DB_Hostname, Text, Text, Integer, Text)>>::write_tuple(
            &(
                &self.hostname,
                &self.ip,
                &self.last_ping,
                &self.alert,
                &self.error_message
            ),
            &mut out.reborrow(),
        )
    }
}

impl FromSql<IpAddress, Pg> for DB_IpAddress {
    fn from_sql(bytes: PgValue) -> deserialize::Result<Self> {
        let (hostname, ip, last_ping, alert, error_message) = FromSql::<Record<(DB_Hostname, Text, Text, Integer, Text)>, Pg>::from_sql(bytes)?;

        Ok(DB_IpAddress {
            hostname,
            ip,
            last_ping,
            alert,
            error_message
        })
    }
}

#[allow(non_camel_case_types)]
#[derive(Serialize, Deserialize, Debug, PartialEq, Queryable, Selectable, Insertable, AsChangeset)]
#[diesel(table_name = buildings, primary_key(abbrev))]
#[diesel(check_for_backend(diesel::pg::Pg))]
pub struct DB_Building {
    pub abbrev: String,
    pub name: String,
    pub lsm_name: String,
    pub zone: i16,
    pub checked_rooms: i16,
    pub total_rooms: i16,
}


#[allow(non_camel_case_types)]
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Queryable, Selectable, Insertable, AsChangeset)]
#[diesel(table_name = rooms)]
#[diesel(check_for_backend(diesel::pg::Pg))]
pub struct DB_Room {
    pub abbrev: String,
    pub name: String,
    pub checked: String,
    pub needs_checked: bool,
    pub gp: bool,
    pub available: bool,
    pub until: String,
    pub ping_data: Vec<Option<DB_IpAddress>>,
    pub schedule: Vec<Option<String>>,
}


#[allow(non_camel_case_types)]
#[derive(Serialize, Deserialize, Debug, PartialEq, Queryable, Selectable, Insertable, AsChangeset)]
#[diesel(table_name = users)]
#[diesel(check_for_backend(diesel::pg::Pg))]
pub struct DB_User {
    pub username: String,
    pub permissions: i16,
}

#[allow(non_camel_case_types)]
#[derive(Serialize, Deserialize, Debug, PartialEq, Queryable, Selectable, Insertable, AsChangeset)]
#[diesel(table_name = keys)]
#[diesel(check_for_backend(diesel::pg::Pg))]
pub struct DB_Key {
    pub key_id: String,
    pub val: String,
}

#[allow(non_camel_case_types)]
#[derive(Serialize, Deserialize, Debug, PartialEq, Queryable, Selectable, Insertable, AsChangeset)]
#[diesel(table_name = data)]
#[diesel(check_for_backend(diesel::pg::Pg))]
pub struct DB_DataElement {
    pub key: String,
    pub val: String,
}
